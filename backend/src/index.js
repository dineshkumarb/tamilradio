import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { openDb, getArtistDb } from './db/index.js';
import streamRoutes from './routes/stream.js';
import libraryRoutes, { setLibraryIo } from './routes/library.js';
import nowplayingRoutes from './routes/nowplaying.js';
import authRoutes from './routes/auth.js';
import artistRoutes from './routes/artists.js';
import adminRoutes from './routes/admin.js';
import mediaLibraryRoutes, { setMediaIo } from './routes/mediaLibrary.js';
import { setIo, broadcastNowPlaying } from './services/socketBroadcast.js';
import { getAuthDb } from './db/index.js';

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: { origin: process.env.CORS_ORIGIN || 'http://localhost:5173' },
});
setIo(io);

app.use(cors({ origin: process.env.CORS_ORIGIN || true }));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

async function main() {
  await openDb();
  const authDb = getAuthDb();
  await authDb.ensureAdmin(process.env.ADMIN_USERNAME || 'admin', process.env.ADMIN_PASSWORD || 'admin');

  app.use('/api/auth', authRoutes);
  app.use('/api/artists', artistRoutes);
  app.use('/api/stream', streamRoutes);
  app.use('/api/library', libraryRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/nowplaying', nowplayingRoutes);
  app.use('/api/media', mediaLibraryRoutes);

  setMediaIo(io);
  setLibraryIo(io);

  // Production: serve built frontend and SPA fallback
  const publicDir = path.join(__dirname, '../public');
  app.use(express.static(publicDir));
  app.get('*', (req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api') || req.path.startsWith('/socket.io') || req.path.startsWith('/uploads')) return next();
    res.sendFile(path.join(publicDir, 'index.html'), (err) => { if (err) next(); });
  });

  io.on('connection', async (socket) => {
    socket.on('subscribe', async (artist) => {
      const slugs = await getArtistDb().getSlugs();
      if (slugs.includes(artist)) socket.join(`artist:${artist}`);
    });
  });

  setInterval(() => { broadcastNowPlaying().catch((err) => console.error(err)); }, 5000);

  const PORT = parseInt(process.env.PORT, 10) || 3030;
  httpServer.listen(PORT, () => {
    console.log(`Radio backend running at http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
