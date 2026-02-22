/**
 * One-off script to set or reset an admin password in the DB.
 * Use when the app is in production and you need to change the admin password
 * (e.g. after first deploy or if locked out).
 *
 * Run from backend directory:
 *   node scripts/change-admin-password.js <username> <newPassword>
 *
 * Example:
 *   node scripts/change-admin-password.js admin MyNewSecurePassword
 */

import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const [username, newPassword] = process.argv.slice(2);
if (!username || !newPassword) {
  console.error('Usage: node scripts/change-admin-password.js <username> <newPassword>');
  process.exit(1);
}
if (newPassword.length < 6) {
  console.error('Password must be at least 6 characters');
  process.exit(1);
}

const { openDb, getAuthDb } = await import('../src/db/index.js');
const { hashPassword } = await import('../src/db/authQueries.js');

await openDb();
const authDb = getAuthDb();
const user = await authDb.getByUsername(username);
if (!user) {
  console.error(`User "${username}" not found.`);
  process.exit(1);
}

await authDb.updatePassword(user.id, hashPassword(newPassword));
console.log(`Password updated for user "${username}".`);
