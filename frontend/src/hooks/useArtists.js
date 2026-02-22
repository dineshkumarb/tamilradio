import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';

export function useArtists() {
  const [artists, setArtists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await api.artists.list();
      setArtists(Array.isArray(list) ? list : []);
    } catch (err) {
      setError(err.message);
      setArtists([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { artists, loading, error, refetch };
}
