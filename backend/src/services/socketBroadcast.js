import { getCurrentSong } from './streamManager.js';
import { getArtistDb } from '../db/index.js';

let ioRef = null;

export function setIo(io) {
  ioRef = io;
}

export async function broadcastNowPlaying(artist) {
  if (!ioRef) return;
  if (artist) {
    const current = getCurrentSong(artist);
    ioRef.to(`artist:${artist}`).emit('nowplaying', { artist, current });
  } else {
    const slugs = await getArtistDb().getSlugs();
    for (const a of slugs) {
      const current = getCurrentSong(a);
      ioRef.to(`artist:${a}`).emit('nowplaying', { artist: a, current });
    }
  }
}
