import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { api } from '../api/client.js';
import ShowList from '../components/ShowList.jsx';
import { ErrorState, LoadingState } from '../components/RequestState.jsx';

async function findMovie(movieId, signal) {
  const cities = await api.getCities({ signal });
  const catalogues = await Promise.all(cities.map((city) => api.getMovies(city.id, { signal })));
  for (const catalogue of catalogues) {
    const movie = catalogue.find((candidate) => candidate.id === movieId);
    if (movie) return movie;
  }
  return null;
}

export default function MovieDetails() {
  const { id } = useParams();
  const location = useLocation();
  const stateMovie = location.state?.movie;
  const [movie, setMovie] = useState(stateMovie || null);
  const [shows, setShows] = useState([]);
  const [movieLoading, setMovieLoading] = useState(!stateMovie);
  const [showsLoading, setShowsLoading] = useState(true);
  const [movieError, setMovieError] = useState('');
  const [showsError, setShowsError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    if (stateMovie) {
      setMovie(stateMovie);
      setMovieLoading(false);
      setMovieError('');
    } else {
      setMovieLoading(true);
      setMovieError('');
      findMovie(id, controller.signal)
        .then((result) => {
          if (!result) throw new Error('Movie not found. It may no longer be showing.');
          setMovie(result);
        })
        .catch((error) => {
          if (error.name !== 'AbortError') setMovieError(error.message);
        })
        .finally(() => {
          if (!controller.signal.aborted) setMovieLoading(false);
        });
    }
    return () => controller.abort();
  }, [id, stateMovie, attempt]);

  useEffect(() => {
    const controller = new AbortController();
    setShowsLoading(true);
    setShowsError('');
    api.getShows(id, { signal: controller.signal })
      .then(setShows)
      .catch((error) => {
        if (error.name !== 'AbortError') setShowsError(error.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setShowsLoading(false);
      });
    return () => controller.abort();
  }, [id, attempt]);

  const retry = () => setAttempt((value) => value + 1);

  return (
    <>
      <Link className="back-link" to="/">← <span>All movies</span></Link>
      {movieLoading && <LoadingState label="Loading movie details…" />}
      {movieError && <ErrorState message={movieError} onRetry={retry} />}
      {!movieLoading && !movieError && movie && (
        <section className="movie-detail-hero">
          <div className="detail-poster">
            {movie.poster_url && (
              <img
                src={movie.poster_url}
                alt={`${movie.title} poster`}
                onError={(event) => {
                  event.currentTarget.style.display = 'none';
                  event.currentTarget.nextElementSibling.style.display = 'grid';
                }}
              />
            )}
            <span className={`poster-fallback${movie.poster_url ? ' poster-fallback-hidden' : ''}`} aria-hidden="true">{movie.title?.slice(0, 1) || 'M'}</span>
          </div>
          <div className="detail-copy">
            <p className="eyebrow">Movie details</p>
            <h1>{movie.title}</h1>
            <div className="movie-meta">
              {movie.duration_mins && <span>{movie.duration_mins} min</span>}
              {movie.language && <span>{movie.language}</span>}
              {movie.genre && <span>{movie.genre}</span>}
            </div>
            <p className="detail-note">Choose a cinema and time that works for you.</p>
          </div>
        </section>
      )}

      <section className="showtimes-section" aria-labelledby="showtimes-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Plan your visit</p>
            <h2 id="showtimes-heading">Showtimes near you</h2>
          </div>
        </div>
        {showsLoading && <LoadingState label="Loading showtimes…" />}
        {showsError && <ErrorState message={showsError} onRetry={retry} />}
        {!showsLoading && !showsError && shows.length === 0 && (
          <div className="empty-state empty-state-inline"><h3>No showtimes available.</h3><p>Check back later for new screenings.</p></div>
        )}
        {!showsLoading && !showsError && shows.length > 0 && <ShowList shows={shows} movie={movie} />}
      </section>
    </>
  );
}
