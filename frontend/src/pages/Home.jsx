import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import ArtistCard from '../components/ArtistCard';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useStreamContext } from '../context/StreamContext';

export default function Home() {
  const { isAdmin } = useAuth();
  const { artists } = useStreamContext();
  const [counts, setCounts] = useState({});

  useEffect(() => {
    if (!artists?.length) return;
    const slugs = artists.map((a) => a.slug);
    Promise.all(
      slugs.map((slug) =>
        api.library.count(slug).then((r) => r.count).catch(() => 0)
      )
    ).then((countArr) => {
      const next = {};
      slugs.forEach((s, i) => { next[s] = countArr[i]; });
      setCounts(next);
    });
  }, [artists]);

  return (
    <div className="min-h-screen bg-neutral-950">
      <header className="border-b border-white/5 px-4 py-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <h1 className="font-display text-2xl md:text-3xl text-white">Tamil Radio</h1>
          <div className="flex items-center gap-4">
            {isAdmin && (
              <Link to="/admin" className="text-neutral-400 hover:text-white text-sm">
                Admin
              </Link>
            )}
          </div>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 py-12">
        <p className="text-neutral-400 mb-8">
          Choose an artist to start streaming.
        </p>
        <div className="grid md:grid-cols-2 gap-6">
          {artists.map((artist) => (
            <ArtistCard
              key={artist.slug}
              artist={artist}
              songCount={counts[artist.slug] ?? 0}
            />
          ))}
        </div>
      </main>
    </div>
  );
}
