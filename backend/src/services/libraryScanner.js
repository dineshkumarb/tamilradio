import { readdirSync, statSync, existsSync, createReadStream } from 'fs';
import path from 'path';
import { parseFile, parseStream } from 'music-metadata';
import { getDbQueries } from '../db/index.js';

const EXT = new Set(['.mp3', '.flac', '.m4a', '.wav']);
const MIME_BY_EXT = {
  '.mp3': 'audio/mpeg',
  '.flac': 'audio/flac',
  '.m4a': 'audio/mp4',
  '.wav': 'audio/wav',
};

function* walkDir(dir, base = dir) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    throw new Error(`Cannot read music directory "${dir}": ${err.code || err.message}. Check that the path exists and is readable (e.g. volume mount and permissions).`);
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      yield* walkDir(full, base);
    } else if (EXT.has(path.extname(e.name).toLowerCase())) {
      yield full;
    }
  }
}

async function parseMetadata(filePath, options = { duration: true }) {
  try {
    return await parseFile(filePath, options);
  } catch (fileErr) {
    const code = fileErr.code || '';
    const msg = fileErr.message || '';
    if (code === 'EACCES' || code === 'EPERM' || msg.includes('permission') || msg.includes('access')) {
      throw new Error(`Permission denied reading file: ${filePath}`);
    }
    if (code === 'ENOENT') {
      throw new Error(`File not found: ${filePath}`);
    }
    if (code === 'EISDIR') {
      throw new Error(`Path is a directory, not a file: ${filePath}`);
    }
    try {
      const ext = path.extname(filePath).toLowerCase();
      const mime = MIME_BY_EXT[ext] || 'application/octet-stream';
      const stream = createReadStream(filePath);
      const meta = await parseStream(stream, { mimeType: mime }, options);
      return meta;
    } catch (streamErr) {
      const fallbackMsg = streamErr.code ? `${streamErr.code}: ${streamErr.message}` : streamErr.message;
      throw new Error(`Failed to read metadata: ${fallbackMsg}`);
    }
  }
}

export async function scanArtist(artist, musicPath) {
  const resolved = path.resolve(musicPath);
  if (!existsSync(resolved)) {
    throw new Error(`Music path does not exist: ${resolved}. Set the correct path in Admin → Artists or ILAYARAJA_MUSIC_PATH / ARRAHMAN_MUSIC_PATH in .env. In Docker, use the path inside the container (e.g. /music/ilayaraja) and ensure the host folder is mounted.`);
  }
  let stat;
  try {
    stat = statSync(resolved);
  } catch (err) {
    throw new Error(`Cannot access music path "${resolved}": ${err.code || err.message}. Check volume mount and permissions.`);
  }
  if (!stat.isDirectory()) {
    throw new Error(`Music path is not a directory: ${resolved}`);
  }

  const q = getDbQueries();
  const seen = new Set();
  let added = 0;
  let updated = 0;
  const parseErrors = [];

  for (const filePath of walkDir(resolved)) {
    const normalized = path.normalize(filePath);
    seen.add(normalized);
    const existing = await q.getByFilePath(normalized);
    let meta;
    try {
      meta = await parseMetadata(normalized, { duration: true });
    } catch (err) {
      const msg = err.message || String(err);
      console.warn('Failed to parse', normalized, msg);
      parseErrors.push({ file: normalized, error: msg });
      continue;
    }
    const common = meta.common;
    const format = meta.format;
    const duration = format.duration != null ? Math.round(format.duration) : null;
    let albumArtBase64 = null;
    if (common.picture && common.picture.length) {
      const pic = common.picture[0];
      const data = pic.data;
      const hasData = data && (data.length > 100);
      if (hasData) {
        const b64 = Buffer.isBuffer(data) ? data.toString('base64') : Buffer.from(data).toString('base64');
        if (b64.length > 0) albumArtBase64 = `data:${pic.format};base64,${b64}`;
      }
    }
    const song = {
      artist,
      file_path: normalized,
      title: common.title || path.basename(normalized, path.extname(normalized)),
      album: common.album ?? null,
      year: common.year ?? null,
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
      };
      if (song.album_art_base64 != null) updates.album_art_base64 = song.album_art_base64;
      await q.updateSong(existing.id, updates);
      updated++;
    } else {
      await q.insertSong(song);
      added++;
    }
  }

  // Remove DB entries for files that no longer exist on disk
  const all = await q.getAllByArtist(artist);
  for (const row of all) {
    if (!seen.has(path.normalize(row.file_path))) {
      await q.deleteSong(row.id);
    }
  }

  const total = await q.countByArtist(artist);
  const result = { added, updated, total };
  if (parseErrors.length > 0) {
    result.parseErrors = parseErrors;
    result.parseErrorCount = parseErrors.length;
  }
  return result;
}
