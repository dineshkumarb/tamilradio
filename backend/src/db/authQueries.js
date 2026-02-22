import crypto from 'crypto';
import pg from 'pg';

const SALT = 'tamil-radio-v1';
const ITERATIONS = 100000;
const KEYLEN = 64;

export function hashPassword(password) {
  return crypto.pbkdf2Sync(password, SALT, ITERATIONS, KEYLEN, 'sha256').toString('hex');
}

export function verifyPassword(password, hash) {
  return hashPassword(password) === hash;
}

export function getAuthQueries(pool) {
  return {
    async getByUsername(username) {
      const { rows } = await pool.query(
        'SELECT id, username, password_hash, role FROM users WHERE username = $1',
        [username]
      );
      return rows[0] ?? null;
    },

    async createUser(username, passwordHash, role = 'admin') {
      await pool.query(
        'INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3)',
        [username, passwordHash, role]
      );
    },

    async ensureAdmin(username, password) {
      const { rows } = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
      if (rows.length > 0) return;
      const hash = hashPassword(password);
      await pool.query(
        'INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3)',
        [username, hash, 'admin']
      );
    },

    async updatePassword(userId, newPasswordHash) {
      await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newPasswordHash, userId]);
    },
  };
}
