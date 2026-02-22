import { Router } from 'express';
import { readdir, stat } from 'fs/promises';
import path from 'path';
import os from 'os';
import { getMediaQueries } from '../db/index.js';
import { rescanLibrary, abortScan } from '../services/mediaScanner.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

let _io = null;
export function setMediaIo(io) {
  _io = io;
}

let _scanRunning = false;

// ── Filesystem Browser ─────────────────────────────────────────

router.get('/browse', requireAuth, requireAdmin, async (req, res) => {
  const requestedPath = req.query.path || os.homedir();
  const resolved = path.resolve(requestedPath);

  try {
    const entries = await readdir(resolved, { withFileTypes: true });
    const dirs = [];
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      if (entry.isDirectory()) {
        dirs.push({ name: entry.name, path: path.join(resolved, entry.name) });
      }
    }
    dirs.sort((a, b) => a.name.localeCompare(b.name));
    res.json({
      current: resolved,
      parent: path.dirname(resolved) !== resolved ? path.dirname(resolved) : null,
      directories: dirs,
    });
  } catch (err) {
    res.status(400).json({ error: `Cannot read directory: ${err.message}` });
  }
});

// ── Library Roots Management ───────────────────────────────────

router.get('/roots', requireAuth, requireAdmin, async (_req, res) => {
  const db = getMediaQueries();
  const roots = await db.getRoots();
  res.json(roots);
});

router.post('/roots', requireAuth, requireAdmin, async (req, res) => {
  const { path: rootPath, label } = req.body || {};
  if (!rootPath) return res.status(400).json({ error: 'path is required' });

  const resolved = path.resolve(rootPath);
  try {
    const s = await stat(resolved);
    if (!s.isDirectory()) return res.status(400).json({ error: 'Path is not a directory' });
  } catch {
    return res.status(400).json({ error: 'Path does not exist or is not accessible' });
  }

  const db = getMediaQueries();
  const root = await db.addRoot(resolved, label || path.basename(resolved));
  res.json(root);
});

router.delete('/roots/:id', requireAuth, requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
  const db = getMediaQueries();
  await db.removeRoot(id);
  res.json({ deleted: id });
});

// ── Rescan ─────────────────────────────────────────────────────

router.post('/rescan', requireAuth, requireAdmin, async (_req, res) => {
  if (_scanRunning) {
    return res.status(409).json({ error: 'A scan is already running' });
  }
  _scanRunning = true;
  res.json({ status: 'started' });

  try {
    await rescanLibrary(_io);
  } catch (err) {
    console.error('Rescan error:', err);
    if (_io) _io.emit('scan:error', { error: err.message });
  } finally {
    _scanRunning = false;
  }
});

router.post('/rescan/abort', requireAuth, requireAdmin, (_req, res) => {
  abortScan();
  _scanRunning = false;
  res.json({ status: 'aborted' });
});

router.get('/rescan/status', requireAuth, requireAdmin, (_req, res) => {
  res.json({ running: _scanRunning });
});

// ── Fast Retrieval Queries ─────────────────────────────────────

router.get('/tracks', requireAuth, async (req, res) => {
  const db = getMediaQueries();
  const limit = Math.min(parseInt(req.query.limit, 10) || 500, 2000);
  const offset = parseInt(req.query.offset, 10) || 0;
  const tracks = await db.getAllTracks(limit, offset);
  res.json(tracks);
});

router.get('/search', requireAuth, async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json([]);
  const db = getMediaQueries();
  const results = await db.search(q);
  res.json(results);
});

router.get('/search/title', requireAuth, async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json([]);
  const db = getMediaQueries();
  res.json(await db.searchByTitle(q));
});

router.get('/by-artist', requireAuth, async (req, res) => {
  const artist = (req.query.artist || '').trim();
  if (!artist) return res.json([]);
  const db = getMediaQueries();
  res.json(await db.getByArtist(artist));
});

router.get('/by-album', requireAuth, async (req, res) => {
  const album = (req.query.album || '').trim();
  if (!album) return res.json([]);
  const db = getMediaQueries();
  res.json(await db.getByAlbum(album));
});

router.get('/by-genre', requireAuth, async (req, res) => {
  const genre = (req.query.genre || '').trim();
  if (!genre) return res.json([]);
  const db = getMediaQueries();
  res.json(await db.getByGenre(genre));
});

router.get('/stats', requireAuth, async (_req, res) => {
  const db = getMediaQueries();
  const stats = await db.getStats();
  res.json(stats);
});

router.get('/artists', requireAuth, async (_req, res) => {
  const db = getMediaQueries();
  res.json(await db.getDistinctArtists());
});

router.get('/albums', requireAuth, async (_req, res) => {
  const db = getMediaQueries();
  res.json(await db.getDistinctAlbums());
});

router.get('/genres', requireAuth, async (_req, res) => {
  const db = getMediaQueries();
  res.json(await db.getDistinctGenres());
});

export default router;
