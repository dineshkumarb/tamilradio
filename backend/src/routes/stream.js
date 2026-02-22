import { Router } from 'express';
import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import {
  getState,
  startStream,
  stopStream,
  skipToNext,
  getStreamPath,
} from '../services/streamManager.js';
import { broadcastNowPlaying } from '../services/socketBroadcast.js';

const router = Router();

router.post('/start/:artist', async (req, res) => {
  const artist = (req.params.artist || '').toLowerCase();
  const result = await startStream(artist);
  if (!result.ok) {
    return res.status(400).json({ error: result.error });
  }
  await broadcastNowPlaying(artist);
  res.json({ status: result.state.status, currentSong: result.state.currentSong });
});

router.post('/stop/:artist', async (req, res) => {
  const artist = (req.params.artist || '').toLowerCase();
  const result = await stopStream(artist);
  if (!result.ok) {
    return res.status(400).json({ error: result.error });
  }
  await broadcastNowPlaying(artist);
  res.json({ status: 'stopped' });
});

router.get('/status/:artist', async (req, res) => {
  const artist = (req.params.artist || '').toLowerCase();
  const state = await getState(artist);
  if (!state) {
    return res.status(400).json({ error: 'Invalid artist' });
  }
  res.json({
    status: state.status,
    currentSong: state.currentSong,
    queueLength: state.queue.length,
  });
});

router.post('/skip/:artist', async (req, res) => {
  const artist = (req.params.artist || '').toLowerCase();
  const result = await skipToNext(artist);
  if (!result.ok) {
    return res.status(400).json({ error: result.error });
  }
  await broadcastNowPlaying(artist);
  res.json({ status: result.state.status, currentSong: result.state.currentSong });
});

// Stream current song as audio (client uses this as <audio src>). Supports Range for iOS.
router.get('/audio/:artist', async (req, res) => {
  const artist = (req.params.artist || '').toLowerCase();
  const filePath = getStreamPath(artist);
  if (!filePath) {
    return res.status(404).send('No current track');
  }
  const streamState = await getState(artist);
  const p = (streamState?.currentSong?.file_path || '').toLowerCase();
  const contentType = p.endsWith('.flac') ? 'audio/flac' : p.endsWith('.wav') ? 'audio/wav' : 'audio/mpeg';
  res.setHeader('Content-Type', contentType);
  res.setHeader('Accept-Ranges', 'bytes');

  let size;
  try {
    size = (await stat(filePath)).size;
  } catch (_) {
    return res.status(404).send('File not found');
  }
  const range = req.headers.range;
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    const start = match ? (match[1] !== '' ? parseInt(match[1], 10) : 0) : 0;
    const end = match && match[2] !== '' ? parseInt(match[2], 10) : size - 1;
    const len = end - start + 1;
    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
    res.setHeader('Content-Length', len);
    const stream = createReadStream(filePath, { start, end });
    stream.pipe(res);
    stream.on('error', () => { try { res.end(); } catch (_) {} });
    return;
  }
  res.setHeader('Content-Length', size);
  const stream = createReadStream(filePath);
  stream.pipe(res);
  stream.on('error', () => { try { res.end(); } catch (_) {} });
});

export default router;
