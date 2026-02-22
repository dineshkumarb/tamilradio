import pg from 'pg';
import { initSchema } from './schema.js';
import { getDb } from './queries.js';
import { getAuthQueries } from './authQueries.js';
import { getArtistQueries } from './artistQueries.js';

const { Pool } = pg;

function getConnectionConfig() {
  if (process.env.DATABASE_URL) {
    return { connectionString: process.env.DATABASE_URL };
  }
  return {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
    database: process.env.POSTGRES_DB || 'tamilradio',
    user: process.env.POSTGRES_USER || 'tamilradio',
    password: process.env.POSTGRES_PASSWORD || 'tamilradio',
  };
}

let pool;
let schemaInitialized = false;

export async function openDb() {
  if (pool) {
    if (!schemaInitialized) {
      await initSchema(pool);
      schemaInitialized = true;
    }
    return pool;
  }
  pool = new Pool(getConnectionConfig());
  await initSchema(pool);
  schemaInitialized = true;
  return pool;
}

export function getDbQueries() {
  if (!pool) throw new Error('Database not initialized. Call await openDb() first.');
  return getDb(pool);
}

export function getAuthDb() {
  if (!pool) throw new Error('Database not initialized. Call await openDb() first.');
  return getAuthQueries(pool);
}

export function getArtistDb() {
  if (!pool) throw new Error('Database not initialized. Call await openDb() first.');
  return getArtistQueries(pool);
}
