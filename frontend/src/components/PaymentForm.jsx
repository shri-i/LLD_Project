const modes = [
  { value: 'CARD', label: 'Card', description: 'Credit or debit card' },
  { value: 'UPI', label: 'UPI', description: 'Pay with your UPI app' },
  { value: 'NET_BANKING', label: 'Net banking', description: 'Pay through your bank' },
];

export default function PaymentForm({ mode, onModeChange, onPay, processing, disabled }) {
  return (
    <form className="payment-form" onSubmit={(event) => { event.preventDefault(); onPay(); }}>
      <fieldset disabled={processing || disabled}>
        <legend>Choose a payment method</legend>
        <div className="payment-options">
          {modes.map((option) => (
            <label className={`payment-option${mode === option.value ? ' selected' : ''}`} key={option.value}>
              <input type="radio" name="payment-mode" value={option.value} checked={mode === option.value} onChange={() => onModeChange(option.value)} />
              <span><strong>{option.label}</strong><small>{option.description}</small></span>
            </label>
          ))}
        </div>
      </fieldset>
      <button className="button button-primary pay-button" type="submit" disabled={processing || disabled}>
        {processing ? 'Processing payment…' : 'Pay securely'}
      </button>
    </form>
  );
}
