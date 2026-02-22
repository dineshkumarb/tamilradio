import { Router } from 'express';
import { getDbQueries, getArtistDb } from '../db/index.js';
import { scanArtist } from '../services/libraryScanner.js';
import { fetchMetadataFromWeb } from '../services/metadataService.js';
import { resolveAlbumArt } from '../services/albumArtService.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

async function getMusicPath(artistSlug) {
  const artistDb = getArtistDb();
  const pathFromDb = await artistDb.getMusicPath(artistSlug);
  if (pathFromDb) return pathFromDb.trim();
  const key = artistSlug === 'ilayaraja' ? 'ILAYARAJA_MUSIC_PATH' : artistSlug === 'arrahman' ? 'ARRAHMAN_MUSIC_PATH' : null;
  if (!key) return null;
  const value = process.env[key];
  return (typeof value === 'string' ? value : '').trim();
}

async function isValidArtist(slug) {
  const artist = await getArtistDb().getBySlug(slug);
  return artist != null;
}

// Public: song count only (for home page)
router.get('/:artist/count', async (req, res) => {
  const artist = (req.params.artist || '').toLowerCase();
  if (!(await isValidArtist(artist))) return res.status(400).json({ error: 'Invalid artist' });
  const q = getDbQueries();
  const count = await q.countByArtist(artist);
  res.json({ count });
});

// Admin only: full library list
router.get('/:artist', requireAuth, requireAdmin, async (req, res) => {
  const artist = (req.params.artist || '').toLowerCase();
  if (!(await isValidArtist(artist))) return res.status(400).json({ error: 'Invalid artist' });
  const q = getDbQueries();
  const songs = await q.getAllByArtist(artist);
  res.json(songs);
});

router.post('/scan', requireAuth, requireAdmin, async (req, res) => {
  const body = req.body || {};
  const artist = (body.artist || '').toLowerCase();
  if (!(await isValidArtist(artist))) return res.status(400).json({ error: 'Invalid artist' });
  const musicPath = await getMusicPath(artist);
  if (!musicPath) {
    return res.status(400).json({ error: `No music path configured for ${artist}. Set it in Admin → Artists for this artist, or use ILAYARAJA_MUSIC_PATH / ARRAHMAN_MUSIC_PATH in .env` });
  }
  try {
    const result = await scanArtist(artist, musicPath);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
  const q = getDbQueries();
  const song = await q.getById(id);
  if (!song) return res.status(404).json({ error: 'Song not found' });
  await q.deleteSong(id);
  res.json({ deleted: id });
});

router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
  const q = getDbQueries();
  const song = await q.getById(id);
  if (!song) return res.status(404).json({ error: 'Song not found' });
  const { title, album, year, genre } = req.body || {};
  const updates = {};
  if (title !== undefined) updates.title = title;
  if (album !== undefined) updates.album = album;
  if (year !== undefined) updates.year = year;
  if (genre !== undefined) updates.genre = genre;
  await q.updateSong(id, updates);
  const updated = await q.getById(id);
  res.json(updated);
});

router.get('/:id/metadata', requireAuth, requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
  const artistName = req.query.artistName || null;
  const title = req.query.title || null;
  const lastfmKey = (process.env.LASTFM_API_KEY || '').trim();
  const q = getDbQueries();
  try {
    const result = await fetchMetadataFromWeb(id, artistName, title, lastfmKey);
    if (!result) {
      return res.status(404).json({ error: 'No metadata found' });
    }
    const song = await q.getById(id);
    if (song?.file_path) {
      const { art, source } = await resolveAlbumArt({
        filePath: song.file_path,
        artist: song.artist,
        title: title || result.title || song.title,
        album: result.album ?? song.album,
        songId: id,
        lastfmApiKey: lastfmKey || undefined,
      });
      const isDataUri = art.startsWith('data:');
      return res.json({
        ...result,
        album_art_url: isDataUri ? null : art,
        album_art_base64: isDataUri ? art : null,
        art_source: source,
      });
    }
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
