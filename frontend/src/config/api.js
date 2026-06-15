const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const API_BASE_URL = supabaseUrl ? `${supabaseUrl}/functions/v1/api` : '';

export const apiUrl = (path) => {
  const normalizedPath = path.startsWith('/') ? path.replace(/^\/api/, '') : `/${path.replace(/^\/api/, '')}`;
  return `${API_BASE_URL}${normalizedPath}`;
};

export const getApiHeaders = (extra = {}) => ({
  Authorization: `Bearer ${supabaseAnonKey}`,
  apikey: supabaseAnonKey,
  ...extra,
});

export async function apiFetch(path, options = {}) {
  const hasJsonBody = options.body && !(options.body instanceof FormData);
  const headers = {
    ...getApiHeaders(),
    ...(hasJsonBody ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers || {}),
  };

  return fetch(apiUrl(path), {
    ...options,
    headers,
  });
}

export default API_BASE_URL;
