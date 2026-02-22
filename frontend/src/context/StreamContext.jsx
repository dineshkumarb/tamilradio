import { createContext, useContext, useMemo, useState, useCallback } from 'react';
import { useStream } from '../hooks/useStream';
import { useNowPlaying } from '../hooks/useNowPlaying';
import { useArtists } from '../hooks/useArtists';
import { api } from '../api/client';

const StreamContext = createContext(null);

export function StreamProvider({ children }) {
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [activeArtist, setActiveArtist] = useState(null);
  const { artists, refetch: refetchArtists } = useArtists();

  const currentSlug = activeArtist || artists[0]?.slug || 'ilayaraja';
  const streamCurrent = useStream(currentSlug);
  const npCurrent = useNowPlaying(currentSlug);

  const start = useCallback(async (artist) => {
    if (activeArtist && activeArtist !== artist) {
      try { await api.stream.stop(activeArtist); } catch (_) {}
    }
    setActiveArtist(artist);
    try {
      await api.stream.start(artist);
    } catch (_) {}
  }, [activeArtist]);

  const stop = useCallback(async (artist) => {
    try { await api.stream.stop(artist); } catch (_) {}
    if (activeArtist === artist) setActiveArtist(null);
  }, [activeArtist]);

  const skip = useCallback(async (artist) => {
    try { await api.stream.skip(artist); } catch (_) {}
    if (currentSlug === artist) npCurrent.refetch();
  }, [currentSlug, npCurrent]);

  const effectiveActiveArtist = streamCurrent.status === 'playing' ? currentSlug : null;

  const value = useMemo(() => {
    const getStreamForArtist = (slug) => {
      if (slug === currentSlug) {
        return {
          ...streamCurrent,
          current: npCurrent.current,
          queue: npCurrent.queue,
          refetch: npCurrent.refetch,
          start: () => start(slug),
          stop: () => stop(slug),
          skip: () => skip(slug),
        };
      }
      return {
        status: 'stopped',
        loading: false,
        error: null,
        current: null,
        queue: [],
        refetch: () => {},
        start: () => start(slug),
        stop: () => stop(slug),
        skip: () => skip(slug),
      };
    };

    return {
      artists,
      refetchArtists,
      activeArtist: effectiveActiveArtist,
      audioCurrentTime,
      setAudioCurrentTime,
      getStreamForArtist,
      ilayaraja: getStreamForArtist('ilayaraja'),
      arrahman: getStreamForArtist('arrahman'),
    };
  }, [artists, currentSlug, streamCurrent, npCurrent.current, npCurrent.queue, npCurrent.refetch, effectiveActiveArtist, audioCurrentTime, start, stop, skip]);

  return (
    <StreamContext.Provider value={value}>
      {children}
    </StreamContext.Provider>
  );
}

export function useStreamContext() {
  const ctx = useContext(StreamContext);
  if (!ctx) throw new Error('useStreamContext must be used within StreamProvider');
  return ctx;
}

export function useArtistStream(artist) {
  const ctx = useStreamContext();
  const slug = artist?.toLowerCase?.() || artist;
  return ctx.getStreamForArtist(slug);
}
