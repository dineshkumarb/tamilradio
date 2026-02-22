import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useStreamContext } from '../context/StreamContext';

const API_BASE = import.meta.env.VITE_API_URL || '';

export default function ArtistsAdminPage() {
  const { refetchArtists } = useStreamContext();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', slug: '', photo_url: '', source_url: '', music_path: '', theme: 'neutral', sort_order: 0 });
  const [editingId, setEditingId] = useState(null);
  const [uploading, setUploading] = useState(false);

  const load = () => {
    setLoading(true);
    api.artists.list().then(setList).catch(() => setList([])).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const slugFromName = (name) => (name || '').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

  const handleSubmit = (e) => {
    e.preventDefault();
    const slug = form.slug || slugFromName(form.name);
    if (!slug || !form.name.trim()) return;
    if (editingId) {
      api.artists.update(editingId, { ...form, slug }).then(() => { setEditingId(null); setForm({ name: '', slug: '', photo_url: '', source_url: '', music_path: '', theme: 'neutral', sort_order: 0 }); load(); refetchArtists?.(); });
    } else {
      api.artists.create({ ...form, slug }).then(() => { setForm({ name: '', slug: '', photo_url: '', source_url: '', music_path: '', theme: 'neutral', sort_order: 0 }); load(); refetchArtists?.(); });
    }
  };

  const handlePhotoUpload = (slug, file) => {
    if (!file || !slug) return;
    setUploading(true);
    api.artists.uploadPhoto(slug, file).then(() => load()).finally(() => setUploading(false));
  };

  const handleDelete = (id, name) => {
    if (!window.confirm(`Delete artist "${name}"? You must remove all songs first.`)) return;
    api.artists.delete(id).then(() => { load(); refetchArtists?.(); }).catch((err) => alert(err.message));
  };

  return (
    <div className="min-h-screen bg-neutral-950">
      <header className="border-b border-white/5 px-4 py-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <h1 className="font-display text-2xl text-white">Artists</h1>
          <Link to="/admin" className="text-neutral-400 hover:text-white text-sm">← Admin</Link>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 py-8">
        <form onSubmit={handleSubmit} className="mb-8 p-6 rounded-xl bg-neutral-900 border border-white/5">
          <h2 className="text-lg font-medium text-white mb-4">{editingId ? 'Edit artist' : 'Add artist'}</h2>
          <div className="grid gap-4">
            <div>
              <label className="block text-sm text-neutral-400 mb-1">Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value, slug: f.slug || slugFromName(e.target.value) }))}
                className="w-full px-3 py-2 rounded-lg bg-neutral-800 border border-white/10 text-white"
                placeholder="e.g. Ilayaraja"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-neutral-400 mb-1">Slug (URL)</label>
              <input
                type="text"
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg bg-neutral-800 border border-white/10 text-white"
                placeholder="ilayaraja"
              />
            </div>
            <div>
              <label className="block text-sm text-neutral-400 mb-1">Photo URL</label>
              <input
                type="url"
                value={form.photo_url}
                onChange={(e) => setForm((f) => ({ ...f, photo_url: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg bg-neutral-800 border border-white/10 text-white"
                placeholder="https://..."
              />
            </div>
            <div>
              <label className="block text-sm text-neutral-400 mb-1">Source URL</label>
              <input
                type="url"
                value={form.source_url}
                onChange={(e) => setForm((f) => ({ ...f, source_url: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg bg-neutral-800 border border-white/10 text-white"
                placeholder="Optional link"
              />
            </div>
            <div>
              <label className="block text-sm text-neutral-400 mb-1">Music folder path</label>
              <input
                type="text"
                value={form.music_path}
                onChange={(e) => setForm((f) => ({ ...f, music_path: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg bg-neutral-800 border border-white/10 text-white"
                placeholder="/path/to/music"
              />
            </div>
            <div>
              <label className="block text-sm text-neutral-400 mb-1">Theme</label>
              <select
                value={form.theme}
                onChange={(e) => setForm((f) => ({ ...f, theme: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg bg-neutral-800 border border-white/10 text-white"
              >
                <option value="neutral">Neutral</option>
                <option value="ilayaraja">Ilayaraja (brown/gold)</option>
                <option value="arrahman">A.R. Rahman (blue/teal)</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-500">
                {editingId ? 'Update' : 'Add'}
              </button>
              {editingId && (
                <button type="button" onClick={() => { setEditingId(null); setForm({ name: '', slug: '', photo_url: '', source_url: '', music_path: '', theme: 'neutral', sort_order: 0 }); }} className="px-4 py-2 rounded-lg bg-neutral-600 text-white">
                  Cancel
                </button>
              )}
            </div>
          </div>
        </form>

        {uploading && <p className="text-neutral-400 text-sm mb-4">Uploading photo…</p>}
        {loading ? (
          <p className="text-neutral-400">Loading artists…</p>
        ) : (
          <ul className="space-y-4">
            {list.map((a) => (
              <li key={a.id} className="flex items-center gap-4 p-4 rounded-xl bg-neutral-900 border border-white/5">
                <div className="w-14 h-14 rounded-lg overflow-hidden bg-neutral-800 shrink-0">
                  {a.photo_url ? (
                    <img src={a.photo_url.startsWith('http') ? a.photo_url : `${API_BASE}${a.photo_url}`} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-neutral-500 font-display text-xl">{a.name?.charAt(0)}</div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-white">{a.name}</p>
                  <p className="text-neutral-400 text-sm">{a.slug}</p>
                  {a.music_path && <p className="text-neutral-500 text-xs truncate mt-1">{a.music_path}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <label className="cursor-pointer px-3 py-1.5 rounded-lg bg-neutral-700 text-neutral-300 text-sm hover:bg-neutral-600">
                    Upload photo
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(a.slug, f); e.target.value = ''; }}
                    />
                  </label>
                  <Link to={`/library/${a.slug}`} className="px-3 py-1.5 rounded-lg bg-neutral-700 text-neutral-300 text-sm hover:bg-neutral-600">Library</Link>
                  <button type="button" onClick={() => { setEditingId(a.id); setForm({ name: a.name, slug: a.slug, photo_url: a.photo_url || '', source_url: a.source_url || '', music_path: a.music_path || '', theme: a.theme || 'neutral', sort_order: a.sort_order || 0 }); }} className="px-3 py-1.5 rounded-lg bg-neutral-700 text-neutral-300 text-sm hover:bg-neutral-600">Edit</button>
                  <button type="button" onClick={() => handleDelete(a.id, a.name)} className="px-3 py-1.5 rounded-lg bg-red-900/50 text-red-300 text-sm hover:bg-red-900">Delete</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
