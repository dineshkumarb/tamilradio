import { readdir, stat } from 'fs/promises';
import path from 'path';
import { parseFile } from 'music-metadata';
import { getMediaQueries } from '../db/index.js';

const MEDIA_EXTENSIONS = new Set([
  '.mp3', '.flac', '.wav', '.aac', '.ogg', '.m4a', '.opus', '.wma',
]);

/**
 * Async recursive directory walker.
 * Yields absolute file paths for supported media types.
 */
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

/**
 * First pass: collect all file paths so we know the total count for progress.
 */
async function discoverFiles(roots) {
  const files = [];
  for (const root of roots) {
    for await (const filePath of walkAsync(root)) {
      files.push(filePath);
    }
  }
  return files;
}

/**
 * Extract metadata from a single file using music-metadata.
 */
async function extractMetadata(filePath) {
  const fileStat = await stat(filePath);
  let meta;
  try {
    meta = await parseFile(filePath, { duration: true, skipCovers: true });
  } catch {
    return null;
  }

  const c = meta.common;
  const f = meta.format;

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
  };
}

let _scanAbort = null;

export function abortScan() {
  if (_scanAbort) _scanAbort.abort();
}

/**
 * Run a full or delta rescan of all library root directories.
 * Emits Socket.IO events for real-time progress.
 *
 * @param {import('socket.io').Server | null} io
 * @returns {Promise<{added: number, updated: number, removed: number, total: number, errors: number}>}
 */
export async function rescanLibrary(io) {
  const db = getMediaQueries();
  const roots = await db.getRoots();
  if (roots.length === 0) {
    return { added: 0, updated: 0, removed: 0, total: 0, errors: 0, message: 'No library roots configured.' };
  }

  const ac = new AbortController();
  _scanAbort = ac;

  const emit = (event, data) => {
    if (io) io.emit(event, data);
  };

  emit('scan:status', { phase: 'discovering', message: 'Discovering files…' });

  const rootPaths = roots.map((r) => r.path);
  const files = await discoverFiles(rootPaths);
  const totalFiles = files.length;

  emit('scan:status', { phase: 'scanning', message: `Found ${totalFiles} media files`, totalFiles });

  let added = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;
  const validPaths = new Set();

  for (let i = 0; i < totalFiles; i++) {
    if (ac.signal.aborted) break;

    const filePath = files[i];
    const normalized = path.normalize(filePath);
    validPaths.add(normalized);

    emit('scan:progress', {
      current: i + 1,
      total: totalFiles,
      percent: Math.round(((i + 1) / totalFiles) * 100),
      file: path.basename(filePath),
    });

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
        skipped++;
        continue;
      }
    }

    const meta = await extractMetadata(normalized);
    if (!meta) {
      errors++;
      continue;
    }

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
