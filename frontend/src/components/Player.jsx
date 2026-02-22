import { useRef, useEffect, useState } from 'react';
import AlbumArt from './AlbumArt';
import { api } from '../api/client';

const THEME_BTN = {
  ilayaraja: { accentBtn: 'bg-ilayaraja-accent', cardBg: 'bg-ilayaraja-card/50' },
  arrahman: { accentBtn: 'bg-arrahman-accent', cardBg: 'bg-arrahman-card/50' },
  neutral: { accentBtn: 'bg-neutral-500', cardBg: 'bg-neutral-800/50' },
};

function formatTime(s) {
  if (s == null || Number.isNaN(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

export default function Player({ artist, theme = 'neutral', artistPhotoUrl, current, queue, status, onStart, onStop, onSkip, loading, error, useGlobalAudio, audioCurrentTime = 0 }) {
  const audioRef = useRef(null);
  const [localTime, setLocalTime] = useState(0);
  const [volume, setVolume] = useState(1);
  const config = THEME_BTN[theme] || THEME_BTN.neutral;
  const currentTime = useGlobalAudio ? audioCurrentTime : localTime;

  useEffect(() => {
    if (useGlobalAudio) return;
    const el = audioRef.current;
    if (!el || !artist) return;
    if (status === 'playing') {
      el.src = `${api.stream.audioUrl(artist)}?t=${Date.now()}`;
      el.play().catch(() => {});
      setLocalTime(0);
    } else {
      el.pause();
      el.removeAttribute('src');
      setLocalTime(0);
    }
  }, [artist, status, useGlobalAudio, current?.id]);

  useEffect(() => {
    if (useGlobalAudio) return;
    const el = audioRef.current;
    if (!el) return;
    const onEnded = () => onSkip();
    const onTimeUpdate = () => setLocalTime(el.currentTime);
    el.addEventListener('ended', onEnded);
    el.addEventListener('timeupdate', onTimeUpdate);
    return () => {
      el.removeEventListener('ended', onEnded);
      el.removeEventListener('timeupdate', onTimeUpdate);
    };
  }, [onSkip, useGlobalAudio]);

  useEffect(() => {
    if (useGlobalAudio) return;
    const el = audioRef.current;
    if (el) el.volume = volume;
  }, [volume, useGlobalAudio]);

  const isPlaying = status === 'playing';
  const duration = current?.duration_seconds ?? 0;
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className={`rounded-2xl ${config.cardBg} border border-white/5 p-6 md:p-8`}>
      {!useGlobalAudio && <audio ref={audioRef} className="hidden" playsInline preload="auto" />}
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 text-red-400 text-sm">
          {error}
        </div>
      )}
      <div className="flex flex-col md:flex-row gap-8 items-center md:items-start">
        <div className="w-full max-w-[280px] shrink-0">
          <AlbumArt
            src={current?.albumArt}
            alt={current?.title}
            fallbackSrc={artistPhotoUrl}
            className="w-full aspect-square object-cover rounded-xl shadow-xl"
          />
          {isPlaying && (
            <div className="mt-2 flex items-center gap-2 text-emerald-400 text-sm animate-pulse-slow">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              Now Playing
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0 w-full">
          <h1 className="font-display text-2xl md:text-3xl text-white truncate">
            {current?.title || '—'}
          </h1>
          <p className="text-neutral-400 mt-1">{current?.album || '—'}</p>
          <div className="flex flex-wrap gap-3 mt-2 text-sm text-neutral-500">
            {current?.year && <span>{current.year}</span>}
            {current?.genre && <span>• {current.genre}</span>}
            {current?.duration_seconds != null && (
              <span>• {Math.floor(current.duration_seconds / 60)}:{String(current.duration_seconds % 60).padStart(2, '0')}</span>
            )}
          </div>
          <div className="flex items-center gap-4 mt-6">
            {!isPlaying ? (
              <button
                onClick={onStart}
                disabled={loading}
                className={`px-6 py-3 rounded-xl ${config.accentBtn} text-black font-semibold hover:opacity-90 disabled:opacity-50 transition`}
              >
                {loading ? 'Starting…' : 'Play'}
              </button>
            ) : (
              <button
                onClick={onStop}
                disabled={loading}
                className="px-6 py-3 rounded-xl bg-neutral-600 text-white font-semibold hover:bg-neutral-500 disabled:opacity-50 transition"
              >
                {loading ? '…' : 'Pause'}
              </button>
            )}
            <button
              onClick={onSkip}
              disabled={loading || !isPlaying}
              className="p-3 rounded-xl bg-white/5 text-neutral-300 hover:bg-white/10 disabled:opacity-40 transition"
              title="Next"
            >
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
              </svg>
            </button>
            {!useGlobalAudio && (
            <div className="flex items-center gap-2 ml-4">
              <svg className="w-5 h-5 text-neutral-400 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
              </svg>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value, 10))}
                className="w-24 h-1.5 rounded-full appearance-none bg-neutral-600 accent-emerald-500"
              />
            </div>
            )}
          </div>
          {isPlaying && (
            <div className="mt-4">
              <div className="flex justify-between text-xs text-neutral-500 mb-1">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
              <div className="h-1.5 rounded-full bg-neutral-700 overflow-hidden">
                <div
                  className="h-full bg-emerald-500/80 rounded-full transition-[width] duration-200"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
      {queue.length > 0 && (
        <div className="mt-8">
          <h3 className="text-sm font-medium text-neutral-400 mb-2">Up next</h3>
          <ul className="space-y-1 max-h-40 overflow-y-auto pr-2">
            {queue.slice(0, 10).map((track, i) => (
              <li key={track.id || i} className="text-sm text-neutral-400 flex justify-between gap-2">
                <span className="truncate">{track.title}</span>
                {track.duration_seconds != null && (
                  <span className="shrink-0">{Math.floor(track.duration_seconds / 60)}:{String(track.duration_seconds % 60).padStart(2, '0')}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
