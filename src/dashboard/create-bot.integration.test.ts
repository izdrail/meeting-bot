import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

test('POST /api/bots persists a bot in DASHBOARD_DATA_DIR', async () => {
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'meeting-bot-api-'));
  process.env.NODE_ENV = 'test';
  process.env.DASHBOARD_DATA_DIR = directory;
  process.env.REDIS_CONSUMER_ENABLED = 'false';

  try {
    const { default: app } = await import('../app');
    const server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    try {
      const address = server.address();
      assert(address && typeof address !== 'string');
      const response = await fetch(`http://127.0.0.1:${address.port}/api/bots`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          provider: 'google',
          name: 'Recorder',
          teamId: 'local',
          userId: 'test-user',
          timezone: 'Europe/London',
        }),
      });
      const body = await response.json() as { success: boolean; data: { id: string } };
      assert.equal(response.status, 201);
      assert.equal(body.success, true);
      assert.ok(body.data.id);
      const state = JSON.parse(await fs.promises.readFile(path.join(directory, 'meeting-bot-dashboard.json'), 'utf8'));
      assert.equal(state.bots[0].id, body.data.id);
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  } finally {
    delete process.env.DASHBOARD_DATA_DIR;
    await fs.promises.rm(directory, { recursive: true, force: true });
  }
});
