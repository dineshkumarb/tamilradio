/**
 * Artist CRUD and lookups (PostgreSQL).
 */

export function getArtistQueries(pool) {
  return {
    async getAll() {
      const { rows } = await pool.query(
        'SELECT id, slug, name, photo_url, source_url, music_path, theme, sort_order, created_at, updated_at FROM artists ORDER BY sort_order ASC, name ASC'
      );
      return rows;
    },

    async getBySlug(slug) {
      const { rows } = await pool.query(
        'SELECT id, slug, name, photo_url, source_url, music_path, theme, sort_order, created_at, updated_at FROM artists WHERE slug = $1',
        [slug]
      );
      return rows[0] ?? null;
    },

    async getById(id) {
      const { rows } = await pool.query(
        'SELECT id, slug, name, photo_url, source_url, music_path, theme, sort_order, created_at, updated_at FROM artists WHERE id = $1',
        [id]
      );
      return rows[0] ?? null;
    },

    async getSlugs() {
      const { rows } = await pool.query('SELECT slug FROM artists ORDER BY sort_order ASC, name ASC');
      return rows.map((r) => r.slug);
    },

    async getMusicPath(slug) {
      const { rows } = await pool.query('SELECT music_path FROM artists WHERE slug = $1', [slug]);
      const row = rows[0];
      return row?.music_path ?? null;
    },

    async create(artist) {
      const { rows } = await pool.query(
        `INSERT INTO artists (slug, name, photo_url, source_url, music_path, theme, sort_order, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, now())
         RETURNING id`,
        [
          artist.slug,
          artist.name,
          artist.photo_url ?? null,
          artist.source_url ?? null,
          artist.music_path ?? null,
          artist.theme ?? 'neutral',
          artist.sort_order ?? 0,
        ]
      );
      return rows[0].id;
    },

    async update(id, updates) {
      const allowed = ['slug', 'name', 'photo_url', 'source_url', 'music_path', 'theme', 'sort_order'];
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
      await pool.query(`UPDATE artists SET ${set.join(', ')} WHERE id = $${i}`, values);
    },

    async delete(id) {
      await pool.query('DELETE FROM artists WHERE id = $1', [id]);
    },

    async slugExists(slug, excludeId = null) {
      let rows;
      if (excludeId != null) {
        const r = await pool.query('SELECT 1 FROM artists WHERE slug = $1 AND id != $2', [slug, excludeId]);
        rows = r.rows;
      } else {
        const r = await pool.query('SELECT 1 FROM artists WHERE slug = $1', [slug]);
        rows = r.rows;
      }
      return rows.length > 0;
    },
  };
}
