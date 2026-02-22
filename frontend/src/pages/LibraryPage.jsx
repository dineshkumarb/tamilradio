import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import LibraryTable from '../components/LibraryTable';
import { api } from '../api/client';
import { getArtistTheme } from '../components/ArtistCard';
import { useStreamContext } from '../context/StreamContext';

export default function LibraryPage() {
  const { artist } = useParams();
  const normalized = (artist || '').toLowerCase();
  const { artists } = useStreamContext();
  const artistRow = artists?.find((a) => a.slug === normalized);
  const config = artistRow ? getArtistTheme(normalized, artistRow.theme) : getArtistTheme(normalized, 'neutral');
  const displayName = artistRow?.name || normalized;

  const [songs, setSongs] = useState([]);
  const [scanLoading, setScanLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadSongs = useCallback(async () => {
    setError(null);
    try {
      const list = await api.library.list(normalized);
      setSongs(list);
    } catch (err) {
      setError(err.message);
    }
  }, [normalized]);

  useEffect(() => {
    loadSongs();
  }, [loadSongs]);

  const handleScan = async () => {
    setScanLoading(true);
    setError(null);
    try {
      const result = await api.library.scan(normalized);
      await loadSongs();
      if (result.parseErrorCount > 0) {
        const summary = result.parseErrors.slice(0, 5).map((e) => e.error).join('; ');
        setError(`${result.parseErrorCount} file(s) could not be read: ${summary}${result.parseErrorCount > 5 ? '…' : ''}`);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setScanLoading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.library.delete(id);
      setSongs((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      setError(err.message);
    }
  };

  const handleUpdate = async (id, data) => {
    try {
      const updated = await api.library.update(id, data);
      setSongs((prev) => prev.map((s) => (s.id === id ? { ...s, ...updated } : s)));
    } catch (err) {
      setError(err.message);
    }
  };

  const handleFetchMetadata = async (id, artistName, title) => {
    try {
      await api.library.fetchMetadata(id, artistName, title);
      await loadSongs();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className={`min-h-screen ${artistRow?.theme === 'ilayaraja' ? 'bg-ilayaraja-bg' : artistRow?.theme === 'arrahman' ? 'bg-arrahman-bg' : 'bg-neutral-950'}`}>
      <header className="border-b border-white/5 px-4 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link to="/admin" className="text-neutral-400 hover:text-white text-sm">
            ← Admin
          </Link>
          <h1 className={`font-display text-xl ${config.accentClass}`}>
            {displayName} — Library
          </h1>
          <span className="text-neutral-500 text-sm">{songs.length} songs</span>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-6">
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 text-red-400 text-sm">
            {error}
          </div>
        )}
        <LibraryTable
          artist={normalized}
          songs={songs}
          onScan={handleScan}
          onDelete={handleDelete}
          onUpdate={handleUpdate}
          onFetchMetadata={handleFetchMetadata}
          scanLoading={scanLoading}
        />
      </main>
    </div>
  );
}
