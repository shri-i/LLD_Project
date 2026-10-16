export function LoadingState({ label = 'Loading…' }) {
  return (
    <div className="request-state" role="status" aria-live="polite">
      <span className="loading-dot" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="request-error" role="alert">
      <div>
        <strong>We couldn’t load this.</strong>
        <p>{message}</p>
      </div>
      {onRetry && <button className="button button-secondary" type="button" onClick={onRetry}>Try again</button>}
    </div>
  );
}
