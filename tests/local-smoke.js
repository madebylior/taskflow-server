// Real HTTP + disk persistence check. Uses the local .env, never prints secrets.
// Run with the normal API stopped: npm run verify:local
import 'dotenv/config';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { existsSync, statSync } from 'node:fs';

assert.notEqual(process.env.DB_STORAGE, ':memory:', 'Use a file database for this check');
const base = `http://127.0.0.1:${process.env.PORT || 8000}/api/v1`;
let child;
let token;
let checks = 0;
async function call(method, path, body, expected, auth = token, raw = false) {
  const headers = {};
  if (auth) headers.Authorization = `Bearer ${auth}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${base}${path}`, {
    method, headers, body: body === undefined ? undefined : raw ? body : JSON.stringify(body),
  });
  const json = await response.json();
  assert.equal(response.status, expected, `${method} ${path}: ${JSON.stringify(json)}`);
  checks++;
  console.log(`PASS ${method} ${path} -> ${response.status}`);
  return json;
}
async function start() {
  // Avoid accidentally testing a different server already running on the port.
  let occupied = false;
  try { await fetch(`${base}/health`); occupied = true; } catch { /* expected */ }
  assert.equal(occupied, false, 'Stop the existing API before running verify:local');
  child = spawn(process.execPath, ['src/server.js'], { cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'] });
  let logs = '';
  child.stdout.on('data', (data) => { logs += data; });
  child.stderr.on('data', (data) => { logs += data; });
  for (let attempt = 0; attempt < 100; attempt++) {
    if (child.exitCode !== null) throw new Error(`Server stopped: ${logs}`);
    if (logs.includes('TaskFlow running')) return;
    await delay(100);
  }
  throw new Error(`Server did not become ready: ${logs}`);
}
async function stop() {
  if (child && child.exitCode === null) {
    const exited = once(child, 'exit');
    child.kill();
    await exited;
  }
}

try {
  await start();
  await call('GET', '/health', undefined, 200);
  const email = `smoke-${Date.now()}@example.com`;
  const credentials = { email, password: 'LocalSmokePassword123' };
  const registration = await call('POST', '/auth/register', { name: 'Local Demo', ...credentials }, 201, null);
  token = registration.data.token;
  assert.equal(registration.data.user.passwordHash, undefined);
  await call('POST', '/auth/register', { name: 'Duplicate', ...credentials }, 409, null);
  await call('POST', '/auth/login', { ...credentials, password: 'wrong' }, 401, null);
  token = (await call('POST', '/auth/login', credentials, 200, null)).data.token;
  await call('GET', '/auth/me', undefined, 200);
  await call('GET', '/tasks', undefined, 401, null);
  await call('GET', '/tasks', undefined, 401, 'invalid-token');
  const category = (await call('POST', '/categories', { name: 'Smoke College' }, 201)).data;
  const task = (await call('POST', '/tasks', {
    title: 'Persistence demonstration', categoryId: category.id, priority: 'high', dueDate: '2026-10-20',
  }, 201)).data;
  await call('GET', '/tasks?completed=false&priority=high&search=Persistence&sort=title&order=asc', undefined, 200);
  await call('PATCH', `/tasks/${task.id}`, { completed: 'false' }, 400);
  await call('GET', '/tasks?limit=101', undefined, 400);
  await call('GET', '/tasks/abc', undefined, 400);
  await call('POST', '/tasks', '{"title":', 400, token, true);
  await call('POST', '/tasks', { title: 'x'.repeat(21000) }, 413);
  await call('GET', '/missing', undefined, 404);
  const second = await call('POST', '/auth/register', {
    name: 'Other Demo', email: `other-${email}`, password: credentials.password,
  }, 201, null);
  await call('GET', `/tasks/${task.id}`, undefined, 404, second.data.token);
  await call('POST', '/tasks', { title: 'Foreign category', categoryId: category.id }, 404, second.data.token);
  await call('PATCH', `/tasks/${task.id}`, { completed: true }, 200);
  await stop();
  assert.ok(existsSync(process.env.DB_STORAGE || './data/taskflow.sqlite'));
  assert.ok(statSync(process.env.DB_STORAGE || './data/taskflow.sqlite').size > 0);
  await start();
  token = (await call('POST', '/auth/login', credentials, 200, null)).data.token;
  const persisted = await call('GET', `/tasks/${task.id}`, undefined, 200);
  assert.equal(persisted.data.completed, true);
  assert.equal(persisted.data.categoryId, category.id);
  assert.equal(persisted.data.title, task.title);
  console.log('PASS SQLite user, task, category and update persisted across process restart');
  await call('PATCH', `/categories/${category.id}`, { name: 'Renamed College' }, 200);
  await call('GET', '/categories', undefined, 200);
  await call('DELETE', `/categories/${category.id}`, undefined, 200);
  const unassigned = await call('GET', `/tasks/${task.id}`, undefined, 200);
  assert.equal(unassigned.data.categoryId, null);
  await call('DELETE', `/tasks/${task.id}`, undefined, 200);
  await call('GET', `/tasks/${task.id}`, undefined, 404);
  await call('GET', '/health', undefined, 200);
  console.log(`PASS ${checks} HTTP checks; persistence verified; server survived invalid requests.`);
  console.log('Demo tasks/categories removed. Two local test accounts from this run remain in the ignored SQLite file.');
} finally {
  await stop();
}
