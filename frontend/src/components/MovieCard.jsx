import { Link } from 'react-router';

export default function MovieCard({ movie, cityId, cityName }) {
  const genre = movie.genre || movie.language || 'Now showing';

  return (
    <Link
      className="movie-card"
      to={`/movies/${movie.id}`}
      state={{ movie, cityId, cityName }}
    >
      <div className="movie-poster">
        {movie.poster_url ? (
          <img
            src={movie.poster_url}
            alt={`${movie.title} poster`}
            loading="lazy"
            onError={(event) => {
              event.currentTarget.style.display = 'none';
              event.currentTarget.nextElementSibling.style.display = 'grid';
            }}
          />
        ) : null}
        <span className={`poster-fallback${movie.poster_url ? ' poster-fallback-hidden' : ''}`} aria-hidden="true">{movie.title?.slice(0, 1) || 'M'}</span>
        <span className="poster-cta">View showtimes <span aria-hidden="true">↗</span></span>
      </div>
      <div className="movie-card-copy">
        <h3>{movie.title}</h3>
        <p>{genre}{movie.duration_mins ? ` · ${movie.duration_mins} min` : ''}</p>
      </div>
    </Link>
  );
}
