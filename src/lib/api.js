export const API_URL = import.meta.env.VITE_API_URL || 
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? '' 
    : 'https://skyvl-college-test.onrender.com');

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

  const response = await fetch(url, config);
  
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new Error(text || `Server error (${response.status})`);
  }
  
  if (!response.ok) {
    throw new Error(data.detail || 'API request failed');
  }
  
  return data;
}

export default api;
