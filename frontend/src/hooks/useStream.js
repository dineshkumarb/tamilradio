import { useState, useCallback, useEffect } from 'react';
import { api } from '../api/client';

export function useStream(artist) {
  const [status, setStatus] = useState('stopped');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!artist) return;
    api.stream.status(artist).then((data) => setStatus(data.status || 'stopped')).catch(() => setStatus('stopped'));
  }, [artist]);

  const start = useCallback(async () => {
    if (!artist) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.stream.start(artist);
      setStatus(data.status || 'playing');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [artist]);

  const stop = useCallback(async () => {
    if (!artist) return;
    setLoading(true);
    setError(null);
    try {
      await api.stream.stop(artist);
      setStatus('stopped');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [artist]);

  const skip = useCallback(async () => {
    if (!artist) return;
    setError(null);
    try {
      const data = await api.stream.skip(artist);
      setStatus(data.status || 'playing');
    } catch (err) {
      setError(err.message);
    }
  }, [artist]);

  return { status, loading, error, start, stop, skip, setStatus };
}
