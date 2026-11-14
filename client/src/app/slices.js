import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { api, setAccessToken } from '../lib/api';

const errMsg = (e) => e.message || 'Something went wrong';

// ---------------- auth ----------------
export const bootstrapAuth = createAsyncThunk('auth/bootstrap', async () => {
  const d = await api.refresh(); // uses the httpOnly refresh cookie
  return { user: d.user, token: d.accessToken };
});
export const login = createAsyncThunk('auth/login', async (body, { rejectWithValue }) => {
  try { const d = await api.post('/auth/login', body); return { user: d.user, token: d.accessToken }; } catch (e) { return rejectWithValue(errMsg(e)); }
});
export const register = createAsyncThunk('auth/register', async (body, { rejectWithValue }) => {
  try { const d = await api.post('/auth/register', body); return { user: d.user, token: d.accessToken }; } catch (e) { return rejectWithValue(e.details ? e.details.join(', ') : errMsg(e)); }
});
export const logout = createAsyncThunk('auth/logout', async () => { try { await api.post('/auth/logout'); } catch (e) { /* ignore */ } });

const authSlice = createSlice({
  name: 'auth',
  initialState: { user: null, token: null, ready: false, status: 'idle', error: null },
  reducers: { clearError: (s) => { s.error = null; }, authLost: (s) => { s.user = null; s.token = null; setAccessToken(null); } },
  extraReducers: (b) => {
    const signedIn = (s, { payload }) => { s.user = payload.user; s.token = payload.token; s.status = 'idle'; s.error = null; setAccessToken(payload.token); };
    b.addCase(bootstrapAuth.fulfilled, (s, a) => { signedIn(s, a); s.ready = true; })
      .addCase(bootstrapAuth.rejected, (s) => { s.ready = true; })
      .addCase(login.pending, (s) => { s.status = 'loading'; s.error = null; })
      .addCase(login.fulfilled, signedIn)
      .addCase(login.rejected, (s, a) => { s.status = 'idle'; s.error = a.payload; })
      .addCase(register.pending, (s) => { s.status = 'loading'; s.error = null; })
      .addCase(register.fulfilled, signedIn)
      .addCase(register.rejected, (s, a) => { s.status = 'idle'; s.error = a.payload; })
      .addCase(logout.fulfilled, (s) => { s.user = null; s.token = null; setAccessToken(null); });
  },
});

// ---------------- catalog ----------------
export const fetchCourses = createAsyncThunk('catalog/fetch', async (params, { rejectWithValue }) => {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '' && v != null)).toString();
  try { return await api.get(`/courses?${qs}`); } catch (e) { return rejectWithValue(errMsg(e)); }
});

const catalogSlice = createSlice({
  name: 'catalog',
  initialState: { items: [], page: 1, pages: 1, total: 0, status: 'idle', error: null },
  reducers: {},
  extraReducers: (b) => {
    b.addCase(fetchCourses.pending, (s) => { s.status = 'loading'; s.error = null; })
      .addCase(fetchCourses.fulfilled, (s, { payload }) => { Object.assign(s, { items: payload.items, page: payload.page, pages: payload.pages, total: payload.total, status: 'ready' }); })
      .addCase(fetchCourses.rejected, (s, a) => { s.status = 'error'; s.error = a.payload; });
  },
});

// ---------------- learning (student) ----------------
export const fetchEnrollments = createAsyncThunk('learning/enrollments', async () => (await api.get('/enrollments/mine')).enrollments);
export const fetchCertificates = createAsyncThunk('learning/certificates', async () => (await api.get('/certificates/mine')).certificates);
export const fetchUpcoming = createAsyncThunk('learning/upcoming', async () => (await api.get('/live-classes/mine/upcoming')).liveClasses);

const learningSlice = createSlice({
  name: 'learning',
  initialState: { enrollments: [], certificates: [], upcoming: [], status: 'idle' },
  reducers: {},
  extraReducers: (b) => {
    b.addCase(fetchEnrollments.pending, (s) => { s.status = 'loading'; })
      .addCase(fetchEnrollments.fulfilled, (s, { payload }) => { s.enrollments = payload; s.status = 'ready'; })
      .addCase(fetchEnrollments.rejected, (s) => { s.status = 'ready'; })
      .addCase(fetchCertificates.fulfilled, (s, { payload }) => { s.certificates = payload; })
      .addCase(fetchUpcoming.fulfilled, (s, { payload }) => { s.upcoming = payload; });
  },
});

// ---------------- instructor ----------------
export const fetchMyCourses = createAsyncThunk('instructor/courses', async () => (await api.get('/courses/mine')).courses);
export const fetchEarnings = createAsyncThunk('instructor/earnings', async () => (await api.get('/earnings/dashboard')).dashboard);

const instructorSlice = createSlice({
  name: 'instructor',
  initialState: { courses: [], dashboard: null, status: 'idle' },
  reducers: {},
  extraReducers: (b) => {
    b.addCase(fetchMyCourses.fulfilled, (s, { payload }) => { s.courses = payload; })
      .addCase(fetchEarnings.pending, (s) => { s.status = 'loading'; })
      .addCase(fetchEarnings.fulfilled, (s, { payload }) => { s.dashboard = payload; s.status = 'ready'; })
      .addCase(fetchEarnings.rejected, (s) => { s.status = 'ready'; });
  },
});

// ---------------- admin ----------------
export const fetchAdmin = createAsyncThunk('admin/fetch', async () => {
  const [stats, pending, users] = await Promise.all([api.get('/admin/stats'), api.get('/admin/courses?status=pending'), api.get('/admin/users?limit=50')]);
  return { stats, pending: pending.courses, users: users.items };
});

const adminSlice = createSlice({
  name: 'admin',
  initialState: { stats: null, pending: [], users: [], status: 'idle' },
  reducers: {},
  extraReducers: (b) => {
    b.addCase(fetchAdmin.pending, (s) => { s.status = 'loading'; })
      .addCase(fetchAdmin.fulfilled, (s, { payload }) => { Object.assign(s, payload, { status: 'ready' }); })
      .addCase(fetchAdmin.rejected, (s) => { s.status = 'ready'; });
  },
});

// ---------------- toasts ----------------
let toastId = 0;
const uiSlice = createSlice({
  name: 'ui',
  initialState: { toasts: [] },
  reducers: {
    toast: { reducer: (s, { payload }) => { s.toasts.push(payload); }, prepare: (message, kind = 'info') => ({ payload: { id: ++toastId, message, kind } }) },
    dismissToast: (s, { payload }) => { s.toasts = s.toasts.filter((t) => t.id !== payload); },
  },
});

export const { clearError, authLost } = authSlice.actions;
export const { toast, dismissToast } = uiSlice.actions;
export const reducers = { auth: authSlice.reducer, catalog: catalogSlice.reducer, learning: learningSlice.reducer, instructor: instructorSlice.reducer, admin: adminSlice.reducer, ui: uiSlice.reducer };
