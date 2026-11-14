const { api, resetDb, closeDb, makeUser, auth } = require('./helpers');

beforeAll(resetDb);
afterAll(closeDb);

describe('auth', () => {
  test('register returns user + access token and sets httpOnly refresh cookie', async () => {
    const res = await api().post('/api/auth/register').send({ name: 'Asha', email: 'asha@test.dev', password: 'Passw0rd!x' });
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ email: 'asha@test.dev', role: 'student' });
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(res.headers['set-cookie'][0]).toMatch(/refreshToken=.*HttpOnly/i);
  });

  test('duplicate email -> 409', async () => {
    const res = await api().post('/api/auth/register').send({ name: 'Asha', email: 'ASHA@test.dev', password: 'Passw0rd!x' });
    expect(res.status).toBe(409);
  });

  test('validation: weak password and bad email -> 400', async () => {
    expect((await api().post('/api/auth/register').send({ name: 'A', email: 'x', password: '123' })).status).toBe(400);
  });

  test('cannot self-register as admin', async () => {
    const res = await api().post('/api/auth/register').send({ name: 'Evil', email: 'evil@test.dev', password: 'Passw0rd!x', role: 'admin' });
    expect(res.status).toBe(400);
  });

  test('login ok, wrong password and unknown email give the same 401 message', async () => {
    const u = await makeUser('student');
    expect((await api().post('/api/auth/login').send({ email: u.email, password: u.password })).status).toBe(200);
    const bad = await api().post('/api/auth/login').send({ email: u.email, password: 'nope-nope-1' });
    const unknown = await api().post('/api/auth/login').send({ email: 'ghost@test.dev', password: 'nope-nope-1' });
    expect(bad.status).toBe(401);
    expect(bad.body.message).toBe(unknown.body.message);
  });

  test('GET /users/me requires a valid token', async () => {
    expect((await api().get('/api/users/me')).status).toBe(401);
    expect((await api().get('/api/users/me').set(auth('garbage'))).status).toBe(401);
    const u = await makeUser('student');
    const res = await api().get('/api/users/me').set(auth(u.token));
    expect(res.body.user.email).toBe(u.email);
  });

  test('refresh rotates the token; the old refresh token stops working', async () => {
    const u = await makeUser('student');
    const first = u.cookies;
    const r1 = await api().post('/api/auth/refresh').set('Cookie', first);
    expect(r1.status).toBe(200);
    expect(r1.body.accessToken).toBeTruthy();
    const r2 = await api().post('/api/auth/refresh').set('Cookie', first);
    expect(r2.status).toBe(401);
  });

  test('logout invalidates refresh token', async () => {
    const u = await makeUser('student');
    await api().post('/api/auth/logout').set(auth(u.token));
    expect((await api().post('/api/auth/refresh').set('Cookie', u.cookies)).status).toBe(401);
  });

  test('disabled accounts cannot login', async () => {
    const admin = await makeUser('admin');
    const u = await makeUser('student');
    await api().patch(`/api/admin/users/${u.user.id}`).set(auth(admin.token)).send({ isActive: false });
    expect((await api().post('/api/auth/login').send({ email: u.email, password: u.password })).status).toBe(403);
  });
});

describe('rbac', () => {
  test('students cannot create courses; admin routes reject non-admins', async () => {
    const s = await makeUser('student');
    const i = await makeUser('instructor');
    expect((await api().post('/api/courses').set(auth(s.token)).send({ title: 'Nope', description: 'A long enough description', category: 'X' })).status).toBe(403);
    expect((await api().get('/api/admin/users').set(auth(i.token))).status).toBe(403);
    expect((await api().get('/api/admin/stats')).status).toBe(401);
  });

  test('admin cannot change own role', async () => {
    const admin = await makeUser('admin');
    const res = await api().patch(`/api/admin/users/${admin.user.id}`).set(auth(admin.token)).send({ role: 'student' });
    expect(res.status).toBe(400);
  });
});
