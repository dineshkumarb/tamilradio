function isSafeImageSrc(src) {
  if (!src || typeof src !== 'string') return false;
  if (src.startsWith('http://') || src.startsWith('https://')) return true;
  if (!src.startsWith('data:image/')) return false;
  const base64Marker = ';base64,';
  const idx = src.indexOf(base64Marker);
  if (idx === -1) return false;
  const payload = src.slice(idx + base64Marker.length);
  if (payload.length < 100) return false;
  return /^[A-Za-z0-9+/=]+$/.test(payload.replace(/\s/g, ''));
}

export default function AlbumArt({ src, alt = 'Album art', fallbackSrc, className = 'w-full aspect-square object-cover rounded-lg' }) {
  const useSrc = src && isSafeImageSrc(src) ? src : null;
  const useFallback = fallbackSrc && isSafeImageSrc(fallbackSrc) ? fallbackSrc : null;
  const showImg = useSrc || useFallback;
  const imgSrc = useSrc || useFallback;
  return (
    <div className={`${className} bg-neutral-800 rounded-lg overflow-hidden flex items-center justify-center`}>
      {showImg ? (
        <img
          src={imgSrc}
          alt={alt}
          className="w-full h-full object-cover"
          onError={(e) => {
            if (imgSrc === useFallback) {
              e.target.style.display = 'none';
              e.target.nextElementSibling?.classList.remove('hidden');
            } else if (useFallback) {
              e.target.src = useFallback;
            } else {
              e.target.style.display = 'none';
              e.target.nextElementSibling?.classList.remove('hidden');
            }
          }}
        />
      ) : null}
      <div className={showImg ? 'hidden' : 'w-full h-full flex items-center justify-center text-neutral-500'} aria-hidden>
        <svg className="w-1/2 h-1/2" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
        </svg>
      </div>
    </div>
  );
}
