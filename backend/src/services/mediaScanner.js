import { readdir, stat } from 'fs/promises';
import path from 'path';
import { parseFile } from 'music-metadata';
import { getMediaQueries, getArtistDb } from '../db/index.js';

const MEDIA_EXTENSIONS = new Set([
  '.mp3', '.flac', '.wav', '.aac', '.ogg', '.m4a', '.opus', '.wma',
]);

async function* walkAsync(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkAsync(full);
    } else if (MEDIA_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      yield full;
    }
  }
}

async function discoverFiles(roots) {
  const files = [];
  for (const root of roots) {
    for await (const filePath of walkAsync(root)) {
      files.push(filePath);
    }
  }
  return files;
}

async function extractMetadata(filePath) {
  const fileStat = await stat(filePath);
  let meta;
  try {
    meta = await parseFile(filePath, { duration: true });
  } catch {
    return null;
  }

  const c = meta.common;
  const f = meta.format;

  let albumArtBase64 = null;
  if (c.picture?.length) {
    const pic = c.picture[0];
    if (pic.data?.length > 100) {
      const b64 = Buffer.isBuffer(pic.data) ? pic.data.toString('base64') : Buffer.from(pic.data).toString('base64');
      if (b64.length > 0) albumArtBase64 = `data:${pic.format};base64,${b64}`;
    }
  }

  return {
    file_path: filePath,
    title: c.title || path.basename(filePath, path.extname(filePath)),
    artist: c.artist ?? null,
    album: c.album ?? null,
    album_artist: c.albumartist ?? null,
    genre: c.genre?.length ? c.genre[0] : null,
    year: c.year ?? null,
    track_number: c.track?.no ?? null,
    duration: f.duration != null ? Math.round(f.duration * 100) / 100 : null,
    bitrate: f.bitrate != null ? Math.round(f.bitrate / 1000) : null,
    sample_rate: f.sampleRate ?? null,
    file_size: fileStat.size,
    last_modified: fileStat.mtime,
    album_art_base64: albumArtBase64,
    album_art_url: null,
  };
}

/**
 * Build a map of normalized artist music_path → artist slug.
 * Used to auto-assign artist_slug when a file falls under an artist's directory.
 */
async function buildArtistPathMap() {
  try {
    const artistDb = getArtistDb();
    const all = await artistDb.getAll();
    const map = [];
    for (const a of all) {
      if (a.music_path) {
        map.push({ prefix: path.resolve(a.music_path) + path.sep, slug: a.slug });
      }
    }
    // Sort longest prefix first for most-specific match
    map.sort((a, b) => b.prefix.length - a.prefix.length);
    return map;
  } catch {
    return [];
  }
}

function resolveArtistSlug(filePath, rootArtistSlug, artistPathMap) {
  if (rootArtistSlug) return rootArtistSlug;
  const normalized = path.normalize(filePath);
  for (const { prefix, slug } of artistPathMap) {
    if (normalized.startsWith(prefix)) return slug;
  }
  return null;
}

let _scanAbort = null;

export function abortScan() {
  if (_scanAbort) _scanAbort.abort();
}

/**
 * Run a full or delta rescan of all library root directories.
 * Also scans artist-specific music_paths that aren't already covered by roots.
 * Sets artist_slug on every file based on root association or artist directory match.
 *
 * @param {import('socket.io').Server | null} io
 */
export async function rescanLibrary(io) {
  const db = getMediaQueries();
  const roots = await db.getRoots();
  const artistPathMap = await buildArtistPathMap();

  // Combine library roots + artist music_paths into scan targets
  const scanTargets = [];
  const coveredPaths = new Set();

  for (const r of roots) {
    const resolved = path.resolve(r.path);
    scanTargets.push({ path: resolved, artistSlug: r.artist_slug || null });
    coveredPaths.add(resolved);
  }

  // Add artist music_paths not already covered by a library root
  for (const { prefix, slug } of artistPathMap) {
    const dir = prefix.endsWith(path.sep) ? prefix.slice(0, -1) : prefix;
    const alreadyCovered = [...coveredPaths].some(
      (cp) => dir.startsWith(cp) || cp.startsWith(dir)
    );
    if (!alreadyCovered) {
      scanTargets.push({ path: dir, artistSlug: slug });
      coveredPaths.add(dir);
    }
  }

  if (scanTargets.length === 0) {
    return { added: 0, updated: 0, removed: 0, total: 0, errors: 0, message: 'No library roots or artist paths configured.' };
  }

  const ac = new AbortController();
  _scanAbort = ac;

  const emit = (event, data) => { if (io) io.emit(event, data); };

  emit('scan:status', { phase: 'discovering', message: 'Discovering files…' });

  const allFiles = [];
  for (const target of scanTargets) {
    for await (const filePath of walkAsync(target.path)) {
      allFiles.push({ filePath, rootArtistSlug: target.artistSlug });
    }
  }
  const totalFiles = allFiles.length;

  emit('scan:status', { phase: 'scanning', message: `Found ${totalFiles} media files`, totalFiles });

  let added = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;
  const validPaths = new Set();

  for (let i = 0; i < totalFiles; i++) {
    if (ac.signal.aborted) break;

    const { filePath, rootArtistSlug } = allFiles[i];
    const normalized = path.normalize(filePath);
    validPaths.add(normalized);

    emit('scan:progress', {
      current: i + 1,
      total: totalFiles,
      percent: Math.round(((i + 1) / totalFiles) * 100),
      file: path.basename(filePath),
    });

    // Delta scan: skip files unchanged since last index
    const existing = await db.getByFilePath(normalized);
    if (existing) {
      let fileStat;
      try {
        fileStat = await stat(normalized);
      } catch {
        errors++;
        continue;
      }
      const lastMod = fileStat.mtime;
      const dbMod = existing.last_modified ? new Date(existing.last_modified) : null;
      if (dbMod && Math.abs(lastMod.getTime() - dbMod.getTime()) < 1000) {
        // File unchanged — but still update artist_slug if it was missing
        const newSlug = resolveArtistSlug(normalized, rootArtistSlug, artistPathMap);
        if (newSlug && existing.artist_slug !== newSlug) {
          await db.updateArtistSlug(existing.id, newSlug);
        }
        skipped++;
        continue;
      }
    }

    const meta = await extractMetadata(normalized);
    if (!meta) {
      errors++;
      continue;
    }

    meta.artist_slug = resolveArtistSlug(normalized, rootArtistSlug, artistPathMap);

    if (existing) {
      await db.upsertMedia(meta);
      updated++;
    } else {
      await db.upsertMedia(meta);
      added++;
    }
  }

  const removed = await db.removeStaleFiles(validPaths);
  const total = await db.getCount();

  _scanAbort = null;

  const summary = { added, updated, removed, skipped, total, errors };
  emit('scan:complete', summary);

  return summary;
}
