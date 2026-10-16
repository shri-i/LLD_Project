const STATUS_LABELS = {
  AVAILABLE: 'available',
  LOCKED: 'locked',
  BOOKED: 'booked',
};

export default function Seat({ seat, selected, onToggle }) {
  const status = selected ? 'SELECTED' : String(seat.status || 'AVAILABLE').toUpperCase();
  const disabled = !selected && status !== 'AVAILABLE';
  const label = STATUS_LABELS[status] || status.toLowerCase();

  return (
    <button
      className={`seat seat-${status.toLowerCase()}`}
      type="button"
      disabled={disabled}
      aria-pressed={selected}
      aria-label={`Row ${seat.row}, seat ${seat.number}, ${seat.type.toLowerCase()}, ${label}`}
      title={`${seat.row}${seat.number} · ${seat.type} · ${label}`}
      onClick={() => onToggle(seat)}
    >
      <span>{seat.number}</span>
    </button>
  );
}
