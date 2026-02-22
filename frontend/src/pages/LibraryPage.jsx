import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { io } from 'socket.io-client';
import LibraryTable from '../components/LibraryTable';
import { api } from '../api/client';
import { getArtistTheme } from '../components/ArtistCard';
import { useStreamContext } from '../context/StreamContext';

const apiOrigin = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' ? window.location.origin : '');

export default function LibraryPage() {
  const { artist } = useParams();
  const normalized = (artist || '').toLowerCase();
  const { artists } = useStreamContext();
  const artistRow = artists?.find((a) => a.slug === normalized);
  const config = artistRow ? getArtistTheme(normalized, artistRow.theme) : getArtistTheme(normalized, 'neutral');
  const displayName = artistRow?.name || normalized;

  const [songs, setSongs] = useState([]);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanProgress, setScanProgress] = useState(null);
  const [scanSummary, setScanSummary] = useState(null);
  const [error, setError] = useState(null);
  const socketRef = useRef(null);

  useEffect(() => {
    const socket = io(apiOrigin, { path: '/socket.io', autoConnect: true });
    socketRef.current = socket;

    socket.on('scan:progress', (data) => {
      if (scanLoading) setScanProgress(data);
    });
    socket.on('scan:complete', (data) => {
      if (scanLoading) {
        setScanSummary(data);
        setScanLoading(false);
        setScanProgress(null);
        loadSongs();
      }
    });

    return () => { socket.disconnect(); };
  }, [scanLoading]);

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
    setScanProgress(null);
    setScanSummary(null);
    setError(null);
    try {
      const result = await api.library.scan(normalized);
      await loadSongs();
      setScanSummary(result);
      if (result.parseErrorCount > 0) {
        const summary = result.parseErrors.slice(0, 5).map((e) => e.error).join('; ');
        setError(`${result.parseErrorCount} file(s) could not be read: ${summary}${result.parseErrorCount > 5 ? '…' : ''}`);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setScanLoading(false);
      setScanProgress(null);
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
      <main className="max-w-5xl mx-auto px-4 py-6 space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Scan progress bar */}
        {scanLoading && scanProgress && (
          <div className="rounded-xl bg-neutral-800/50 border border-white/5 p-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-neutral-300 truncate max-w-[70%]">{scanProgress.file}</span>
              <span className="text-neutral-400">{scanProgress.current} / {scanProgress.total} ({scanProgress.percent}%)</span>
            </div>
            <div className="w-full bg-neutral-700 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-200"
                style={{ width: `${scanProgress.percent}%` }}
              />
            </div>
          </div>
        )}

        {/* Scan summary */}
        {scanSummary && (
          <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3 flex items-center justify-between">
            <span className="text-emerald-300 text-sm">
              {scanSummary.added} added, {scanSummary.removed ?? 0} removed, {scanSummary.updated} updated. {scanSummary.total} total.
            </span>
            <button onClick={() => setScanSummary(null)} className="text-neutral-400 hover:text-white text-sm ml-4">Dismiss</button>
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
