import { useState } from 'react';
import AlbumArt from './AlbumArt';

const ARTIST_NAMES = { ilayaraja: 'Ilayaraja', arrahman: 'A.R. Rahman' };

export default function LibraryTable({
  artist,
  songs,
  onScan,
  onDelete,
  onUpdate,
  onFetchMetadata,
  scanLoading,
}) {
  const [filter, setFilter] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  const filtered = songs.filter(
    (s) =>
      !filter ||
      [s.title, s.album, s.genre].some((v) => v && String(v).toLowerCase().includes(filter.toLowerCase()))
  );

  const handleSave = (id) => {
    onUpdate(id, editForm);
    setEditingId(null);
    setEditForm({});
  };

  const artistName = ARTIST_NAMES[artist] || artist;

  return (
    <div className="rounded-2xl bg-neutral-900/50 border border-white/5 overflow-hidden">
      <div className="p-4 flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center">
        <input
          type="search"
          placeholder="Search by title, album, genre…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="flex-1 min-w-0 px-4 py-2 rounded-lg bg-neutral-800 border border-white/5 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
        />
        <button
          onClick={() => onScan(artist)}
          disabled={scanLoading}
          className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-500 disabled:opacity-50"
        >
          {scanLoading ? 'Scanning…' : 'Scan library'}
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-white/5 text-neutral-400 text-sm">
              <th className="p-3 w-12">#</th>
              <th className="p-3">Title</th>
              <th className="p-3 hidden sm:table-cell">Album</th>
              <th className="p-3 hidden md:table-cell">Year</th>
              <th className="p-3">Duration</th>
              <th className="p-3 w-20">Art</th>
              <th className="p-3 w-32">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((song, idx) => (
              <tr key={song.id} className="border-b border-white/5 hover:bg-white/5">
                <td className="p-3 text-neutral-500">{idx + 1}</td>
                <td className="p-3">
                  {editingId === song.id ? (
                    <input
                      value={editForm.title ?? song.title ?? ''}
                      onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                      className="w-full px-2 py-1 rounded bg-neutral-800 text-white text-sm"
                    />
                  ) : (
                    <span className="font-medium">{song.title || '—'}</span>
                  )}
                </td>
                <td className="p-3 hidden sm:table-cell">
                  {editingId === song.id ? (
                    <input
                      value={editForm.album ?? song.album ?? ''}
                      onChange={(e) => setEditForm((f) => ({ ...f, album: e.target.value }))}
                      className="w-full px-2 py-1 rounded bg-neutral-800 text-white text-sm"
                    />
                  ) : (
                    song.album || '—'
                  )}
                </td>
                <td className="p-3 hidden md:table-cell">
                  {editingId === song.id ? (
                    <input
                      type="number"
                      value={editForm.year ?? song.year ?? ''}
                      onChange={(e) => setEditForm((f) => ({ ...f, year: e.target.value ? parseInt(e.target.value, 10) : undefined }))}
                      className="w-20 px-2 py-1 rounded bg-neutral-800 text-white text-sm"
                    />
                  ) : (
                    song.year || '—'
                  )}
                </td>
                <td className="p-3 text-neutral-400 text-sm">
                  {song.duration_seconds != null
                    ? `${Math.floor(song.duration_seconds / 60)}:${String(song.duration_seconds % 60).padStart(2, '0')}`
                    : '—'}
                </td>
                <td className="p-3">
                  {(song.album_art_base64 || song.album_art_url) ? (
                    <span className="text-emerald-400 text-xs">Yes</span>
                  ) : (
                    <span className="text-neutral-500 text-xs">No</span>
                  )}
                </td>
                <td className="p-3 flex gap-1">
                  {editingId === song.id ? (
                    <>
                      <button
                        onClick={() => handleSave(song.id)}
                        className="px-2 py-1 rounded bg-emerald-600 text-white text-xs"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => { setEditingId(null); setEditForm({}); }}
                        className="px-2 py-1 rounded bg-neutral-600 text-white text-xs"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => { setEditingId(song.id); setEditForm({}); }}
                        className="px-2 py-1 rounded bg-neutral-600 text-white text-xs hover:bg-neutral-500"
                        title="Edit"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => onFetchMetadata(song.id, artistName, song.title)}
                        className="px-2 py-1 rounded bg-amber-600/80 text-white text-xs hover:bg-amber-500"
                        title="Fetch metadata"
                      >
                        Fetch
                      </button>
                      <button
                        onClick={() => onDelete(song.id)}
                        className="px-2 py-1 rounded bg-red-600/80 text-white text-xs hover:bg-red-500"
                        title="Remove"
                      >
                        Del
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filtered.length === 0 && (
        <div className="p-8 text-center text-neutral-500">
          {songs.length === 0 ? 'No songs. Use “Scan library” after setting your music path in .env.' : 'No matches.'}
        </div>
      )}
    </div>
  );
}
