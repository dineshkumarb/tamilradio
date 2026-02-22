import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { io } from 'socket.io-client';
import { api } from '../api/client';

const apiOrigin = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' ? window.location.origin : '');

function formatDuration(sec) {
  if (sec == null) return '—';
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatSize(bytes) {
  if (bytes == null) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

// ── Directory Browser Modal ─────────────────────────────────────

function DirectoryBrowser({ onSelect, onClose }) {
  const [current, setCurrent] = useState('');
  const [parent, setParent] = useState(null);
  const [dirs, setDirs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const browse = useCallback(async (dirPath) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.media.browse(dirPath);
      setCurrent(data.current);
      setParent(data.parent);
      setDirs(data.directories);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { browse(''); }, [browse]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-neutral-900 border border-white/10 rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col shadow-2xl">
        <div className="p-4 border-b border-white/5">
          <h2 className="text-white font-display text-lg">Select Directory</h2>
          <p className="text-neutral-400 text-sm mt-1 truncate">{current || '/'}</p>
        </div>

        {error && <div className="mx-4 mt-3 p-2 rounded bg-red-500/10 text-red-400 text-sm">{error}</div>}

        <div className="flex-1 overflow-y-auto p-2 min-h-0">
          {parent && (
            <button
              onClick={() => browse(parent)}
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/5 text-neutral-300 text-sm flex items-center gap-2"
            >
              <span className="text-neutral-500">↑</span> ..
            </button>
          )}
          {loading ? (
            <div className="p-4 text-center text-neutral-500">Loading…</div>
          ) : dirs.length === 0 ? (
            <div className="p-4 text-center text-neutral-500">No subdirectories</div>
          ) : (
            dirs.map((d) => (
              <button
                key={d.path}
                onClick={() => browse(d.path)}
                className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/5 text-neutral-200 text-sm flex items-center gap-2"
              >
                <span className="text-emerald-400">📁</span> {d.name}
              </button>
            ))
          )}
        </div>

        <div className="p-4 border-t border-white/5 flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-neutral-700 text-white text-sm hover:bg-neutral-600"
          >
            Cancel
          </button>
          <button
            onClick={() => { onSelect(current); onClose(); }}
            className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500"
          >
            Select this folder
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Scan Progress Bar ──────────────────────────────────────────

function ScanProgress({ progress, status }) {
  if (!status) return null;

  return (
    <div className="rounded-xl bg-neutral-800/50 border border-white/5 p-4">
      {status.phase === 'discovering' && (
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-neutral-300 text-sm">{status.message}</span>
        </div>
      )}

      {progress && (
        <>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-neutral-300 truncate max-w-[70%]">{progress.file}</span>
            <span className="text-neutral-400">{progress.current} / {progress.total} ({progress.percent}%)</span>
          </div>
          <div className="w-full bg-neutral-700 rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-200"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
        </>
      )}
    </div>
  );
}

// ── Summary Banner ─────────────────────────────────────────────

function ScanSummary({ summary, onDismiss }) {
  if (!summary) return null;
  return (
    <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4 flex items-center justify-between">
      <span className="text-emerald-300 text-sm">
        Scan complete — {summary.added} added, {summary.removed} removed, {summary.updated} updated, {summary.skipped} unchanged. {summary.total} total tracks.
        {summary.errors > 0 && ` (${summary.errors} errors)`}
      </span>
      <button onClick={onDismiss} className="text-neutral-400 hover:text-white text-sm ml-4">Dismiss</button>
    </div>
  );
}

// ── Stats Cards ────────────────────────────────────────────────

function StatsBar({ stats }) {
  if (!stats) return null;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {[
        { label: 'Tracks', value: stats.total_tracks },
        { label: 'Artists', value: stats.total_artists },
        { label: 'Albums', value: stats.total_albums },
        { label: 'Total Size', value: formatSize(Number(stats.total_size)) },
      ].map(({ label, value }) => (
        <div key={label} className="rounded-xl bg-neutral-800/50 border border-white/5 p-3 text-center">
          <div className="text-xl font-bold text-white">{value}</div>
          <div className="text-neutral-400 text-xs mt-0.5">{label}</div>
        </div>
      ))}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────

export default function MediaLibraryPage() {
  const [roots, setRoots] = useState([]);
  const [showBrowser, setShowBrowser] = useState(false);
  const [tracks, setTracks] = useState([]);
  const [stats, setStats] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterValue, setFilterValue] = useState('');
  const [filterOptions, setFilterOptions] = useState([]);
  const [scanRunning, setScanRunning] = useState(false);
  const [scanProgress, setScanProgress] = useState(null);
  const [scanStatus, setScanStatus] = useState(null);
  const [scanSummary, setScanSummary] = useState(null);
  const [error, setError] = useState(null);
  const socketRef = useRef(null);

  // Socket.IO for scan progress
  useEffect(() => {
    const socket = io(apiOrigin, { path: '/socket.io', autoConnect: true });
    socketRef.current = socket;

    socket.on('scan:status', (data) => {
      setScanStatus(data);
      setScanRunning(true);
    });
    socket.on('scan:progress', (data) => {
      setScanProgress(data);
    });
    socket.on('scan:complete', (data) => {
      setScanSummary(data);
      setScanRunning(false);
      setScanProgress(null);
      setScanStatus(null);
      loadTracks();
      loadStats();
    });
    socket.on('scan:error', (data) => {
      setError(data.error);
      setScanRunning(false);
      setScanProgress(null);
      setScanStatus(null);
    });

    return () => { socket.disconnect(); };
  }, []);

  const loadRoots = useCallback(async () => {
    try { setRoots(await api.media.getRoots()); } catch (err) { setError(err.message); }
  }, []);

  const loadTracks = useCallback(async () => {
    try { setTracks(await api.media.tracks(500, 0)); } catch (err) { setError(err.message); }
  }, []);

  const loadStats = useCallback(async () => {
    try { setStats(await api.media.stats()); } catch (err) { /* ignored */ }
  }, []);

  useEffect(() => {
    loadRoots();
    loadTracks();
    loadStats();
    api.media.rescanStatus().then((d) => setScanRunning(d.running)).catch(() => {});
  }, [loadRoots, loadTracks, loadStats]);

  // Load filter options when filterType changes
  useEffect(() => {
    setFilterValue('');
    setFilterOptions([]);
    if (filterType === 'artist') api.media.artists().then(setFilterOptions).catch(() => {});
    else if (filterType === 'album') api.media.albums().then(setFilterOptions).catch(() => {});
    else if (filterType === 'genre') api.media.genres().then(setFilterOptions).catch(() => {});
  }, [filterType]);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      loadTracks();
      return;
    }
    try { setTracks(await api.media.search(searchQuery)); } catch (err) { setError(err.message); }
  }, [searchQuery, loadTracks]);

  useEffect(() => {
    const timer = setTimeout(handleSearch, 300);
    return () => clearTimeout(timer);
  }, [handleSearch]);

  const handleFilter = useCallback(async (value) => {
    setFilterValue(value);
    if (!value) { loadTracks(); return; }
    try {
      if (filterType === 'artist') setTracks(await api.media.byArtist(value));
      else if (filterType === 'album') setTracks(await api.media.byAlbum(value));
      else if (filterType === 'genre') setTracks(await api.media.byGenre(value));
    } catch (err) { setError(err.message); }
  }, [filterType, loadTracks]);

  const handleAddRoot = async (dirPath) => {
    try {
      await api.media.addRoot(dirPath);
      await loadRoots();
    } catch (err) { setError(err.message); }
  };

  const handleRemoveRoot = async (id) => {
    try {
      await api.media.removeRoot(id);
      await loadRoots();
    } catch (err) { setError(err.message); }
  };

  const handleRescan = async () => {
    setScanSummary(null);
    setError(null);
    try {
      await api.media.rescan();
      setScanRunning(true);
    } catch (err) { setError(err.message); }
  };

  const handleAbort = async () => {
    try { await api.media.abortRescan(); } catch (err) { setError(err.message); }
  };

  return (
    <div className="min-h-screen bg-neutral-950">
      <header className="border-b border-white/5 px-4 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link to="/admin" className="text-neutral-400 hover:text-white text-sm">← Admin</Link>
          <h1 className="font-display text-xl text-white">Media Library</h1>
          <span className="text-neutral-500 text-sm">{stats?.total_tracks ?? 0} tracks</span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 text-red-400 text-sm flex justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-neutral-400 hover:text-white">×</button>
          </div>
        )}

        <StatsBar stats={stats} />

        {/* Library Roots */}
        <section className="rounded-2xl bg-neutral-900/50 border border-white/5 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-white font-medium">Library Directories</h2>
            <button
              onClick={() => setShowBrowser(true)}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500"
            >
              + Add Folder
            </button>
          </div>
          {roots.length === 0 ? (
            <p className="text-neutral-500 text-sm">No directories added yet. Add a folder to start scanning.</p>
          ) : (
            <ul className="space-y-2">
              {roots.map((r) => (
                <li key={r.id} className="flex items-center justify-between bg-neutral-800/50 rounded-lg px-3 py-2">
                  <div>
                    <span className="text-white text-sm font-medium">{r.label || r.path}</span>
                    <span className="block text-neutral-500 text-xs">{r.path}</span>
                  </div>
                  <button
                    onClick={() => handleRemoveRoot(r.id)}
                    className="text-red-400 hover:text-red-300 text-sm"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleRescan}
              disabled={scanRunning || roots.length === 0}
              className="px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-500 disabled:opacity-50"
            >
              {scanRunning ? 'Scanning…' : 'Rescan Library'}
            </button>
            {scanRunning && (
              <button
                onClick={handleAbort}
                className="px-4 py-2 rounded-lg bg-red-600/80 text-white text-sm hover:bg-red-500"
              >
                Abort
              </button>
            )}
          </div>
        </section>

        {/* Scan progress */}
        {scanRunning && <ScanProgress progress={scanProgress} status={scanStatus} />}
        <ScanSummary summary={scanSummary} onDismiss={() => setScanSummary(null)} />

        {/* Search & Filter */}
        <section className="rounded-2xl bg-neutral-900/50 border border-white/5 p-4 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="search"
              placeholder="Search by title, artist, album, genre…"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setFilterValue(''); }}
              className="flex-1 min-w-0 px-4 py-2 rounded-lg bg-neutral-800 border border-white/5 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
            <div className="flex gap-2">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-3 py-2 rounded-lg bg-neutral-800 border border-white/5 text-white text-sm focus:outline-none"
              >
                <option value="all">All</option>
                <option value="artist">By Artist</option>
                <option value="album">By Album</option>
                <option value="genre">By Genre</option>
              </select>
              {filterType !== 'all' && (
                <select
                  value={filterValue}
                  onChange={(e) => handleFilter(e.target.value)}
                  className="px-3 py-2 rounded-lg bg-neutral-800 border border-white/5 text-white text-sm focus:outline-none max-w-[200px]"
                >
                  <option value="">Select…</option>
                  {filterOptions.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </section>

        {/* Tracks Table */}
        <section className="rounded-2xl bg-neutral-900/50 border border-white/5 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/5 text-neutral-400 text-xs uppercase tracking-wider">
                  <th className="p-3 w-10">#</th>
                  <th className="p-3">Title</th>
                  <th className="p-3 hidden sm:table-cell">Artist</th>
                  <th className="p-3 hidden md:table-cell">Album</th>
                  <th className="p-3 hidden lg:table-cell">Genre</th>
                  <th className="p-3 hidden lg:table-cell">Year</th>
                  <th className="p-3">Duration</th>
                  <th className="p-3 hidden md:table-cell">Bitrate</th>
                  <th className="p-3 hidden xl:table-cell">Size</th>
                </tr>
              </thead>
              <tbody>
                {tracks.map((t, idx) => (
                  <tr key={t.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="p-3 text-neutral-500 text-sm">{idx + 1}</td>
                    <td className="p-3">
                      <span className="text-white font-medium text-sm">{t.title || '—'}</span>
                    </td>
                    <td className="p-3 hidden sm:table-cell text-neutral-300 text-sm">{t.artist || '—'}</td>
                    <td className="p-3 hidden md:table-cell text-neutral-400 text-sm">{t.album || '—'}</td>
                    <td className="p-3 hidden lg:table-cell text-neutral-400 text-sm">{t.genre || '—'}</td>
                    <td className="p-3 hidden lg:table-cell text-neutral-400 text-sm">{t.year || '—'}</td>
                    <td className="p-3 text-neutral-400 text-sm">{formatDuration(t.duration)}</td>
                    <td className="p-3 hidden md:table-cell text-neutral-400 text-sm">{t.bitrate ? `${t.bitrate} kbps` : '—'}</td>
                    <td className="p-3 hidden xl:table-cell text-neutral-400 text-sm">{formatSize(t.file_size)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {tracks.length === 0 && (
            <div className="p-8 text-center text-neutral-500">
              No tracks indexed yet. Add a folder and run "Rescan Library".
            </div>
          )}
        </section>
      </main>

      {showBrowser && (
        <DirectoryBrowser
          onSelect={handleAddRoot}
          onClose={() => setShowBrowser(false)}
        />
      )}
    </div>
  );
}
