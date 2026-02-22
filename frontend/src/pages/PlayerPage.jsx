import { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import Player from '../components/Player';
import { useArtistStream, useStreamContext } from '../context/StreamContext';
import { getArtistTheme } from '../components/ArtistCard';
import { useAuth } from '../context/AuthContext';

export default function PlayerPage() {
  const { artist } = useParams();
  const normalized = (artist || '').toLowerCase();
  const { artists, audioCurrentTime } = useStreamContext();
  const artistRow = artists?.find((a) => a.slug === normalized);
  const config = artistRow ? getArtistTheme(normalized, artistRow.theme) : getArtistTheme(normalized, 'neutral');
  const displayName = artistRow?.name || normalized;
  const { isAdmin } = useAuth();

  const stream = useArtistStream(normalized);

  // Autoplay when user clicks an artist and lands on this page
  useEffect(() => {
    if (!normalized) return;
    stream.start();
  }, [normalized]);

  return (
    <div className={`min-h-screen ${normalized === 'ilayaraja' ? 'bg-ilayaraja-bg' : 'bg-arrahman-bg'}`}>
      <header className="border-b border-white/5 px-4 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link to="/" className="text-neutral-400 hover:text-white text-sm">
            ← Home
          </Link>
          <h1 className={`font-display text-xl ${config.accentClass}`}>
            {displayName}
          </h1>
          {isAdmin ? (
            <Link
              to={`/library/${normalized}`}
              className="text-neutral-400 hover:text-white text-sm"
            >
              Library
            </Link>
          ) : (
            <span className="w-12" />
          )}
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 py-8">
        <Player
          artist={normalized}
          theme={artistRow?.theme || 'neutral'}
          artistPhotoUrl={artistRow?.photo_url}
          current={stream.current}
          queue={stream.queue}
          status={stream.status}
          onStart={stream.start}
          onStop={stream.stop}
          onSkip={stream.skip}
          loading={stream.loading}
          error={stream.error}
          useGlobalAudio
          audioCurrentTime={stream.status === 'playing' ? (audioCurrentTime ?? 0) : 0}
        />
      </main>
    </div>
  );
}
