import { getDbQueries } from '../db/index.js';

const LASTFM_BASE = 'https://ws.audioscrobbler.com/2.0/';
const MB_BASE = 'https://musicbrainz.org/ws/2/';

function cacheKey(artist, title) {
  const a = (artist || '').toLowerCase().replace(/\s+/g, '_');
  const t = (title || '').toLowerCase().replace(/\s+/g, '_');
  return `mb:${a}:${t}`;
}

export async function fetchMetadataFromWeb(songId, artistName, title, lastfmApiKey) {
  const q = getDbQueries();
  const song = await q.getById(songId);
  if (!song) return null;

  const key = cacheKey(artistName, title || song.title);
  const cached = await q.getMetadataCache(key);
  if (cached) {
    const updates = {};
    if (cached.title) updates.title = cached.title;
    if (cached.album) updates.album = cached.album;
    if (cached.year) updates.year = cached.year;
    if (cached.genre) updates.genre = cached.genre;
    if (cached.album_art_url) updates.album_art_url = cached.album_art_url;
    if (Object.keys(updates).length) await q.updateSong(songId, updates);
    return { source: 'cache', ...cached };
  }

  let result = null;
  if (lastfmApiKey) {
    result = await fetchFromLastFm(artistName || displayArtist(song.artist), title || song.title, lastfmApiKey);
  }
  if (!result) {
    result = await fetchFromMusicBrainz(artistName || displayArtist(song.artist), title || song.title);
  }

  if (result) {
    await q.setMetadataCache({
      cache_key: key,
      title: result.title,
      album: result.album,
      year: result.year,
      genre: result.genre,
      album_art_url: result.album_art_url,
      raw_json: JSON.stringify(result),
    });
    const updates = {};
    if (result.title) updates.title = result.title;
    if (result.album) updates.album = result.album;
    if (result.year) updates.year = result.year;
    if (result.genre) updates.genre = result.genre;
    if (result.album_art_url) updates.album_art_url = result.album_art_url;
    await q.updateSong(songId, updates);
  }
  return result;
}

function displayArtist(artist) {
  return artist === 'ilayaraja' ? 'Ilayaraja' : artist === 'arrahman' ? 'A.R. Rahman' : artist;
}

function pickBestImage(imageArray) {
  if (!imageArray?.length) return null;
  const img = imageArray.find((i) => i.size === 'extralarge') || imageArray.find((i) => i.size === 'large') || imageArray[imageArray.length - 1];
  const url = img?.['#text'];
  return url && url.trim() !== '' ? url : null;
}

async function fetchFromLastFm(artist, title, apiKey) {
  const key = (apiKey || '').trim();
  if (!key) return null;
  const params = new URLSearchParams({
    method: 'track.getInfo',
    api_key: key,
    artist: (artist || '').trim(),
    track: (title || '').trim(),
    format: 'json',
    autocorrect: '1',
  });
  try {
    const res = await fetch(`${LASTFM_BASE}?${params}`);
    const data = await res.json();

    if (data?.error) {
      console.warn('[Last.fm] API error:', data.error, data.message || '');
      return null;
    }

    const t = data?.track;
    if (!t) {
      console.warn('[Last.fm] No track found for', artist, '–', title);
      return null;
    }

    let albumArt = pickBestImage(t.album?.image) || pickBestImage(t.image);
    if (t.album?.image?.length && !albumArt) {
      const fallback = t.album.image[t.album.image.length - 1]?.['#text'];
      if (fallback?.trim()) albumArt = fallback;
    }
    if (!albumArt && t.album) {
      console.warn('[Last.fm] Track found but no album art:', t.name, '| album:', t.album?.title || '(no title)');
    }

    return {
      title: t.name,
      album: t.album?.title ?? null,
      year: t.album?.wiki?.published?.match(/\d{4}/)?.[0] ?? null,
      genre: t.toptags?.tag?.[0]?.name ?? null,
      album_art_url: albumArt || null,
    };
  } catch (err) {
    console.warn('[Last.fm] Request failed:', err.message);
    return null;
  }
}

async function fetchFromMusicBrainz(artist, title) {
  const q = encodeURIComponent(`${title} AND artist:${artist}`);
  try {
    const res = await fetch(
      `${MB_BASE}recording/?query=${q}&fmt=json&limit=1`,
      { headers: { 'User-Agent': 'TamilRadio/1.0' } }
    );
    const data = await res.json();
    const rec = data?.recordings?.[0];
    if (!rec) return null;
    const release = rec.releases?.[0];
    return {
      title: rec.title,
      album: release?.title ?? null,
      year: release?.date ? parseInt(release.date.slice(0, 4), 10) : null,
      genre: null,
      album_art_url: null, // MusicBrainz doesn't serve cover art directly; would need Cover Art Archive
    };
  } catch (_) {
    return null;
  }
}
