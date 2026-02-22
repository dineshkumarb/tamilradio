import { readdir, stat } from 'fs/promises';
import path from 'path';
import { parseFile } from 'music-metadata';
import { getDbQueries } from '../db/index.js';

const EXT = new Set(['.mp3', '.flac', '.m4a', '.wav', '.aac', '.ogg', '.opus', '.wma']);

async function* walkDir(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (err) {
    throw new Error(`Cannot read music directory "${dir}": ${err.code || err.message}.`);
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      yield* walkDir(full);
    } else if (EXT.has(path.extname(e.name).toLowerCase())) {
      yield full;
    }
  }
}

async function parseMetadata(filePath) {
  try {
    return await parseFile(filePath, { duration: true });
  } catch {
    return null;
  }
}

/**
 * Scan a single artist directory and upsert into the unified media table.
 * Sets artist_slug so the stream manager and artist views can filter.
 * Optionally emits Socket.IO progress events.
 */
export async function scanArtist(artistSlug, musicPath, io) {
  const resolved = path.resolve(musicPath);
  let s;
  try {
    s = await stat(resolved);
  } catch (err) {
    throw new Error(`Cannot access music path "${resolved}": ${err.code || err.message}.`);
  }
  if (!s.isDirectory()) {
    throw new Error(`Music path is not a directory: ${resolved}`);
  }

  const q = getDbQueries();
  const seen = new Set();
  let added = 0;
  let updated = 0;
  const parseErrors = [];

  const emit = (event, data) => { if (io) io.emit(event, data); };

  // Discover all files first for progress tracking
  const files = [];
  for await (const filePath of walkDir(resolved)) {
    files.push(filePath);
  }
  const totalFiles = files.length;

  for (let i = 0; i < totalFiles; i++) {
    const filePath = files[i];
    const normalized = path.normalize(filePath);
    seen.add(normalized);

    emit('scan:progress', {
      current: i + 1,
      total: totalFiles,
      percent: Math.round(((i + 1) / totalFiles) * 100),
      file: path.basename(filePath),
    });

    const meta = await parseMetadata(normalized);
    if (!meta) {
      parseErrors.push({ file: normalized, error: 'Failed to parse metadata' });
      continue;
    }

    const common = meta.common;
    const format = meta.format;
    const fileStat = await stat(normalized).catch(() => null);
    const safeInt = (v) => (Number.isFinite(v) ? v : null);
    const duration = Number.isFinite(format.duration) ? Math.round(format.duration * 100) / 100 : null;

    let albumArtBase64 = null;
    if (common.picture?.length) {
      const pic = common.picture[0];
      if (pic.data?.length > 100) {
        const b64 = Buffer.isBuffer(pic.data) ? pic.data.toString('base64') : Buffer.from(pic.data).toString('base64');
        if (b64.length > 0) albumArtBase64 = `data:${pic.format};base64,${b64}`;
      }
    }

    const existing = await q.getByFilePath(normalized);

    const song = {
      artist_slug: artistSlug,
      artist: common.artist || artistSlug,
      file_path: normalized,
      title: common.title || path.basename(normalized, path.extname(normalized)),
      album: common.album ?? null,
      year: safeInt(common.year),
      genre: common.genre?.length ? common.genre[0] : null,
      duration_seconds: duration,
      album_art_base64: albumArtBase64,
      album_art_url: null,
    };

    if (existing) {
      const updates = {
        title: song.title,
        album: song.album,
        year: song.year,
        genre: song.genre,
        duration_seconds: song.duration_seconds,
        artist_slug: artistSlug,
        artist: song.artist,
      };
      if (song.album_art_base64 != null) updates.album_art_base64 = song.album_art_base64;
      if (fileStat) {
        updates.file_size = fileStat.size;
      }
      await q.updateSong(existing.id, updates);
      updated++;
    } else {
      await q.insertSong(song);
      added++;
    }
  }

  // Remove DB entries for files that no longer exist on disk (for this artist)
  const all = await q.getAllByArtist(artistSlug);
  let removed = 0;
  for (const row of all) {
    if (!seen.has(path.normalize(row.file_path))) {
      await q.deleteSong(row.id);
      removed++;
    }
  }

  const total = await q.countByArtist(artistSlug);
  const result = { added, updated, removed, total };
  if (parseErrors.length > 0) {
    result.parseErrors = parseErrors;
    result.parseErrorCount = parseErrors.length;
  }
  return result;
}
