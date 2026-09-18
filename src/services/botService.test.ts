import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import { AddressInfo } from 'node:net';
import type { Logger } from 'winston';
import { patchBotStatus } from './botService';
import { ConfigError } from '../error';

const AUTH_ENV_VARS = ['AUTH_BASE_URL_V2', 'API_BASE_URL', 'BACKEND_URL', 'APP_URL'];

const withAuthEnv = async (value: string | undefined, fn: () => Promise<void>) => {
  const saved = AUTH_ENV_VARS.map((name) => [name, process.env[name]] as const);
  for (const name of AUTH_ENV_VARS) delete process.env[name];
  if (typeof value === 'string') process.env.AUTH_BASE_URL_V2 = value;
  try {
    await fn();
  } finally {
    for (const name of AUTH_ENV_VARS) delete process.env[name];
    for (const [name, savedValue] of saved) {
      if (typeof savedValue === 'string') process.env[name] = savedValue;
    }
  }
};

const createLoggerStub = () => {
  const calls = { warn: [] as unknown[][], error: [] as unknown[][], info: [] as unknown[][] };
  const logger = {
    warn: (...args: unknown[]) => { calls.warn.push(args); },
    error: (...args: unknown[]) => { calls.error.push(args); },
    info: (...args: unknown[]) => { calls.info.push(args); },
  } as unknown as Logger;
  return { logger, calls };
};

const baseParams = {
  token: 'test-token',
  botId: 'bot-123',
  eventId: 'event-456',
  provider: 'google' as const,
  status: ['failed' as const],
};

test('patchBotStatus rejects with a clear ConfigError when the API base URL is invalid', async () => {
  await withAuthEnv('not-a-url', async () => {
    const { logger } = createLoggerStub();
    await assert.rejects(
      patchBotStatus(baseParams, logger),
      (err: unknown) => err instanceof ConfigError && /AUTH_BASE_URL_V2/.test((err as Error).message),
    );
  });
});

test('patchBotStatus skips with a clear log when no API base URL is configured', async () => {
  await withAuthEnv(undefined, async () => {
    const { logger, calls } = createLoggerStub();
    const result = await patchBotStatus(baseParams, logger);
    assert.equal(result, false);
    assert.equal(calls.warn.length, 1);
    assert.match(String(calls.warn[0][0]), /AUTH_BASE_URL_V2 is not configured/);
  });
});

test('patchBotStatus updates the backend when the API base URL is valid', async () => {
  const requests: Array<{ method?: string; url?: string; body: string }> = [];
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      requests.push({ method: req.method, url: req.url, body });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;

  try {
    await withAuthEnv(`http://127.0.0.1:${port}/v2`, async () => {
      const { logger } = createLoggerStub();
      const result = await patchBotStatus(baseParams, logger);
      assert.equal(result, true);
    });
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  assert.equal(requests.length, 1);
  assert.equal(requests[0].method, 'PATCH');
  // The base path (/v2) must be preserved when joining the request path.
  assert.equal(requests[0].url, '/v2/meeting/app/bot/status');
  const payload = JSON.parse(requests[0].body);
  assert.equal(payload.botId, 'bot-123');
  assert.equal(payload.eventId, 'event-456');
  assert.equal(payload.provider, 'google');
  assert.deepEqual(payload.status, ['failed']);
});
