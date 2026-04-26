import axios from 'axios';

// Use relative URL in production (proxied), or direct for Railway deployment
const API_BASE = import.meta.env.VITE_API_URL || '/api';

export const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('tl_tracker_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 responses
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('tl_tracker_token');
      localStorage.removeItem('tl_tracker_user');
      window.location.hash = '#/login';
    }
    return Promise.reject(err);
  }
);

export default api;
