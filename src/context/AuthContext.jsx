import { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';

const AuthContext = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem('soems_user');
      const savedSession = localStorage.getItem('soems_session');
      return (savedUser && savedSession) ? JSON.parse(savedUser) : null;
    } catch (e) {
      return null;
    }
  });
  const [loading, setLoading] = useState(false);

  // Send periodic presence ping for logged in users
  useEffect(() => {
    if (!user) return;
    const sendPing = async () => {
      try {
        await api('/api/user/ping', { method: 'POST' });
      } catch (e) {
        // ignore offline ping errors
      }
    };
    sendPing();
    const interval = setInterval(sendPing, 10000);
    return () => clearInterval(interval);
  }, [user]);

  const login = async (email, password) => {
    const data = await api('/api/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    localStorage.setItem('soems_user', JSON.stringify(data.user));
    localStorage.setItem('soems_session', JSON.stringify(data.session));
    setUser(data.user);
    return data.user;
  };

  const register = async (name, email, password, role = 'student') => {
    const data = await api('/api/auth/register', {
      method: 'POST',
      body: { name, email, password, role },
    });
    if (data.session?.access_token) {
      localStorage.setItem('soems_user', JSON.stringify(data.user));
      localStorage.setItem('soems_session', JSON.stringify(data.session));
      setUser(data.user);
    }
    return data;
  };

  const logout = () => {
    localStorage.removeItem('soems_user');
    localStorage.removeItem('soems_session');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function ProtectedRoute({ children, role }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const isAllowed = !role || (Array.isArray(role) ? role.includes(user?.role) : user?.role === role);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login', { replace: true });
    } else if (!loading && user && !isAllowed) {
      navigate(user.role === 'admin' ? '/admin' : '/student', { replace: true });
    }
  }, [user, loading, isAllowed, navigate]);

  if (loading) {
    return (
      <div className="page-loader">
        <div className="loader-spinner" />
      </div>
    );
  }

  if (!user || !isAllowed) return null;

  return children;
}
