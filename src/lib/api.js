// Backend URL resolution:
// - In local dev: use relative URL so Vite's proxy (/api → backend) handles it — no CORS, no port issues
// - In production (Render/Netlify): use explicit backend URL from env var or default Render URL
const getApiUrl = () => {
  // Explicit override (e.g. in .env: VITE_API_URL=https://my-backend.onrender.com)
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;

  const hostname = window.location.hostname;
  const isLocal =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.startsWith('192.168.') ||
    hostname.startsWith('10.') ||
    hostname.startsWith('172.') ||
    hostname.endsWith('.local');

  // On local: return empty string so calls become /api/... (proxied by Vite)
  if (isLocal) return '';

  // On production: fall back to Render backend
  return 'https://skyvl-college-test.onrender.com';
};

export const API_URL = getApiUrl();

function getToken() {
  const session = JSON.parse(localStorage.getItem('soems_session') || '{}');
  return session.access_token || '';
}

export async function api(endpoint, options = {}) {
  const { method = 'GET', body, params } = options;

  let url = `${API_URL}${endpoint}`;
  if (params) {
    const searchParams = new URLSearchParams(params);
    url += `?${searchParams.toString()}`;
  }

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${getToken()}`,
  };

  const config = { method, headers };
  if (body) config.body = JSON.stringify(body);

  let response;
  try {
    response = await fetch(url, config);
  } catch (_networkErr) {
    // Backend unreachable — Vite proxy or direct connection failed
    throw new Error('Cannot connect to the server. Please make sure the backend is running.');
  }

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new Error(text || `Server error (${response.status})`);
  }

  if (!response.ok) {
    // Session expired — clear storage and redirect to login
    if (response.status === 401) {
      localStorage.removeItem('soems_session');
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
      throw new Error('Session expired — please log in again');
    }
    throw new Error(data.detail || 'API request failed');
  }

  return data;
}

export default api;
