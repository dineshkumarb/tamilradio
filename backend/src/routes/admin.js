import { Router } from 'express';
import path from 'path';
import { readdirSync, existsSync, statSync } from 'fs';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

/**
 * GET /api/admin/browse?path=
 * List directory contents (directories only) for server-side folder browsing.
 * path: absolute path; default "/" or "" resolves to "/".
 * Returns { path, entries: [ { name, path, isDirectory } ] }.
 */
router.get('/browse', requireAuth, requireAdmin, (req, res) => {
  const raw = (req.query.path ?? '').trim() || '/';
  const resolved = path.resolve(raw);
  if (!resolved.startsWith('/')) {
    return res.status(400).json({ error: 'Path must be absolute' });
  }
  if (!existsSync(resolved)) {
    return res.status(404).json({ error: 'Path does not exist', path: resolved });
  }
  let stat;
  try {
    stat = statSync(resolved);
  } catch (err) {
    return res.status(403).json({
      error: 'Cannot access path',
      code: err.code,
      message: err.message,
    });
  }
  if (!stat.isDirectory()) {
    return res.status(400).json({ error: 'Path is not a directory', path: resolved });
  }
  let entries;
  try {
    entries = readdirSync(resolved, { withFileTypes: true });
  } catch (err) {
    return res.status(403).json({
      error: 'Cannot read directory',
      code: err.code,
      message: err.message,
    });
  }
  const dirs = entries
    .filter((e) => e.isDirectory())
    .map((e) => {
      const full = path.join(resolved, e.name);
      return { name: e.name, path: full, isDirectory: true };
    })
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  res.json({ path: resolved, entries: dirs });
});

/**
 * GET /api/admin/validate-path?path=
 * Check if path exists, is a directory, and is readable.
 * Returns { valid, exists, readable, isDirectory, path, error? }.
 */
router.get('/validate-path', requireAuth, requireAdmin, (req, res) => {
  const raw = (req.query.path ?? '').trim();
  if (!raw) {
    return res.json({ valid: false, exists: false, readable: false, isDirectory: false, path: '', error: 'Path is empty' });
  }
  const resolved = path.resolve(raw);
  const out = { valid: false, exists: false, readable: false, isDirectory: false, path: resolved };
  if (!existsSync(resolved)) {
    return res.json({ ...out, error: 'Path does not exist' });
  }
  out.exists = true;
  let stat;
  try {
    stat = statSync(resolved);
  } catch (err) {
    return res.json({
      ...out,
      error: err.code === 'EACCES' || err.code === 'EPERM' ? 'Permission denied' : err.message,
    });
  }
  out.readable = true;
  out.isDirectory = stat.isDirectory();
  if (!out.isDirectory) {
    return res.json({ ...out, error: 'Path is not a directory' });
  }
  try {
    readdirSync(resolved, { withFileTypes: true });
  } catch (err) {
    return res.json({
      ...out,
      error: err.code === 'EACCES' || err.code === 'EPERM' ? 'Cannot list directory (permission denied)' : err.message,
    });
  }
  out.valid = true;
  res.json(out);
});

export default router;
