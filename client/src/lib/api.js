// Tiny fetch wrapper: bearer token in memory, one automatic refresh on 401 (httpOnly cookie).
const BASE = (import.meta.env.VITE_API_URL || '') + '/api';

let accessToken = null;
let onAuthLost = () => {};
let refreshing = null;

export const setAccessToken = (t) => { accessToken = t; };
export const getAccessToken = () => accessToken;
export const setAuthLostHandler = (fn) => { onAuthLost = fn; };
export const apiOrigin = () => import.meta.env.VITE_API_URL || window.location.origin;

export class ApiError extends Error {
  constructor(message, status, details) { super(message); this.status = status; this.details = details; }
}

async function refreshToken() {
  if (!refreshing) {
    refreshing = fetch(`${BASE}/auth/refresh`, { method: 'POST', credentials: 'include' })
      .then(async (r) => {
        if (!r.ok) throw new Error('refresh failed');
        const data = await r.json();
        accessToken = data.accessToken;
        return data;
      })
      .finally(() => { refreshing = null; });
  }
  return refreshing;
}

async function request(path, { method = 'GET', body, retry = true, raw = false } = {}) {
  const headers = {};
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${BASE}${path}`, { method, headers, credentials: 'include', body: body ? JSON.stringify(body) : undefined });
  if (res.status === 401 && retry && !path.startsWith('/auth/')) {
    try { await refreshToken(); return request(path, { method, body, retry: false, raw }); } catch (e) { onAuthLost(); throw new ApiError('Session expired, please log in again', 401); }
  }
  if (raw && res.ok) return res;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.message || `Request failed (${res.status})`, res.status, data.details);
  return data;
}

export const api = {
  get: (p) => request(p),
  post: (p, body) => request(p, { method: 'POST', body }),
  patch: (p, body) => request(p, { method: 'PATCH', body }),
  del: (p) => request(p, { method: 'DELETE' }),
  blob: (p) => request(p, { raw: true }).then((r) => r.blob()),
  refresh: refreshToken,
  // multipart upload with progress (fetch cannot report upload progress, XHR can)
  upload(path, file, onProgress, field = 'video') {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${BASE}${path}`);
      xhr.withCredentials = true;
      if (accessToken) xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
      xhr.upload.onprogress = (e) => e.lengthComputable && onProgress && onProgress(Math.round((e.loaded / e.total) * 100));
      xhr.onload = () => {
        let data = {};
        try { data = JSON.parse(xhr.responseText); } catch (e) { /* ignore */ }
        if (xhr.status >= 200 && xhr.status < 300) resolve(data);
        else reject(new ApiError(data.message || `Upload failed (${xhr.status})`, xhr.status));
      };
      xhr.onerror = () => reject(new ApiError('Network error during upload', 0));
      const fd = new FormData();
      fd.append(field, file);
      xhr.send(fd);
    });
  },
};
