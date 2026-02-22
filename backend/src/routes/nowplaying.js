import { Router } from 'express';
import { getCurrentSong, getQueue } from '../services/streamManager.js';

const router = Router();

router.get('/:artist', (req, res) => {
  const artist = (req.params.artist || '').toLowerCase();
  const current = getCurrentSong(artist);
  const queue = getQueue(artist);
  res.json({
    current: current,
    queue,
  });
});

export default router;
