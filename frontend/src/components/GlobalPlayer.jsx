import { useRef, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStreamContext } from '../context/StreamContext';
import { api } from '../api/client';
import AlbumArt from './AlbumArt';

export default function GlobalPlayer() {
  const { activeArtist, artists, getStreamForArtist, setAudioCurrentTime } = useStreamContext();
  const stream = activeArtist ? getStreamForArtist(activeArtist) : null;
  const artistRow = activeArtist ? artists?.find((a) => a.slug === activeArtist) : null;
  const artistName = artistRow?.name || activeArtist || '';
  const audioRef = useRef(null);
  const [currentTime, setCurrentTime] = useState(0);
  const setTime = (t) => {
    setCurrentTime(t);
    setAudioCurrentTime(t);
  };

  const isPlaying = stream?.status === 'playing';
  const current = stream?.current;
  const artist = activeArtist;

  // Single global audio: set src when artist/status/current track changes (fixes skip)
  useEffect(() => {
    const el = audioRef.current;
    if (!el || !artist || !stream) return;
    if (stream.status === 'playing') {
      const url = `${api.stream.audioUrl(artist)}?t=${Date.now()}`;
      el.src = url;
      setTime(0);
      const p = el.play();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } else {
      el.pause();
      el.removeAttribute('src');
      setTime(0);
    }
  }, [artist, stream?.status, current?.id]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el || !stream) return;
    const onEnded = () => stream.skip();
    const onTimeUpdate = () => setTime(el.currentTime);
    el.addEventListener('ended', onEnded);
    el.addEventListener('timeupdate', onTimeUpdate);
    return () => {
      el.removeEventListener('ended', onEnded);
      el.removeEventListener('timeupdate', onTimeUpdate);
    };
  }, [stream?.skip]);

  if (!activeArtist || !stream || !isPlaying) return null;

  const playerPath = `/player/${activeArtist}`;
  const duration = stream?.current?.duration_seconds ?? 1;
  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0;

  const handleProgressClick = (e) => {
    const el = audioRef.current;
    if (!el || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const p = Math.max(0, Math.min(1, x / rect.width));
    el.currentTime = p * duration;
    setTime(p * duration);
  };

  return (
    <>
      <audio
        ref={audioRef}
        className="hidden"
        playsInline
        preload="auto"
      />
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-neutral-900/95 backdrop-blur pb-4" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
        <Link
          to={playerPath}
          className="flex items-center gap-3 px-4 py-3 text-left w-full active:opacity-90"
        >
          <div className="w-12 h-12 shrink-0 rounded-lg overflow-hidden bg-neutral-800">
            <AlbumArt
              src={stream?.current?.albumArt}
              alt=""
              fallbackSrc={artistRow?.photo_url}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-white font-medium truncate">{stream?.current?.title || '—'}</p>
            <p className="text-neutral-400 text-sm truncate">{artistName}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                stream.stop();
              }}
              className="p-2 rounded-full bg-white/10 text-white hover:bg-white/20"
              title="Stop"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                stream.skip();
              }}
              className="p-2 rounded-full bg-white/10 text-white hover:bg-white/20"
              title="Next"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
              </svg>
            </button>
          </div>
        </Link>
        <div className="px-4 pb-2">
          <div
            role="progressbar"
            aria-valuenow={Math.round(progress * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            tabIndex={0}
            onClick={handleProgressClick}
            className="h-1.5 w-full rounded-full bg-neutral-700 cursor-pointer overflow-hidden"
          >
            <div
              className="h-full rounded-full bg-yellow-500 transition-[width] duration-150"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        </div>
      </div>
    </>
  );
}
