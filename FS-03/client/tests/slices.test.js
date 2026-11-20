import { describe, it, expect, vi, beforeEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';

vi.mock('../src/lib/api', () => {
  const api = { get: vi.fn(), post: vi.fn(), refresh: vi.fn() };
  return { api, setAccessToken: vi.fn(), setAuthLostHandler: vi.fn() };
});

import { api, setAccessToken } from '../src/lib/api';
import { reducers, login, logout, fetchCourses, fetchEarnings, toast, dismissToast, authLost } from '../src/app/slices';
import { inr, duration, groupBy } from '../src/lib/format';

const makeStore = () => configureStore({ reducer: reducers });
beforeEach(() => vi.clearAllMocks());

describe('auth slice', () => {
  it('login stores user + token and hands the token to the API client', async () => {
    api.post.mockResolvedValue({ user: { id: '1', name: 'Asha', role: 'student' }, accessToken: 'tok' });
    const store = makeStore();
    await store.dispatch(login({ email: 'a@b.c', password: 'x' }));
    expect(store.getState().auth).toMatchObject({ user: { name: 'Asha' }, token: 'tok', status: 'idle', error: null });
    expect(setAccessToken).toHaveBeenCalledWith('tok');
  });

  it('failed login keeps the user signed out and exposes the error message', async () => {
    api.post.mockRejectedValue(new Error('Invalid email or password'));
    const store = makeStore();
    await store.dispatch(login({ email: 'a@b.c', password: 'bad' }));
    expect(store.getState().auth.user).toBeNull();
    expect(store.getState().auth.error).toBe('Invalid email or password');
  });

  it('logout and authLost clear the session', async () => {
    api.post.mockResolvedValue({ user: { id: '1' }, accessToken: 't' });
    const store = makeStore();
    await store.dispatch(login({}));
    await store.dispatch(logout());
    expect(store.getState().auth.user).toBeNull();
    await store.dispatch(login({}));
    store.dispatch(authLost());
    expect(store.getState().auth.token).toBeNull();
  });
});

describe('catalog slice', () => {
  it('builds the query string without empty filters and stores pagination', async () => {
    api.get.mockResolvedValue({ items: [{ id: 'c1' }], page: 2, pages: 5, total: 41 });
    const store = makeStore();
    await store.dispatch(fetchCourses({ q: 'react', category: '', level: undefined, page: 2 }));
    expect(api.get).toHaveBeenCalledWith('/courses?q=react&page=2');
    expect(store.getState().catalog).toMatchObject({ items: [{ id: 'c1' }], page: 2, pages: 5, total: 41, status: 'ready' });
  });

  it('records an error state when the API fails', async () => {
    api.get.mockRejectedValue(new Error('Network down'));
    const store = makeStore();
    await store.dispatch(fetchCourses({}));
    expect(store.getState().catalog).toMatchObject({ status: 'error', error: 'Network down' });
  });
});

describe('instructor + ui slices', () => {
  it('stores the earnings dashboard', async () => {
    api.get.mockResolvedValue({ dashboard: { totals: { sales: 3 }, perDay: [] } });
    const store = makeStore();
    await store.dispatch(fetchEarnings());
    expect(store.getState().instructor.dashboard.totals.sales).toBe(3);
  });

  it('toasts can be queued and dismissed', () => {
    const store = makeStore();
    store.dispatch(toast('Saved', 'success'));
    const [t] = store.getState().ui.toasts;
    expect(t).toMatchObject({ message: 'Saved', kind: 'success' });
    store.dispatch(dismissToast(t.id));
    expect(store.getState().ui.toasts).toHaveLength(0);
  });
});

describe('format helpers', () => {
  it('inr: free vs paid with Indian grouping', () => { expect(inr(0)).toBe('Free'); expect(inr(1499)).toBe('₹1,499'); expect(inr(125000)).toBe('₹1,25,000'); });
  it('duration', () => { expect(duration(0)).toBe(''); expect(duration(30)).toBe('30s'); expect(duration(600)).toBe('10m'); expect(duration(5400)).toBe('1h 30m'); });
  it('groupBy keeps order within groups', () => { expect(groupBy([{ s: 'a', n: 1 }, { s: 'b', n: 2 }, { s: 'a', n: 3 }], 's')).toEqual({ a: [{ s: 'a', n: 1 }, { s: 'a', n: 3 }], b: [{ s: 'b', n: 2 }] }); });
});
