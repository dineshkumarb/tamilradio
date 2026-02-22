/**
 * PostgreSQL schema for media library, artists, and metadata cache.
 * The unified `media` table replaces the old `songs` table.
 */

export async function initSchema(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin' CHECK(role IN ('admin', 'user')),
      created_at TIMESTAMPTZ DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS artists (
      id SERIAL PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      photo_url TEXT,
      source_url TEXT,
      music_path TEXT,
      theme TEXT DEFAULT 'neutral' CHECK(theme IN ('ilayaraja', 'arrahman', 'neutral')),
      sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_artists_slug ON artists(slug);
    CREATE INDEX IF NOT EXISTS idx_artists_sort ON artists(sort_order);

    CREATE TABLE IF NOT EXISTS metadata_cache (
      id SERIAL PRIMARY KEY,
      cache_key TEXT NOT NULL UNIQUE,
      title TEXT,
      album TEXT,
      year INTEGER,
      genre TEXT,
      album_art_url TEXT,
      raw_json TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_metadata_cache_key ON metadata_cache(cache_key);

    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS library_roots (
      id SERIAL PRIMARY KEY,
      path TEXT NOT NULL UNIQUE,
      label TEXT,
      artist_slug TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS media (
      id SERIAL PRIMARY KEY,
      file_path TEXT NOT NULL UNIQUE,
      title TEXT,
      artist TEXT,
      artist_slug TEXT,
      album TEXT,
      album_artist TEXT,
      genre TEXT,
      year INTEGER,
      track_number INTEGER,
      duration REAL,
      bitrate INTEGER,
      sample_rate INTEGER,
      file_size BIGINT,
      last_modified TIMESTAMPTZ,
      album_art_base64 TEXT,
      album_art_url TEXT,
      date_indexed TIMESTAMPTZ DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_media_artist ON media(artist);
    CREATE INDEX IF NOT EXISTS idx_media_artist_slug ON media(artist_slug);
    CREATE INDEX IF NOT EXISTS idx_media_album ON media(album);
    CREATE INDEX IF NOT EXISTS idx_media_genre ON media(genre);
    CREATE INDEX IF NOT EXISTS idx_media_title ON media(title);
  `);

  await runMigrations(pool);
  await seedArtists(pool);
}

async function runMigrations(pool) {
  const run = async (name, fn) => {
    const { rows } = await pool.query('SELECT 1 FROM schema_migrations WHERE name = $1', [name]);
    if (rows.length > 0) return;
    await fn(pool);
    await pool.query('INSERT INTO schema_migrations (name) VALUES ($1)', [name]);
  };

  await run('001_artists_table', () => Promise.resolve());
  await run('002_songs_drop_artist_check', () => Promise.resolve());

  await run('003_merge_songs_into_media', async (p) => {
    // Add new columns to media if they don't exist (for DBs created before this migration)
    const addCol = async (col, type) => {
      try { await p.query(`ALTER TABLE media ADD COLUMN ${col} ${type}`); } catch (_) {}
    };
    await addCol('artist_slug', 'TEXT');
    await addCol('album_art_base64', 'TEXT');
    await addCol('album_art_url', 'TEXT');

    // Add artist_slug to library_roots if missing
    try { await p.query('ALTER TABLE library_roots ADD COLUMN artist_slug TEXT'); } catch (_) {}

    // Migrate songs → media if songs table exists
    const { rows } = await p.query(`
      SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'songs')
    `);
    if (rows[0]?.exists) {
      await p.query(`
        INSERT INTO media (file_path, title, artist, artist_slug, album, genre, year, duration, album_art_base64, album_art_url, date_indexed)
        SELECT file_path, title, artist, artist, album, genre, year, duration_seconds::real, album_art_base64, album_art_url, COALESCE(created_at, now())
        FROM songs
        ON CONFLICT (file_path) DO UPDATE SET
          artist_slug = COALESCE(media.artist_slug, EXCLUDED.artist_slug)
      `);
      await p.query('DROP TABLE songs');
    }

    await p.query('CREATE INDEX IF NOT EXISTS idx_media_artist_slug ON media(artist_slug)');
  });
}

async function seedArtists(pool) {
  const env = (key) => (process.env[key] || '').trim();
  const defaults = [
    {
      slug: 'ilayaraja',
      name: 'Ilayaraja',
      photo_url: 'https://upload.wikimedia.org/wikipedia/commons/2/2f/Ilaiyaraaja_at_the_TFPC_Press_Meet_Held_Ahead_Of_The_%E2%80%98Ilaiyaraaja_75%E2%80%99_Concert.jpg',
      source_url: '',
      music_path: env('ILAYARAJA_MUSIC_PATH') || null,
      theme: 'ilayaraja',
      sort_order: 0,
    },
    {
      slug: 'arrahman',
      name: 'A.R. Rahman',
      photo_url: 'https://upload.wikimedia.org/wikipedia/commons/0/07/A._R._Rahman.jpg',
      source_url: '',
      music_path: env('ARRAHMAN_MUSIC_PATH') || null,
      theme: 'arrahman',
      sort_order: 1,
    },
  ];
  for (const a of defaults) {
    await pool.query(`
      INSERT INTO artists (slug, name, photo_url, source_url, music_path, theme, sort_order, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, now())
      ON CONFLICT(slug) DO UPDATE SET
        name = EXCLUDED.name,
        photo_url = COALESCE(EXCLUDED.photo_url, artists.photo_url),
        source_url = COALESCE(NULLIF(EXCLUDED.source_url, ''), artists.source_url),
        music_path = COALESCE(EXCLUDED.music_path, artists.music_path),
        theme = EXCLUDED.theme,
        sort_order = EXCLUDED.sort_order,
        updated_at = now()
    `, [a.slug, a.name, a.photo_url, a.source_url || null, a.music_path, a.theme, a.sort_order]);
  }
}
