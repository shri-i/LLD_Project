import { Link } from 'react-router';

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
});
const timeFormatter = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
const currencyFormatter = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date to be announced' : dateFormatter.format(date);
}

function formatTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Time to be announced' : timeFormatter.format(date);
}

export default function ShowList({ shows, movie }) {
  const theatres = new Map();

  for (const show of shows) {
    const theatre = show.screen?.theatre;
    const theatreKey = theatre?.id || theatre?.name || 'venue-tba';
    if (!theatres.has(theatreKey)) {
      theatres.set(theatreKey, { theatre, dates: new Map() });
    }
    const dateKey = show.start_time ? new Date(show.start_time).toLocaleDateString() : 'date-tba';
    const venue = theatres.get(theatreKey);
    if (!venue.dates.has(dateKey)) venue.dates.set(dateKey, { label: formatDate(show.start_time), shows: [] });
    venue.dates.get(dateKey).shows.push(show);
  }

  return (
    <div className="theatre-list">
      {[...theatres.entries()].map(([theatreKey, venue]) => (
        <section className="theatre-card" key={theatreKey}>
          <div className="theatre-heading">
            <div>
              <h3>{venue.theatre?.name || 'Theatre details unavailable'}</h3>
              <p>{[venue.theatre?.address, venue.theatre?.city?.name].filter(Boolean).join(' · ')}</p>
            </div>
            <span className="venue-label">Cinema</span>
          </div>
          {[...venue.dates.entries()].map(([dateKey, dateGroup]) => (
            <div className="show-date-group" key={dateKey}>
              <h4>{dateGroup.label}</h4>
              <div className="show-times">
                {dateGroup.shows
                  .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
                  .map((show) => (
                    <Link className="showtime-chip" key={show.id} to={`/shows/${show.id}/seats`} state={{ show, movie }}>
                      <span className="showtime-time">{formatTime(show.start_time)}</span>
                      <span className="showtime-screen">{show.screen?.name || 'Screen'}</span>
                      <span className="showtime-price">from {currencyFormatter.format(Number(show.base_price) || 0)}</span>
                      <span className="showtime-action">Choose seats</span>
                    </Link>
                  ))}
              </div>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

