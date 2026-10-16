import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext.jsx';

export default function AuthForm({ mode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { login, register } = useAuth();
  const isRegister = mode === 'register';
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const update = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (isRegister) await register({ name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim(), password: form.password });
      else await login({ email: form.email.trim(), password: form.password });
      navigate(location.state?.returnTo || '/', { replace: true, state: { show: location.state?.show, movie: location.state?.movie } });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="login-layout">
      <Link className="back-link" to={location.state?.returnTo || '/'}>← <span>Back</span></Link>
      <div className="login-card">
        <p className="eyebrow">{isRegister ? 'Create an account' : 'Welcome back'}</p>
        <h1>{isRegister ? 'Join us for the show.' : 'Sign in to continue.'}</h1>
        <p className="login-description">Sign in to hold seats, pay securely and keep track of your bookings.</p>
        <div className="auth-tabs" aria-label="Account action">
          <Link className={`auth-tab${!isRegister ? ' active' : ''}`} to="/login" state={location.state}>Sign in</Link>
          <Link className={`auth-tab${isRegister ? ' active' : ''}`} to="/register" state={location.state}>Create account</Link>
        </div>
        <form className="auth-form" onSubmit={submit}>
          {isRegister && <>
            <label>Name<input name="name" autoComplete="name" value={form.name} onChange={update} required maxLength={120} /></label>
            <label>Phone<input name="phone" type="tel" autoComplete="tel" value={form.phone} onChange={update} required maxLength={40} /></label>
          </>}
          <label>Email<input name="email" type="email" autoComplete="email" value={form.email} onChange={update} required /></label>
          <label>Password<input name="password" type="password" autoComplete={isRegister ? 'new-password' : 'current-password'} value={form.password} onChange={update} required minLength={isRegister ? 8 : 1} maxLength={72} /></label>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="button button-primary auth-submit" type="submit" disabled={loading}>{loading ? 'Please wait…' : isRegister ? 'Create account' : 'Sign in'}</button>
        </form>
      </div>
    </section>
  );
}
