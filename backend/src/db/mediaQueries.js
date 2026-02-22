/**
 * PostgreSQL queries for the local media library and library root directories.
 */

export function getMediaDb(pool) {
  return {
    // ── Library Roots ──────────────────────────────────────────────

    async getRoots() {
      const { rows } = await pool.query('SELECT * FROM library_roots ORDER BY label, path');
      return rows;
    },

    async addRoot(rootPath, label) {
      const { rows } = await pool.query(
        'INSERT INTO library_roots (path, label) VALUES ($1, $2) ON CONFLICT (path) DO UPDATE SET label = EXCLUDED.label RETURNING *',
        [rootPath, label || null]
      );
      return rows[0];
    },

    async removeRoot(id) {
      await pool.query('DELETE FROM library_roots WHERE id = $1', [id]);
    },

    // ── Media CRUD ─────────────────────────────────────────────────

    async upsertMedia(row) {
      const { rows } = await pool.query(
        `INSERT INTO media (file_path, title, artist, album, album_artist, genre, year,
                            track_number, duration, bitrate, sample_rate, file_size, last_modified, date_indexed)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13, now())
         ON CONFLICT (file_path) DO UPDATE SET
           title        = EXCLUDED.title,
           artist       = EXCLUDED.artist,
           album        = EXCLUDED.album,
           album_artist = EXCLUDED.album_artist,
           genre        = EXCLUDED.genre,
           year         = EXCLUDED.year,
           track_number = EXCLUDED.track_number,
           duration     = EXCLUDED.duration,
           bitrate      = EXCLUDED.bitrate,
           sample_rate  = EXCLUDED.sample_rate,
           file_size    = EXCLUDED.file_size,
           last_modified= EXCLUDED.last_modified,
           date_indexed = now()
         RETURNING id`,
        [
          row.file_path,
          row.title ?? null,
          row.artist ?? null,
          row.album ?? null,
          row.album_artist ?? null,
          row.genre ?? null,
          row.year ?? null,
          row.track_number ?? null,
          row.duration ?? null,
          row.bitrate ?? null,
          row.sample_rate ?? null,
          row.file_size ?? null,
          row.last_modified ?? null,
        ]
      );
      return rows[0].id;
    },

    async getByFilePath(filePath) {
      const { rows } = await pool.query('SELECT * FROM media WHERE file_path = $1', [filePath]);
      return rows[0] ?? null;
    },

    async deleteByFilePath(filePath) {
      await pool.query('DELETE FROM media WHERE file_path = $1', [filePath]);
    },

    async removeStaleFiles(validPaths) {
      if (validPaths.size === 0) {
        const { rowCount } = await pool.query('DELETE FROM media');
        return rowCount;
      }
      const arr = [...validPaths];
      const { rowCount } = await pool.query(
        'DELETE FROM media WHERE file_path != ALL($1::text[])',
        [arr]
      );
      return rowCount;
    },

    // ── Search & Filter (index-backed) ────────────────────────────

    async searchByTitle(query) {
      const { rows } = await pool.query(
        'SELECT * FROM media WHERE title ILIKE $1 ORDER BY title',
        [`%${query}%`]
      );
      return rows;
    },

    async getByArtist(artist) {
      const { rows } = await pool.query(
        'SELECT * FROM media WHERE artist ILIKE $1 ORDER BY album, track_number, title',
        [`%${artist}%`]
      );
      return rows;
    },

    async getByAlbum(album) {
      const { rows } = await pool.query(
        'SELECT * FROM media WHERE album ILIKE $1 ORDER BY track_number, title',
        [`%${album}%`]
      );
      return rows;
    },

    async getByGenre(genre) {
      const { rows } = await pool.query(
        'SELECT * FROM media WHERE genre ILIKE $1 ORDER BY artist, album, title',
        [`%${genre}%`]
      );
      return rows;
    },

    async getAllTracks(limit = 500, offset = 0) {
      const { rows } = await pool.query(
        'SELECT * FROM media ORDER BY artist, album, track_number, title LIMIT $1 OFFSET $2',
        [limit, offset]
      );
      return rows;
    },

    async search(query, limit = 200) {
      const pattern = `%${query}%`;
      const { rows } = await pool.query(
        `SELECT * FROM media
         WHERE title ILIKE $1 OR artist ILIKE $1 OR album ILIKE $1 OR genre ILIKE $1
         ORDER BY artist, album, track_number, title
         LIMIT $2`,
        [pattern, limit]
      );
      return rows;
    },

    async getStats() {
      const { rows } = await pool.query(`
        SELECT
          COUNT(*)::int                          AS total_tracks,
          COUNT(DISTINCT artist)::int            AS total_artists,
          COUNT(DISTINCT album)::int             AS total_albums,
          COALESCE(SUM(file_size), 0)::bigint    AS total_size,
          COALESCE(SUM(duration), 0)::real       AS total_duration
        FROM media
      `);
      return rows[0];
    },

    async getDistinctArtists() {
      const { rows } = await pool.query(
        "SELECT DISTINCT artist FROM media WHERE artist IS NOT NULL AND artist != '' ORDER BY artist"
      );
      return rows.map((r) => r.artist);
    },

    async getDistinctAlbums() {
      const { rows } = await pool.query(
        "SELECT DISTINCT album FROM media WHERE album IS NOT NULL AND album != '' ORDER BY album"
      );
      return rows.map((r) => r.album);
    },

    async getDistinctGenres() {
      const { rows } = await pool.query(
        "SELECT DISTINCT genre FROM media WHERE genre IS NOT NULL AND genre != '' ORDER BY genre"
      );
      return rows.map((r) => r.genre);
    },

    async getCount() {
      const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM media');
      return rows[0].count;
    },
  };
}
