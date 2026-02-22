import { Link } from 'react-router-dom';

const THEME_CLASSES = {
  ilayaraja: {
    cardClass: 'from-ilayaraja-card to-ilayaraja-bg hover:border-ilayaraja-accent/30',
    accentClass: 'text-ilayaraja-accent',
  },
  arrahman: {
    cardClass: 'from-arrahman-card to-arrahman-bg hover:border-arrahman-accent/30',
    accentClass: 'text-arrahman-accent',
  },
  neutral: {
    cardClass: 'from-neutral-800 to-neutral-900 hover:border-neutral-500/30',
    accentClass: 'text-neutral-300',
  },
};

function themeFor(slug, theme) {
  return THEME_CLASSES[theme] || THEME_CLASSES.neutral;
}

export default function ArtistCard({ artist, songCount = 0 }) {
  const slug = artist?.slug || artist;
  const name = artist?.name || slug;
  const photoUrl = artist?.photo_url || null;
  const theme = artist?.theme || 'neutral';
  const { cardClass, accentClass } = themeFor(slug, theme);

  return (
    <Link
      to={`/player/${slug}`}
      className={`block rounded-2xl overflow-hidden bg-gradient-to-b ${cardClass} border border-white/5 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl`}
    >
      <div className="aspect-[4/3] relative overflow-hidden">
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={name}
            className="w-full h-full object-cover opacity-90"
          />
        ) : (
          <div className="w-full h-full bg-neutral-800 flex items-center justify-center">
            <span className="text-4xl text-neutral-500 font-display">{name.charAt(0)}</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
        <div className="absolute bottom-4 left-4 right-4">
          <h2 className="font-display text-2xl md:text-3xl text-white drop-shadow-lg">
            {name}
          </h2>
          <p className="text-white/80 text-sm mt-1">
            {songCount} {songCount === 1 ? 'song' : 'songs'} in library
          </p>
        </div>
      </div>
      <div className="p-4 flex items-center justify-between">
        <span className={`${accentClass} text-sm font-medium`}>Play now</span>
        <span className="text-neutral-400">→</span>
      </div>
    </Link>
  );
}

export function getArtistTheme(slug, theme) {
  const t = themeFor(slug, theme);
  return { cardClass: t.cardClass, accentClass: t.accentClass };
}
