import { Router } from 'express';
import { getAuthDb } from '../db/index.js';
import { verifyPassword, hashPassword } from '../db/authQueries.js';
import { requireAuth } from '../middleware/auth.js';
import { signToken } from '../middleware/auth.js';

const router = Router();

router.post('/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'currentPassword and newPassword required' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  }
  const auth = getAuthDb();
  const user = await auth.getByUsername(req.user.username);
  if (!user || !verifyPassword(currentPassword, user.password_hash)) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }
  await auth.updatePassword(user.id, hashPassword(newPassword));
  res.json({ message: 'Password updated' });
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  const auth = getAuthDb();
  const user = await auth.getByUsername(username);
  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }
  const token = signToken({
    sub: user.id,
    username: user.username,
    role: user.role,
  });
  res.json({
    token,
    user: { username: user.username, role: user.role },
  });
});

export default router;
