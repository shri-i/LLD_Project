import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api/client.js';

export default function useSeats(showId, pollingInterval = 5000) {
  const [seats, setSeats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const loadedRef = useRef(false);
  const refreshRef = useRef(null);

  useEffect(() => {
    let active = true;
    let timer;
    let controller;
    loadedRef.current = false;

    async function load() {
      clearTimeout(timer);
      controller?.abort();
      const requestController = new AbortController();
      controller = requestController;
      if (loadedRef.current) setRefreshing(true);
      else setLoading(true);
      setError('');

      try {
        const result = await api.getSeatMap(showId, { signal: requestController.signal });
        if (active) {
          setSeats(Array.isArray(result) ? result : []);
          loadedRef.current = true;
        }
        return Array.isArray(result) ? result : [];
      } catch (requestError) {
        if (active && requestError.name !== 'AbortError') setError(requestError.message);
        return null;
      } finally {
        if (active && !requestController.signal.aborted) {
          setLoading(false);
          setRefreshing(false);
          timer = setTimeout(load, pollingInterval);
        }
      }
    }

    refreshRef.current = load;
    load();
    return () => {
      active = false;
      clearTimeout(timer);
      controller?.abort();
      refreshRef.current = null;
    };
  }, [showId, pollingInterval, attempt]);

  const refresh = useCallback(() => {
    if (refreshRef.current) return refreshRef.current();
    return Promise.resolve(seats);
  }, [seats]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  return { seats, loading, refreshing, error, refresh, retry };
}
