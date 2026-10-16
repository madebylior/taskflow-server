import { test, before, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { UniqueConstraintError, ValidationError, ForeignKeyConstraintError } from 'sequelize';

process.env.NODE_ENV = 'test';
process.env.DB_STORAGE = ':memory:';
process.env.JWT_SECRET = 'test_only_secret_32_characters_long_123456';
const { sequelize } = await import('../src/config/database.js');
const { User, Task, Category } = await import('../src/models/index.js');
const { app } = await import('../src/app.js');
let server, base, tokenA, tokenB, userA, categoryId, taskId;
const password = 'test-password123';

async function call(method, path, body, token = tokenA, raw = false) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${base}/api/v1${path}`, {
    method, headers, body: body === undefined ? undefined : raw ? body : JSON.stringify(body),
  });
  return { status: response.status, body: await response.json(), headers: response.headers };
}

before(async () => {
  await sequelize.sync({ force: true });
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  for (const name of ['Alice', 'Bob']) {
    const result = await call('POST', '/auth/register', { name, email: `${name.toLowerCase()}@example.com`, password }, null);
    assert.equal(result.status, 201);
    if (name === 'Alice') { tokenA = result.body.data.token; userA = result.body.data.user; }
    else tokenB = result.body.data.token;
  }
  categoryId = (await call('POST', '/categories', { name: 'College' })).body.data.id;
  taskId = (await call('POST', '/tasks', { title: 'Study SQL', categoryId })).body.data.id;
});

after(async () => {
  mock.restoreAll();
  if (server) await new Promise((resolve) => server.close(resolve));
  await sequelize.close();
});

test('bcrypt stores a verifiable hash; JWT has the expected subject, algorithm and expiry', async () => {
  const user = await User.findByPk(userA.id);
  assert.notEqual(user.passwordHash, password);
  assert.equal(await bcrypt.compare(password, user.passwordHash), true);
  assert.equal(bcrypt.getRounds(user.passwordHash), 12);
  const decoded = jwt.verify(tokenA, process.env.JWT_SECRET, { complete: true });
  assert.equal(decoded.header.alg, 'HS256');
  assert.equal(decoded.payload.sub, String(user.id));
  assert.equal(decoded.payload.exp - decoded.payload.iat, 7200);
  const me = await call('GET', '/auth/me');
  assert.equal(me.status, 200);
  assert.deepEqual(me.body.data, userA);
  assert.equal(JSON.stringify(me.body).includes('password'), false);
});

test('invalid, expired, wrong-signature and wrong-algorithm JWTs return 401', async () => {
  const options = { subject: String(userA.id) };
  const tokens = [
    'invalid',
    jwt.sign({}, process.env.JWT_SECRET, { ...options, expiresIn: -1 }),
    jwt.sign({}, 'a_different_secret_at_least_32_characters', options),
    jwt.sign({}, process.env.JWT_SECRET, { ...options, algorithm: 'HS384' }),
    jwt.sign({}, process.env.JWT_SECRET, { subject: 'invalid' }),
    jwt.sign({}, process.env.JWT_SECRET, { subject: '99999' }),
  ];
  for (const token of tokens) assert.equal((await call('GET', '/auth/me', undefined, token)).status, 401);
  assert.equal((await call('GET', '/categories', undefined, null)).status, 401);
});

test('category listing, renaming, uniqueness and cross-user changes are protected', async () => {
  assert.equal((await call('GET', '/categories')).body.data.length, 1);
  assert.equal((await call('GET', '/categories', undefined, tokenB)).body.data.length, 0);
  assert.equal((await call('POST', '/categories', { name: 'College' })).status, 409);
  assert.equal((await call('PATCH', `/categories/${categoryId}`, { name: 'Stolen' }, tokenB)).status, 404);
  assert.equal((await call('DELETE', `/categories/${categoryId}`, undefined, tokenB)).status, 404);
  const rename = await call('PATCH', `/categories/${categoryId}`, { name: 'University' });
  assert.equal(rename.status, 200);
  assert.equal(rename.body.data.name, 'University');
  const own = await call('POST', '/tasks', { title: 'Bob task' }, tokenB);
  assert.equal((await call('PATCH', `/tasks/${own.body.data.id}`, { categoryId }, tokenB)).status, 404);
  assert.equal((await call('GET', `/tasks/${taskId}`)).body.data.title, 'Study SQL');
});

test('task body validation rejects invalid types, dates and mass assignment', async () => {
  const invalidBodies = [
    [], null, {}, { title: 'x' }, { title: 'Valid', userId: 2 },
    { title: 'Valid', categoryId: [categoryId] }, { title: 'Valid', categoryId: {} },
    { title: 'Valid', categoryId: true }, { title: 'Valid', categoryId: 1.5 },
    { title: 'Valid', completed: 'false' }, { title: 'Valid', priority: 'urgent' },
    { title: 'Valid', dueDate: '2026-02-30' }, { title: 'Valid', dueDate: 123 },
    { title: 'Valid', description: 7 }, { title: 'Valid', description: 'x'.repeat(1001) },
  ];
  for (const body of invalidBodies) {
    assert.equal((await call('POST', '/tasks', body)).status, 400, JSON.stringify(body));
  }
  assert.equal((await call('PATCH', `/tasks/${taskId}`, {})).status, 400);
  assert.equal((await call('POST', '/tasks', { title: 'Valid', categoryId: 99999 })).status, 404);
  const valid = await call('PATCH', `/tasks/${taskId}`, { dueDate: '2028-02-29', description: null, categoryId: null });
  assert.equal(valid.status, 200);
  assert.equal(valid.body.data.dueDate, '2028-02-29');
  assert.equal(valid.body.data.categoryId, null);
});

test('invalid queries and IDs return 400, missing records return 404', async () => {
  for (const query of ['sort=passwordHash', 'order=up', 'page=0', 'page=10001', 'limit=101',
    'limit=1.5', 'search[x]=a', 'completed=true&completed=false', 'categoryId=abc', 'unknown=yes']) {
    assert.equal((await call('GET', `/tasks?${query}`)).status, 400, query);
  }
  for (const id of ['0', '-1', '1.5', 'abc', '9007199254740992']) {
    assert.equal((await call('GET', `/tasks/${id}`)).status, 400);
  }
  assert.equal((await call('GET', '/tasks/99999')).status, 404);
  assert.equal((await call('DELETE', '/categories/99999')).status, 404);
});

test('pagination, sorting and filters operate on owned rows', async () => {
  for (const title of ['Alpha homework', 'Beta homework']) {
    assert.equal((await call('POST', '/tasks', { title, priority: 'high' })).status, 201);
  }
  const result = await call('GET', '/tasks?search=homework&completed=false&priority=high&sort=title&order=asc&page=2&limit=1');
  assert.equal(result.status, 200);
  assert.equal(result.body.data[0].title, 'Beta homework');
  assert.deepEqual(result.body.pagination, { page: 2, limit: 1, total: 2, pages: 2 });
});

test('malformed/oversized JSON returns JSON errors and server remains responsive', async () => {
  assert.equal((await call('POST', '/tasks', '{"title":', tokenA, true)).status, 400);
  const large = await call('POST', '/tasks', { title: 'x'.repeat(21000) });
  assert.equal(large.status, 413);
  assert.equal(large.body.error.code, 'PAYLOAD_TOO_LARGE');
  assert.equal((await call('GET', `/tasks/${taskId}`)).status, 200);
});

test('Sequelize validation remains active independently of HTTP validation', async () => {
  await assert.rejects(Task.create({ title: 'x', userId: userA.id }), ValidationError);
  await assert.rejects(Task.create({ title: 'Valid', priority: 'urgent', userId: userA.id }), ValidationError);
  await assert.rejects(Category.create({ name: 'x', userId: userA.id }), ValidationError);
});

test('central handler maps database errors and conceals unexpected error details', async () => {
  for (const [error, status, code] of [
    [new UniqueConstraintError({ message: 'duplicate' }), 409, 'DUPLICATE'],
    [new ValidationError('invalid'), 400, 'VALIDATION_ERROR'],
    [new ForeignKeyConstraintError({ message: 'missing reference' }), 400, 'INVALID_REFERENCE'],
    [new Error('private_database_details'), 500, 'INTERNAL_ERROR'],
  ]) {
    const stub = mock.method(Task, 'findAndCountAll', async () => { throw error; });
    try {
      const result = await call('GET', '/tasks');
      assert.equal(result.status, status);
      assert.equal(result.body.error.code, code);
      assert.equal(JSON.stringify(result.body).includes('private_database_details'), false);
    } finally { stub.mock.restore(); }
    assert.equal((await call('GET', '/tasks')).status, 200);
  }
});

// Keep rate-limit checks last: they intentionally exhaust the real IP counters.
test('register and login share a 10-request limiter, returning 429 with retry headers', async () => {
  // Two registrations in before() already consumed two attempts.
  for (let i = 0; i < 8; i++) {
    assert.equal((await call('POST', '/auth/login', { email: 'nobody@example.com', password: 'wrong' })).status, 401);
  }
  for (const path of ['/auth/register', '/auth/login']) {
    const result = await call('POST', path, {});
    assert.equal(result.status, 429);
    assert.equal(result.body.error.code, 'RATE_LIMITED');
    assert.ok(result.headers.get('retry-after'));
  }
});

test('general API limiter returns 429 while health stays reachable', async () => {
  let result;
  for (let i = 0; i <= 120; i++) {
    result = await call('GET', '/tasks');
    if (result.status === 429) break;
    assert.equal(result.status, 200);
  }
  assert.equal(result.status, 429);
  assert.equal(result.body.error.code, 'RATE_LIMITED');
  assert.ok(result.headers.get('retry-after'));
  assert.equal((await call('GET', '/health')).status, 200);
});
