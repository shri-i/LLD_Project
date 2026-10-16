import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { SESSION_EXPIRED_EVENT, api, getToken, setToken } from '../api/client.js';

const USER_KEY = 'bookmyshow.user';
const AuthContext = createContext(null);

function storedUser() {
  try {
    return JSON.parse(window.localStorage.getItem(USER_KEY) || 'null');
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(storedUser);
  const [token, setCurrentToken] = useState(getToken);

  function acceptSession(result) {
    setToken(result.token);
    window.localStorage.setItem(USER_KEY, JSON.stringify(result.user));
    setCurrentToken(result.token);
    setUser(result.user);
    return result.user;
  }

  async function login(credentials) {
    return acceptSession(await api.login(credentials));
  }

  async function register(details) {
    return acceptSession(await api.register(details));
  }

  function logout() {
    setToken(null);
    window.localStorage.removeItem(USER_KEY);
    setCurrentToken(null);
    setUser(null);
  }

  useEffect(() => {
    window.addEventListener(SESSION_EXPIRED_EVENT, logout);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, logout);
  }, []);

  const value = useMemo(() => ({ user, token, isAuthenticated: Boolean(token && user), login, register, logout }), [user, token]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
