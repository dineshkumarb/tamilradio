/**
 * PostgreSQL queries for media (unified table replacing old songs table).
 * Exposes the same function names used by streamManager, metadataService,
 * albumArtService, and library routes so all consumers work unchanged.
 */

export function getDb(pool) {
  return {
    async getAllByArtist(artistSlug) {
      const { rows } = await pool.query(
        `SELECT *, ROUND(duration)::int AS duration_seconds FROM media
         WHERE artist_slug = $1 ORDER BY album, track_number, title`,
        [artistSlug]
      );
      return rows;
    },

    async getById(id) {
      const { rows } = await pool.query(
        'SELECT *, ROUND(duration)::int AS duration_seconds FROM media WHERE id = $1',
        [id]
      );
      return rows[0] ?? null;
    },

    async getByFilePath(filePath) {
      const { rows } = await pool.query(
        'SELECT *, ROUND(duration)::int AS duration_seconds FROM media WHERE file_path = $1',
        [filePath]
      );
      return rows[0] ?? null;
    },

    async insertSong(song) {
      const { rows } = await pool.query(
        `INSERT INTO media (artist_slug, artist, file_path, title, album, year, genre,
                            duration, album_art_base64, album_art_url, date_indexed)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now())
         ON CONFLICT (file_path) DO UPDATE SET
           artist_slug     = EXCLUDED.artist_slug,
           artist          = EXCLUDED.artist,
           title           = EXCLUDED.title,
           album           = EXCLUDED.album,
           year            = EXCLUDED.year,
           genre           = EXCLUDED.genre,
           duration        = EXCLUDED.duration,
           album_art_base64= COALESCE(EXCLUDED.album_art_base64, media.album_art_base64),
           album_art_url   = COALESCE(EXCLUDED.album_art_url, media.album_art_url),
           date_indexed    = now()
         RETURNING id`,
        [
          song.artist_slug ?? song.artist ?? null,
          song.artist ?? song.artist_slug ?? null,
          song.file_path,
          song.title ?? null,
          song.album ?? null,
          song.year ?? null,
          song.genre ?? null,
          song.duration_seconds ?? song.duration ?? null,
          song.album_art_base64 ?? null,
          song.album_art_url ?? null,
        ]
      );
      return rows[0].id;
    },

    async updateSong(id, updates) {
      const allowed = [
        'title', 'album', 'year', 'genre',
        'album_art_base64', 'album_art_url',
        'duration', 'duration_seconds',
        'artist', 'artist_slug',
        'bitrate', 'sample_rate', 'file_size',
      ];
      const set = [];
      const values = [];
      let i = 1;
      for (const [k, v] of Object.entries(updates)) {
        if (k === 'duration_seconds') {
          set.push(`duration = $${i++}`);
          values.push(v ?? null);
        } else if (allowed.includes(k)) {
          set.push(`${k} = $${i++}`);
          values.push(v ?? null);
        }
      }
      if (set.length === 0) return null;
      set.push('date_indexed = now()');
      values.push(id);
      await pool.query(`UPDATE media SET ${set.join(', ')} WHERE id = $${i}`, values);
      return { changes: 1 };
    },

    async deleteSong(id) {
      await pool.query('DELETE FROM media WHERE id = $1', [id]);
    },

    async deleteByFilePath(filePath) {
      await pool.query('DELETE FROM media WHERE file_path = $1', [filePath]);
    },

    async countByArtist(artistSlug) {
      const { rows } = await pool.query(
        'SELECT COUNT(*) as count FROM media WHERE artist_slug = $1',
        [artistSlug]
      );
      return parseInt(rows[0].count, 10);
    },

    async getMetadataCache(cacheKey) {
      const { rows } = await pool.query('SELECT * FROM metadata_cache WHERE cache_key = $1', [cacheKey]);
      return rows[0] ?? null;
    },

    async setMetadataCache(entry) {
      await pool.query(
        `INSERT INTO metadata_cache (cache_key, title, album, year, genre, album_art_url, raw_json, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, now())
         ON CONFLICT(cache_key) DO UPDATE SET
           title = EXCLUDED.title,
           album = EXCLUDED.album,
           year = EXCLUDED.year,
           genre = EXCLUDED.genre,
           album_art_url = EXCLUDED.album_art_url,
           raw_json = EXCLUDED.raw_json,
           created_at = now()`,
        [
          entry.cache_key,
          entry.title ?? null,
          entry.album ?? null,
          entry.year ?? null,
          entry.genre ?? null,
          entry.album_art_url ?? null,
          entry.raw_json ?? null,
        ]
      );
    },
  };
}
