import { Router } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { mkdirSync } from 'fs';
import { getArtistDb, getDbQueries } from '../db/index.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(__dirname, '../../uploads/artists');

try {
  mkdirSync(uploadDir, { recursive: true });
} catch (_) {}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const slug = (req.body?.slug || req.body?.name || 'artist').toString().replace(/[^a-z0-9_-]/gi, '_').toLowerCase() || 'artist';
    const ext = (file.mimetype === 'image/jpeg' ? '.jpg' : file.mimetype === 'image/png' ? '.png' : path.extname(file.originalname) || '.jpg');
    cb(null, `${slug}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

const router = Router();

router.get('/', async (_req, res) => {
  const q = getArtistDb();
  const all = await q.getAll();
  res.json(all);
});

router.get('/:slug', async (req, res) => {
  const q = getArtistDb();
  const artist = await q.getBySlug(req.params.slug);
  if (!artist) return res.status(404).json({ error: 'Artist not found' });
  res.json(artist);
});

router.post('/', requireAuth, requireAdmin, async (req, res) => {
  const body = req.body || {};
  const slug = (body.slug || '').toString().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-_]/g, '') || null;
  const name = (body.name || '').toString().trim() || null;
  if (!slug || !name) return res.status(400).json({ error: 'slug and name are required' });

  const q = getArtistDb();
  if (await q.slugExists(slug)) return res.status(400).json({ error: 'An artist with this slug already exists' });

  const photoUrl = body.photo_url || null;
  const musicPath = (body.music_path || '').trim() || null;
  const sourceUrl = (body.source_url || '').trim() || null;
  const theme = ['ilayaraja', 'arrahman', 'neutral'].includes(body.theme) ? body.theme : 'neutral';
  const sortOrder = parseInt(body.sort_order, 10) || 0;

  const id = await q.create({ slug, name, photo_url: photoUrl, source_url: sourceUrl, music_path: musicPath, theme, sort_order: sortOrder });
  const created = await q.getById(id);
  res.status(201).json(created);
});

router.post('/upload-photo', requireAuth, requireAdmin, upload.single('photo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const slug = (req.body?.slug || '').toString().toLowerCase();
  const photoUrl = `/uploads/artists/${req.file.filename}`;
  if (slug) {
    const q = getArtistDb();
    const artist = await q.getBySlug(slug);
    if (artist) {
      await q.update(artist.id, { photo_url: photoUrl });
      const updated = await q.getById(artist.id);
      return res.json({ photo_url: photoUrl, artist: updated });
    }
  }
  res.json({ photo_url: photoUrl });
});

router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
  const body = req.body || {};
  const q = getArtistDb();
  const existing = await q.getById(id);
  if (!existing) return res.status(404).json({ error: 'Artist not found' });

  const slug = body.slug !== undefined ? body.slug.toString().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') : undefined;
  if (slug !== undefined && slug && (await q.slugExists(slug, id))) return res.status(400).json({ error: 'Slug already in use' });

  const updates = {};
  if (body.name !== undefined) updates.name = body.name.toString().trim();
  if (slug !== undefined) updates.slug = slug || existing.slug;
  if (body.photo_url !== undefined) updates.photo_url = body.photo_url || null;
  if (body.source_url !== undefined) updates.source_url = body.source_url ? body.source_url.trim() : null;
  if (body.music_path !== undefined) updates.music_path = body.music_path ? body.music_path.trim() : null;
  if (body.theme !== undefined) updates.theme = ['ilayaraja', 'arrahman', 'neutral'].includes(body.theme) ? body.theme : existing.theme;
  if (body.sort_order !== undefined) updates.sort_order = parseInt(body.sort_order, 10) || 0;

  await q.update(id, updates);
  const updated = await q.getById(id);
  res.json(updated);
});

router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
  const q = getArtistDb();
  const existing = await q.getById(id);
  if (!existing) return res.status(404).json({ error: 'Artist not found' });
  const songs = await getDbQueries().getAllByArtist(existing.slug);
  if (songs.length > 0) return res.status(400).json({ error: `Cannot delete: ${songs.length} song(s) exist for this artist. Remove songs first.` });
  await q.delete(id);
  res.status(204).send();
});

export default router;
