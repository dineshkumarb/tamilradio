/**
 * PostgreSQL queries for songs and metadata cache.
 */

export function getDb(pool) {
  return {
    async getAllByArtist(artist) {
      const { rows } = await pool.query(
        'SELECT * FROM songs WHERE artist = $1 ORDER BY album, title',
        [artist]
      );
      return rows;
    },

    async getById(id) {
      const { rows } = await pool.query('SELECT * FROM songs WHERE id = $1', [id]);
      return rows[0] ?? null;
    },

    async getByFilePath(filePath) {
      const { rows } = await pool.query('SELECT * FROM songs WHERE file_path = $1', [filePath]);
      return rows[0] ?? null;
    },

    async insertSong(song) {
      const { rows } = await pool.query(
        `INSERT INTO songs (artist, file_path, title, album, year, genre, duration_seconds, album_art_base64, album_art_url, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())
         RETURNING id`,
        [
          song.artist,
          song.file_path,
          song.title ?? null,
          song.album ?? null,
          song.year ?? null,
          song.genre ?? null,
          song.duration_seconds ?? null,
          song.album_art_base64 ?? null,
          song.album_art_url ?? null,
        ]
      );
      return rows[0].id;
    },

    async updateSong(id, updates) {
      const allowed = ['title', 'album', 'year', 'genre', 'album_art_base64', 'album_art_url', 'duration_seconds'];
      const set = [];
      const values = [];
      let i = 1;
      for (const [k, v] of Object.entries(updates)) {
        if (allowed.includes(k)) {
          set.push(`${k} = $${i++}`);
          values.push(v ?? null);
        }
      }
      if (set.length === 0) return null;
      set.push('updated_at = now()');
      values.push(id);
      await pool.query(`UPDATE songs SET ${set.join(', ')} WHERE id = $${i}`, values);
      return { changes: 1 };
    },

    async deleteSong(id) {
      await pool.query('DELETE FROM songs WHERE id = $1', [id]);
    },

    async deleteByFilePath(filePath) {
      await pool.query('DELETE FROM songs WHERE file_path = $1', [filePath]);
    },

    async countByArtist(artist) {
      const { rows } = await pool.query('SELECT COUNT(*) as count FROM songs WHERE artist = $1', [artist]);
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
