import { api } from '../../api';
import { synchronizeSession, logoutSession } from './cloudflare';
export const apiService = {
  API_URL: '/api', FILE_SERVER_URL: '', isServerAvailable: true, USE_JSON_SERVER: true,
  async init() { await api('/api/health'); },
  async login({ username, password, turnstileToken }) {
    const result = await api('/api/auth/login', { json: { identifier: username, password, turnstileToken } });
    await synchronizeSession({ force: true });
    return result;
  },
  logout: logoutSession
};
export default apiService;
