/**
 * albumArtService.js
 *
 * Album art retrieval for Radio App (Ilayaraja & A.R. Rahman).
 * Sources in priority order:
 *  1. Embedded ID3/Vorbis tags (local file)
 *  2. iTunes Search API (no key)
 *  3. Last.fm API (LASTFM_API_KEY in .env)
 *  4. MusicBrainz + Cover Art Archive (free, no key)
 *  5. Fallback to local artist poster path
 *
 * Uses existing app DB; no axios (uses fetch).
 */

import { parseFile } from 'music-metadata';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDbQueries } from '../db/index.js';

const __filename = fileURLToPath(import.meta.url);

const ITUNES_BASE = 'https://itunes.apple.com/search';
const LASTFM_BASE = 'https://ws.audioscrobbler.com/2.0/';
const MB_BASE = 'https://musicbrainz.org/ws/2/';
const COVERART_BASE = 'https://coverartarchive.org';

// Display names for API lookups
function displayArtist(artistSlug) {
  return artistSlug === 'ilayaraja' ? 'Ilayaraja' : artistSlug === 'arrahman' ? 'A.R. Rahman' : artistSlug;
}

// ─────────────────────────────────────────────
// SOURCE 1 — Embedded ID3 / Vorbis tags
// ─────────────────────────────────────────────

/**
 * Extracts album art embedded in the audio file.
 * @param {string} filePath - Absolute path to MP3/FLAC/etc.
 * @returns {Promise<string|null>} Data URI or null
 */
export async function getEmbeddedAlbumArt(filePath) {
  try {
    const metadata = await parseFile(filePath);
    const picture = metadata.common?.picture?.[0];
    if (picture) {
      const base64 = Buffer.from(picture.data).toString('base64');
      return `data:${picture.format};base64,${base64}`;
    }
  } catch (err) {
    console.warn(`[Embedded] Failed to read tags for "${filePath}":`, err.message);
  }
  return null;
}

/**
 * Reads local metadata from an audio file.
 * @param {string} filePath
 * @returns {Promise<object>}
 */
export async function getLocalMetadata(filePath) {
  try {
    const metadata = await parseFile(filePath);
    const { common, format } = metadata;
    return {
      title: common?.title ?? path.basename(filePath, path.extname(filePath)),
      artist: common?.artist ?? common?.albumartist ?? null,
      album: common?.album ?? null,
      year: common?.year != null ? String(common.year) : null,
      genre: common?.genre?.[0] ?? null,
      duration: format?.duration ?? null,
    };
  } catch (err) {
    console.warn(`[Metadata] Failed to parse "${filePath}":`, err.message);
    return {};
  }
}

// ─────────────────────────────────────────────
// SOURCE 2 — iTunes Search API (no key)
// ─────────────────────────────────────────────

/**
 * @param {string} artist - e.g. "Ilayaraja" or "A.R. Rahman"
 * @param {string} trackTitle
 * @returns {Promise<string|null>} 600×600 image URL or null
 */
export async function getAlbumArtFromiTunes(artist, trackTitle) {
  try {
    const params = new URLSearchParams({
      term: `${artist} ${trackTitle}`,
      media: 'music',
      limit: '1',
    });
    const res = await fetch(`${ITUNES_BASE}?${params}`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const data = await res.json();
    const result = data?.results?.[0];
    if (result?.artworkUrl100) {
      return result.artworkUrl100.replace('100x100bb', '600x600bb');
    }
  } catch (err) {
    console.warn(`[iTunes] Request failed for "${trackTitle}":`, err.message);
  }
  return null;
}

// ─────────────────────────────────────────────
// SOURCE 3 — Last.fm API
// ─────────────────────────────────────────────

/**
 * @param {string} artist
 * @param {string} trackTitle
 * @param {string} apiKey
 * @returns {Promise<string|null>}
 */
export async function getAlbumArtFromLastFm(artist, trackTitle, apiKey) {
  if (!(apiKey || '').trim()) return null;
  try {
    const params = new URLSearchParams({
      method: 'track.getInfo',
      api_key: apiKey.trim(),
      artist,
      track: trackTitle,
      format: 'json',
    });
    const res = await fetch(`${LASTFM_BASE}?${params}`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const data = await res.json();
    const images = data?.track?.album?.image;
    if (images?.length) {
      const priority = ['extralarge', 'large', 'medium', 'small'];
      for (const size of priority) {
        const img = images.find((i) => i.size === size);
        if (img?.['#text']) return img['#text'];
      }
    }
  } catch (err) {
    console.warn(`[Last.fm] Request failed for "${trackTitle}":`, err.message);
  }
  return null;
}

/**
 * Last.fm album.getInfo (when track lookup fails).
 * @param {string} artist
 * @param {string} album
 * @param {string} apiKey
 * @returns {Promise<string|null>}
 */
export async function getAlbumArtFromLastFmByAlbum(artist, album, apiKey) {
  if (!(apiKey || '').trim() || !album) return null;
  try {
    const params = new URLSearchParams({
      method: 'album.getInfo',
      api_key: apiKey.trim(),
      artist,
      album,
      format: 'json',
    });
    const res = await fetch(`${LASTFM_BASE}?${params}`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const data = await res.json();
    const images = data?.album?.image;
    if (images?.length) {
      const extralarge = images.find((i) => i.size === 'extralarge');
      return extralarge?.['#text'] ?? images[images.length - 1]?.['#text'] ?? null;
    }
  } catch (err) {
    console.warn(`[Last.fm Album] Request failed for album "${album}":`, err.message);
  }
  return null;
}

// ─────────────────────────────────────────────
// SOURCE 4 — MusicBrainz + Cover Art Archive
// ─────────────────────────────────────────────

/**
 * Finds release on MusicBrainz, then front cover from coverartarchive.org.
 * @param {string} artist
 * @param {string} album
 * @returns {Promise<string|null>} Final image URL after redirects
 */
export async function getAlbumArtFromMusicBrainz(artist, album) {
  if (!album) return null;
  try {
    const query = encodeURIComponent(`artist:"${artist}" AND release:"${album}"`);
    const res = await fetch(
      `${MB_BASE}release/?query=${query}&fmt=json&limit=1`,
      {
        headers: { 'User-Agent': 'TamilRadio/1.0 (https://github.com/tamilradio)' },
        signal: AbortSignal.timeout(8000),
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const releaseId = data?.releases?.[0]?.id;
    if (!releaseId) return null;

    const artRes = await fetch(`${COVERART_BASE}/release/${releaseId}/front`, {
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
    });
    if (!artRes.ok) return null;
    return artRes.url;
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.warn(`[MusicBrainz] Request failed for "${album}":`, err.message);
    }
  }
  return null;
}

// ─────────────────────────────────────────────
// MAIN — Waterfall resolver
// ─────────────────────────────────────────────

/**
 * Resolves album art using all sources in order. Updates song in DB when songId provided.
 *
 * Priority: cache → embedded → iTunes → Last.fm track → Last.fm album → MusicBrainz → fallback
 *
 * @param {object} params
 * @param {string} params.filePath - Absolute path to audio file
 * @param {string} params.artist - Artist slug 'ilayaraja' | 'arrahman' or display name
 * @param {string} params.title - Song title
 * @param {string} [params.album] - Album name (optional)
 * @param {number} [params.songId] - DB song id for cache read/write
 * @param {string} [params.lastfmApiKey] - Last.fm API key (optional)
 * @returns {Promise<{ art: string, source: string }>}
 */
export async function resolveAlbumArt({ filePath, artist, title, album, songId, lastfmApiKey }) {
  const q = getDbQueries();
  const artistDisplay = displayArtist(artist);

  if (songId) {
    const row = await q.getById(songId);
    if (row?.album_art_url) {
      return { art: row.album_art_url, source: 'cache' };
    }
    if (row?.album_art_base64) {
      return { art: row.album_art_base64, source: 'cache' };
    }
  }

  let art = null;
  let source = null;

  art = await getEmbeddedAlbumArt(filePath);
  if (art) source = 'embedded';

  if (!art) {
    art = await getAlbumArtFromiTunes(artistDisplay, title);
    if (art) source = 'itunes';
  }

  if (!art && lastfmApiKey) {
    art = await getAlbumArtFromLastFm(artistDisplay, title, lastfmApiKey);
    if (art) source = 'lastfm_track';
  }

  if (!art && album && lastfmApiKey) {
    art = await getAlbumArtFromLastFmByAlbum(artistDisplay, album, lastfmApiKey);
    if (art) source = 'lastfm_album';
  }

  if (!art && album) {
    art = await getAlbumArtFromMusicBrainz(artistDisplay, album);
    if (art) source = 'musicbrainz';
  }

  if (!art) {
    const safeName = (artistDisplay || artist).toLowerCase().replace(/[\s.]/g, '_');
    art = `/images/${safeName}_poster.jpg`;
    source = 'fallback';
    console.warn(`[Fallback] No art found for "${title}" — using artist poster path.`);
  }

  if (songId && source !== 'fallback') {
    const isDataUri = art.startsWith('data:');
    await q.updateSong(songId, {
      album_art_base64: isDataUri ? art : null,
      album_art_url: isDataUri ? null : art,
    });
  }

  return { art, source };
}

// ─────────────────────────────────────────────
// CLI test (run: node src/services/albumArtService.js)
// ─────────────────────────────────────────────

const isMain = process.argv[1] && path.resolve(process.argv[1]) === __filename;
if (isMain) {
  (async () => {
    console.log('=== Album Art Service — Quick Test ===\n');
    const testCases = [
      { artist: 'Ilayaraja', title: 'Roja Jaaneman', album: 'Roja' },
      { artist: 'A.R. Rahman', title: 'Jai Ho', album: 'Slumdog Millionaire' },
    ];
    for (const song of testCases) {
      console.log(`\nResolving art for: "${song.title}" by ${song.artist}`);
      const itunes = await getAlbumArtFromiTunes(song.artist, song.title);
      console.log(`  iTunes:      ${itunes || 'not found'}`);
      const lastfm = await getAlbumArtFromLastFm(song.artist, song.title, (process.env.LASTFM_API_KEY || '').trim());
      console.log(`  Last.fm:     ${lastfm || 'not found'}`);
      const mb = await getAlbumArtFromMusicBrainz(song.artist, song.album);
      console.log(`  MusicBrainz: ${mb || 'not found'}`);
    }
    process.exit(0);
  })().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
