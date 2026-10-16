import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client.js';
import MovieCard from '../components/MovieCard.jsx';
import { ErrorState, LoadingState } from '../components/RequestState.jsx';

const CITY_KEY = 'bookmyshow.city';

export default function Home() {
  const [cities, setCities] = useState([]);
  const [cityId, setCityId] = useState(() => window.localStorage.getItem(CITY_KEY) || '');
  const [movies, setMovies] = useState([]);
  const [citiesLoading, setCitiesLoading] = useState(true);
  const [moviesLoading, setMoviesLoading] = useState(false);
  const [citiesError, setCitiesError] = useState('');
  const [moviesError, setMoviesError] = useState('');
  const [citiesAttempt, setCitiesAttempt] = useState(0);
  const [moviesAttempt, setMoviesAttempt] = useState(0);

  const loadCities = useCallback(async (signal) => {
    setCitiesLoading(true);
    setCitiesError('');
    try {
      const result = await api.getCities({ signal });
      setCities(result);
      setCityId((current) => {
        const next = result.some((city) => city.id === current) ? current : (result[0]?.id || '');
        if (next) window.localStorage.setItem(CITY_KEY, next);
        else window.localStorage.removeItem(CITY_KEY);
        return next;
      });
    } catch (error) {
      if (error.name !== 'AbortError') setCitiesError(error.message);
    } finally {
      if (!signal.aborted) setCitiesLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadCities(controller.signal);
    return () => controller.abort();
  }, [loadCities, citiesAttempt]);

  useEffect(() => {
    if (!cityId) {
      setMovies([]);
      setMoviesLoading(false);
      return undefined;
    }
    const controller = new AbortController();
    setMoviesLoading(true);
    setMoviesError('');
    api.getMovies(cityId, { signal: controller.signal })
      .then(setMovies)
      .catch((error) => {
        if (error.name !== 'AbortError') setMoviesError(error.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setMoviesLoading(false);
      });
    return () => controller.abort();
  }, [cityId, moviesAttempt]);

  function chooseCity(value) {
    setCityId(value);
    if (value) window.localStorage.setItem(CITY_KEY, value);
  }

  const selectedCity = cities.find((city) => city.id === cityId);

  return (
    <>
      <section className="hero-section">
        <div className="hero-copy">
          <p className="eyebrow">Your city, your screen</p>
          <h1>Make room for<br /><span>a good story.</span></h1>
          <p className="hero-description">Find films worth stepping out for, playing at cinemas near you.</p>
        </div>
        <div className="city-control-wrap">
          <label htmlFor="city-select">Showing movies in</label>
          <select
            id="city-select"
            value={cityId}
            disabled={citiesLoading || cities.length === 0}
            onChange={(event) => chooseCity(event.target.value)}
          >
            {cities.length === 0 && <option value="">Choose a city</option>}
            {cities.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}
          </select>
        </div>
      </section>

      {citiesLoading && <LoadingState label="Finding cities…" />}
      {citiesError && <ErrorState message={citiesError} onRetry={() => setCitiesAttempt((attempt) => attempt + 1)} />}
      {!citiesLoading && !citiesError && cities.length === 0 && (
        <div className="empty-state"><h2>No cities are available yet.</h2><p>Try again in a little while.</p></div>
      )}

      {cityId && (
        <section className="catalog-section" aria-labelledby="movies-heading">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Now showing</p>
              <h2 id="movies-heading">Movies in {selectedCity?.name || 'your city'}</h2>
            </div>
            {!moviesLoading && !moviesError && movies.length > 0 && <span className="result-count">{movies.length} films</span>}
          </div>
          {moviesLoading && <LoadingState label="Loading movies…" />}
          {moviesError && <ErrorState message={moviesError} onRetry={() => setMoviesAttempt((attempt) => attempt + 1)} />}
          {!moviesLoading && !moviesError && movies.length === 0 && (
            <div className="empty-state empty-state-inline"><h3>No movies found in this city.</h3><p>Choose another city or check back soon.</p></div>
          )}
          {!moviesLoading && !moviesError && movies.length > 0 && (
            <div className="movie-grid">
              {movies.map((movie) => (
                <MovieCard key={movie.id} movie={movie} cityId={cityId} cityName={selectedCity?.name} />
              ))}
            </div>
          )}
        </section>
      )}
    </>
  );
}
