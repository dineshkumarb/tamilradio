import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { getArtistTheme } from '../components/ArtistCard';

export default function AdminPage() {
  const { user, logout, isAdmin } = useAuth();
  const [artists, setArtists] = useState([]);

  useEffect(() => {
    api.artists.list().then(setArtists).catch(() => setArtists([]));
  }, []);

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
        <p className="text-neutral-400">Admin access required.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950">
      <header className="border-b border-white/5 px-4 py-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <h1 className="font-display text-2xl text-white">Admin</h1>
          <div className="flex items-center gap-4">
            <span className="text-neutral-500 text-sm">{user?.username}</span>
            <Link to="/" className="text-neutral-400 hover:text-white text-sm">
              ← Radio
            </Link>
            <button
              type="button"
              onClick={logout}
              className="text-neutral-400 hover:text-red-400 text-sm"
            >
              Logout
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <p className="text-neutral-400">Manage library and artists.</p>
          <Link
            to="/admin/artists"
            className="text-sm text-emerald-400 hover:text-emerald-300"
          >
            + Add artist
          </Link>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          {artists.map((a) => {
            const theme = getArtistTheme(a.slug, a.theme);
            return (
              <Link
                key={a.slug}
                to={`/library/${a.slug}`}
                className={`block rounded-xl p-6 border border-white/5 bg-gradient-to-b ${theme.cardClass} hover:opacity-90 transition`}
              >
                <h2 className={`font-display text-xl ${theme.accentClass}`}>{a.name}</h2>
                <p className="text-neutral-400 text-sm mt-1">Scan, edit, fetch metadata</p>
              </Link>
            );
          })}
        </div>
        <p className="mt-6">
          <Link to="/admin/artists" className="text-neutral-500 hover:text-white text-sm">
            Manage artists →
          </Link>
        </p>
      </main>
    </div>
  );
}
