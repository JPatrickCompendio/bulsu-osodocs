import axios from 'axios';
import { getApiHeaders, apiUrl } from './api';

export const apiClient = axios.create();

apiClient.interceptors.request.use((config) => {
  config.headers = {
    ...getApiHeaders(),
    ...(config.headers || {}),
  };
  return config;
});

export { apiUrl, apiFetch, getApiHeaders } from './api';
