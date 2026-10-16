import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.DB_STORAGE = ':memory:';
process.env.JWT_SECRET = 'test_only_secret_32_characters_long_123456';

const { sequelize } = await import('../src/config/database.js');
await import('../src/models/index.js');
const { app } = await import('../src/app.js');
let server;
let base;

before(async () => {
  await sequelize.sync({ force: true });
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  if (server) await new Promise((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
  await sequelize.close();
});
async function call(method, path, body, token) {
  const headers = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (token) headers.authorization = `Bearer ${token}`;
  const response = await fetch(`${base}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: response.status, body: await response.json() };
}
const prefix = '/api/v1';
let tokenA, tokenB, categoryId, taskId;

test('health endpoint returns 200', async () => {
  const result = await call('GET', `${prefix}/health`);
  assert.equal(result.status, 200);
});
test('registration validates and hashes password, login works', async () => {
  let result = await call('POST', `${prefix}/auth/register`, { name: 'A', email: 'invalid', password: '123' });
  assert.equal(result.status, 400);
  result = await call('POST', `${prefix}/auth/register`, { name: 'Alice', email: 'alice@example.com', password: 'test-password123' });
  assert.equal(result.status, 201);
  assert.equal(result.body.data.user.email, 'alice@example.com');
  assert.equal(result.body.data.user.passwordHash, undefined);
  tokenA = result.body.data.token;
  assert.ok(tokenA);
  result = await call('POST', `${prefix}/auth/login`, { email: 'alice@example.com', password: 'wrong' });
  assert.equal(result.status, 401);
  result = await call('POST', `${prefix}/auth/login`, { email: 'alice@example.com', password: 'test-password123' });
  assert.equal(result.status, 200);
});
test('duplicate email returns conflict', async () => {
  const result = await call('POST', `${prefix}/auth/register`, { name: 'Alice 2', email: 'alice@example.com', password: 'test-password123' });
  assert.equal(result.status, 409);
});
test('protected routes require authentication', async () => {
  const result = await call('GET', `${prefix}/tasks`);
  assert.equal(result.status, 401);
});
test('category and task CRUD, filter, and proper statuses', async () => {
  let result = await call('POST', `${prefix}/categories`, { name: 'College' }, tokenA);
  assert.equal(result.status, 201);
  categoryId = result.body.data.id;
  result = await call('POST', `${prefix}/tasks`, {
    title: 'Study JavaScript', description: 'Read documentation', priority: 'high', completed: false, categoryId,
  }, tokenA);
  assert.equal(result.status, 201);
  taskId = result.body.data.id;
  result = await call('GET', `${prefix}/tasks?completed=false&priority=high&search=JavaScript&categoryId=${categoryId}&sort=title&order=asc`, undefined, tokenA);
  assert.equal(result.status, 200);
  assert.equal(result.body.pagination.total, 1);
  assert.equal(result.body.data[0].id, taskId);
  result = await call('PATCH', `${prefix}/tasks/${taskId}`, { completed: true }, tokenA);
  assert.equal(result.status, 200);
  assert.equal(result.body.data.completed, true);
  result = await call('GET', `${prefix}/tasks?completed=false`, undefined, tokenA);
  assert.equal(result.body.pagination.total, 0);
});
test('invalid values are rejected instead of silently coerced', async () => {
  let result = await call('PATCH', `${prefix}/tasks/${taskId}`, { completed: 'false' }, tokenA);
  assert.equal(result.status, 400);
  result = await call('GET', `${prefix}/tasks?completed=maybe`, undefined, tokenA);
  assert.equal(result.status, 400);
  result = await call('POST', `${prefix}/tasks`, { title: 'X' }, tokenA);
  assert.equal(result.status, 400);
  result = await call('GET', `${prefix}/tasks/abc`, undefined, tokenA);
  assert.equal(result.status, 400);
});
test('different users cannot access each other tasks or categories', async () => {
  let result = await call('POST', `${prefix}/auth/register`, { name: 'Bob', email: 'bob@example.com', password: 'test-password123' });
  assert.equal(result.status, 201);
  tokenB = result.body.data.token;
  result = await call('GET', `${prefix}/tasks/${taskId}`, undefined, tokenB);
  assert.equal(result.status, 404);
  result = await call('PATCH', `${prefix}/tasks/${taskId}`, { title: 'Stolen' }, tokenB);
  assert.equal(result.status, 404);
  result = await call('DELETE', `${prefix}/tasks/${taskId}`, undefined, tokenB);
  assert.equal(result.status, 404);
  result = await call('POST', `${prefix}/tasks`, { title: 'Other task', categoryId }, tokenB);
  assert.equal(result.status, 404);
  result = await call('GET', `${prefix}/tasks`, undefined, tokenB);
  assert.equal(result.body.pagination.total, 0);
});
test('deleting category keeps tasks; deleting task removes it', async () => {
  let result = await call('DELETE', `${prefix}/categories/${categoryId}`, undefined, tokenA);
  assert.equal(result.status, 200);
  result = await call('GET', `${prefix}/tasks/${taskId}`, undefined, tokenA);
  assert.equal(result.status, 200);
  assert.equal(result.body.data.categoryId, null);
  result = await call('DELETE', `${prefix}/tasks/${taskId}`, undefined, tokenA);
  assert.equal(result.status, 200);
  result = await call('GET', `${prefix}/tasks/${taskId}`, undefined, tokenA);
  assert.equal(result.status, 404);
});
test('unknown route is handled', async () => {
  const result = await call('GET', `${prefix}/does-not-exist`);
  assert.equal(result.status, 404);
});
