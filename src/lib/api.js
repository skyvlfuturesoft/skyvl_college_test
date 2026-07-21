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
  const { method = 'GET', body, params, retries = 5 } = options;

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

  let attemptCount = 0;
  let lastError;

  while (attemptCount < retries) {
    attemptCount++;
    try {
      const response = await fetch(url, config);

      // Handle server error retries (502, 503, 504, 520, 524)
      if (response.status >= 502 && response.status <= 504 && attemptCount < retries) {
        const delay = Math.min(attemptCount * 1000, 4000);
        await new Promise((r) => setTimeout(r, delay));
        continue;
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
    } catch (err) {
      lastError = err;
      // Don't retry client-side HTTP errors (400, 401, 403, 404)
      if (err.message && (err.message.includes('Session expired') || err.message.includes('401') || err.message.includes('403') || err.message.includes('404') || err.message.includes('400'))) {
        throw err;
      }
      if (attemptCount < retries) {
        const delay = Math.min(attemptCount * 1000, 4000);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  const cleanMessage = (lastError && lastError.message !== 'Failed to fetch') 
    ? lastError.message 
    : 'Unable to connect to server. Please check your internet connection or try again in a moment.';
  throw new Error(cleanMessage);
}

export default api;
