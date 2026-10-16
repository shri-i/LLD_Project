import Seat from './Seat.jsx';

const orderRows = (a, b) => a.localeCompare(b, undefined, { numeric: true });
const formatPrice = (value) => new Intl.NumberFormat(undefined, {
  style: 'currency', currency: 'INR', maximumFractionDigits: 0,
}).format(Number(value) || 0);

export default function SeatMap({ seats, selectedSeatIds, onToggleSeat, screenName }) {
  const rows = new Map();
  const seatNumbers = [...new Set(seats.map((seat) => Number(seat.number)))].sort((a, b) => a - b);
  const maxSeatNumber = seatNumbers.at(-1) || 0;

  for (const seat of seats) {
    const row = String(seat.row || '?');
    if (!rows.has(row)) rows.set(row, new Map());
    rows.get(row).set(Number(seat.number), seat);
  }

  const pricesByType = new Map();
  for (const seat of seats) {
    if (!pricesByType.has(seat.type)) pricesByType.set(seat.type, new Set());
    pricesByType.get(seat.type).add(Number(seat.price) || 0);
  }

  return (
    <section className="seat-map-panel" aria-label="Choose seats">
      <div className="screen-indicator">
        <span className="screen-curve" aria-hidden="true" />
        <span>{screenName || 'Screen'}</span>
      </div>
      <div className="seat-map-scroll">
        <div className="seat-grid" style={{ '--seat-columns': maxSeatNumber }}>
          <div className="seat-grid-row seat-number-row" aria-hidden="true">
            <span className="row-label" />
            {Array.from({ length: maxSeatNumber }, (_, index) => <span className="seat-number" key={index + 1}>{index + 1}</span>)}
          </div>
          {[...rows.entries()].sort(([a], [b]) => orderRows(a, b)).map(([rowLabel, rowSeats]) => (
            <div className="seat-grid-row" key={rowLabel}>
              <span className="row-label">{rowLabel}</span>
              {Array.from({ length: maxSeatNumber }, (_, index) => {
                const number = index + 1;
                const seat = rowSeats.get(number);
                return seat
                  ? <Seat key={seat.seatId} seat={seat} selected={selectedSeatIds.includes(seat.seatId)} onToggle={onToggleSeat} />
                  : <span className="seat-empty" key={`empty-${number}`} aria-hidden="true" />;
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="seat-type-prices" aria-label="Seat type and price">
        {[...pricesByType.entries()].sort(([a], [b]) => orderRows(a, b)).map(([type, prices]) => (
          <span className="seat-type-price" key={type}>
            <span className={`type-swatch swatch-${String(type).toLowerCase()}`} aria-hidden="true" />
            <strong>{type}</strong>
            <span>{[...prices].sort((a, b) => a - b).map(formatPrice).join('–')}</span>
          </span>
        ))}
      </div>

      <div className="seat-legend" aria-label="Seat status legend">
        <span><i className="legend-seat legend-available" />Available</span>
        <span><i className="legend-seat legend-locked" />Locked</span>
        <span><i className="legend-seat legend-booked" />Booked</span>
        <span><i className="legend-seat legend-selected" />Selected</span>
      </div>
    </section>
  );
}
