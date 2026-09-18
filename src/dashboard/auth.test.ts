import assert from 'node:assert/strict';
import express from 'express';
import http from 'node:http';
import test from 'node:test';
import { dashboardAuth, login, logout } from './auth';

const start = async () => {
  const app = express();
  app.use(express.json());
  app.post('/api/dashboard/login', login);
  app.post('/api/dashboard/logout', logout);
  app.use(dashboardAuth);
  app.get('/dashboard/', (_req, res) => res.send('dashboard'));
  app.get('/api/dashboard', (_req, res) => res.json({ success: true }));
  app.get('/health', (_req, res) => res.json({ status: 'healthy' }));
  app.get('/isbusy', (_req, res) => res.json({ success: true, data: 0 }));
  app.get('/metrics', (_req, res) => res.type('text/plain').send('isbusy 0'));
  app.post('/google/join', (_req, res) => res.json({ success: true }));
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert(address && typeof address !== 'string');
  return { server, base: `http://127.0.0.1:${address.port}` };
};

test('dashboard login protects browser and API routes', async () => {
  process.env.DASHBOARD_USERNAME = 'admin';
  process.env.DASHBOARD_PASSWORD = 'correct horse';
  process.env.DASHBOARD_SESSION_SECRET = 'test-only-secret';
  const { server, base } = await start();
  try {
    for (const path of ['/health', '/isbusy', '/metrics']) {
      const status = await fetch(`${base}${path}`);
      assert.equal(status.status, 200, `${path} must stay public for platform health checks`);
    }
    const join = await fetch(`${base}/google/join`, { method: 'POST' });
    assert.equal(join.status, 200, 'existing provider API routes must not inherit dashboard login');
    const denied = await fetch(`${base}/api/dashboard`);
    assert.equal(denied.status, 401);
    const browser = await fetch(`${base}/dashboard/`, { redirect: 'manual' });
    assert.equal(browser.status, 302);
    assert.equal(browser.headers.get('location'), '/dashboard/login');
    const bad = await fetch(`${base}/api/dashboard/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: 'wrong' }) });
    assert.equal(bad.status, 401);
    const signedIn = await fetch(`${base}/api/dashboard/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: 'correct horse' }) });
    assert.equal(signedIn.status, 200);
    const session = signedIn.headers.get('set-cookie');
    assert(session?.includes('HttpOnly'));
    assert(session?.includes('SameSite=Strict'));
    const allowed = await fetch(`${base}/api/dashboard`, { headers: { cookie: session! } });
    assert.equal(allowed.status, 200);
  } finally {
    server.close();
    delete process.env.DASHBOARD_USERNAME;
    delete process.env.DASHBOARD_PASSWORD;
    delete process.env.DASHBOARD_SESSION_SECRET;
  }
});

test('bearer token keeps programmatic API access working', async () => {
  process.env.DASHBOARD_USERNAME = 'admin';
  process.env.DASHBOARD_PASSWORD = 'secret';
  process.env.DASHBOARD_BEARER_TOKEN = 'api-token';
  const { server, base } = await start();
  try {
    const response = await fetch(`${base}/api/dashboard`, { headers: { authorization: 'Bearer api-token' } });
    assert.equal(response.status, 200);
  } finally {
    server.close();
    delete process.env.DASHBOARD_USERNAME;
    delete process.env.DASHBOARD_PASSWORD;
    delete process.env.DASHBOARD_BEARER_TOKEN;
  }
});
