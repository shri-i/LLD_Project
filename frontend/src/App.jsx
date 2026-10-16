import { Link, Route, Routes, useLocation, useNavigate } from 'react-router';
import Home from './pages/Home.jsx';
import MovieDetails from './pages/MovieDetails.jsx';
import SeatSelection from './pages/SeatSelection.jsx';
import Checkout from './pages/Checkout.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import BookingSuccess from './pages/BookingSuccess.jsx';
import MyBookings from './pages/MyBookings.jsx';
import RequireAuth from './components/RequireAuth.jsx';
import { useAuth } from './context/AuthContext.jsx';
import './styles/app.css';

function AppShell() {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="header-inner">
          <Link className="brand" to="/" aria-label="Showtime home">
            <span className="brand-mark" aria-hidden="true">S</span>
            <span>showtime</span>
          </Link>
          <nav className="header-nav" aria-label="Account navigation">
            <span className="header-caption">Find your next film</span>
            {isAuthenticated ? <>
              <Link to="/my-bookings">My bookings</Link>
              <span className="header-user">{user.name}</span>
              <button type="button" onClick={() => { logout(); navigate('/login', { state: { returnTo: location.pathname } }); }}>Sign out</button>
            </> : <Link to="/login" state={{ returnTo: location.pathname }}>Sign in</Link>}
          </nav>
        </div>
      </header>
      <main className="page-container">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/movies/:id" element={<MovieDetails />} />
          <Route path="/shows/:id/seats" element={<SeatSelection />} />
          <Route path="/checkout" element={<RequireAuth><Checkout /></RequireAuth>} />
          <Route path="/booking-success" element={<RequireAuth><BookingSuccess /></RequireAuth>} />
          <Route path="/my-bookings" element={<RequireAuth><MyBookings /></RequireAuth>} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <footer className="site-footer">Good stories start here.</footer>
    </div>
  );
}

function NotFound() {
  return (
    <section className="empty-state">
      <p className="eyebrow">Page not found</p>
      <h1>That page isn’t showing.</h1>
      <Link className="text-link" to="/">Back to movies</Link>
    </section>
  );
}

export default function App() {
  return <AppShell />;
}
