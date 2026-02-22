import { createReadStream } from 'fs';
import { getDbQueries, getArtistDb } from '../db/index.js';

const state = {};

async function getArtistSlugs() {
  return await getArtistDb().getSlugs();
}

function getOrCreateState(artist) {
  if (!state[artist]) {
    state[artist] = { status: 'stopped', currentSong: null, queue: [], streamPath: null };
  }
  return state[artist];
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function buildQueue(artist) {
  const q = getDbQueries();
  const songs = await q.getAllByArtist(artist);
  return shuffle(songs);
}

export function getMusicPath(artist) {
  return null; // paths come from env in routes
}

export async function getState(artist) {
  const slugs = await getArtistSlugs();
  if (!slugs.includes(artist)) return null;
  return getOrCreateState(artist);
}

export function getStreamPath(artist) {
  const s = state[artist];
  return s?.streamPath ?? null;
}

export async function startStream(artist) {
  const slugs = await getArtistSlugs();
  if (!slugs.includes(artist)) return { ok: false, error: 'Invalid artist' };
  const s = getOrCreateState(artist);
  if (s.status === 'playing') return { ok: true, state: s };
  s.queue = await buildQueue(artist);
  if (s.queue.length === 0) return { ok: false, error: 'No songs in library' };
  s.currentSong = s.queue.shift();
  s.status = 'playing';
  s.streamPath = s.currentSong.file_path;
  return { ok: true, state: s };
}

export async function stopStream(artist) {
  const slugs = await getArtistSlugs();
  if (!slugs.includes(artist)) return { ok: false, error: 'Invalid artist' };
  const s = getOrCreateState(artist);
  s.status = 'stopped';
  s.currentSong = null;
  s.queue = [];
  s.streamPath = null;
  return { ok: true };
}

export async function skipToNext(artist) {
  const slugs = await getArtistSlugs();
  if (!slugs.includes(artist)) return { ok: false, error: 'Invalid artist' };
  const s = getOrCreateState(artist);
  if (s.queue.length === 0) {
    s.queue = await buildQueue(artist);
  }
  if (s.queue.length === 0) {
    s.currentSong = null;
    s.streamPath = null;
    return { ok: true, state: s };
  }
  s.currentSong = s.queue.shift();
  s.streamPath = s.currentSong.file_path;
  return { ok: true, state: s };
}

function isValidDataUri(str) {
  if (!str || typeof str !== 'string') return false;
  if (str.startsWith('http://') || str.startsWith('https://')) return true;
  if (!str.startsWith('data:image/')) return false;
  const marker = ';base64,';
  const i = str.indexOf(marker);
  if (i === -1) return false;
  const payload = str.slice(i + marker.length);
  return payload.length >= 100;
}

export function getCurrentSong(artist) {
  const s = state[artist];
  if (!s || !s.currentSong) return null;
  const row = s.currentSong;
  const albumArt = (row.album_art_base64 && isValidDataUri(row.album_art_base64))
    ? row.album_art_base64
    : row.album_art_url || null;
  return {
    id: row.id,
    title: row.title,
    album: row.album,
    year: row.year,
    genre: row.genre,
    duration_seconds: row.duration_seconds,
    albumArt,
  };
}

export function getQueue(artist) {
  const s = state[artist];
  if (!s) return [];
  return s.queue.slice(0, 50).map(row => ({
    id: row.id,
    title: row.title,
    album: row.album,
    duration_seconds: row.duration_seconds,
  }));
}

/**
 * Returns a readable stream for the current song file path, or null.
 * Caller must pipe this to the response and handle next track (e.g. after duration).
 */
export function createAudioReadStream(artist) {
  const s = state[artist];
  if (!s?.streamPath) return null;
  try {
    return createReadStream(s.streamPath);
  } catch (_) {
    return null;
  }
}
