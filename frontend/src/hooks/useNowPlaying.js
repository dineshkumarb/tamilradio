import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import { io } from 'socket.io-client';

const apiOrigin = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' ? window.location.origin : '');
const socket = io(apiOrigin, { path: '/socket.io', autoConnect: true });

export function useNowPlaying(artist) {
  const [current, setCurrent] = useState(null);
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchNowPlaying = useCallback(async () => {
    if (!artist) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.nowplaying(artist);
      setCurrent(data.current);
      setQueue(data.queue || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [artist]);

  useEffect(() => {
    fetchNowPlaying();
    const interval = setInterval(fetchNowPlaying, 5000);
    return () => clearInterval(interval);
  }, [fetchNowPlaying]);

  useEffect(() => {
    if (!artist) return;
    socket.emit('subscribe', artist);
    const onUpdate = (payload) => {
      if (payload.artist === artist) {
        setCurrent(payload.current);
      }
    };
    socket.on('nowplaying', onUpdate);
    return () => socket.off('nowplaying', onUpdate);
  }, [artist]);

  return { current, queue, loading, error, refetch: fetchNowPlaying };
}
