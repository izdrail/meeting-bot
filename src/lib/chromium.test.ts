import assert from 'node:assert/strict';
import test from 'node:test';
import createBrowserContext from './chromium';
import { ConfigError } from '../error';

test('browser launcher rejects an invalid CDP URL from the environment with a clear config error', async () => {
  const savedGoogle = process.env.GOOGLE_CHROME_CDP_URL;
  const savedAlias = process.env.CHROME_CDP_URL;
  process.env.GOOGLE_CHROME_CDP_URL = 'not-a-valid-url';
  delete process.env.CHROME_CDP_URL;
  try {
    await assert.rejects(
      createBrowserContext('https://meet.google.com/abc-defg-hij', 'test-correlation-id', 'google'),
      (err: unknown) => err instanceof ConfigError && /GOOGLE_CHROME_CDP_URL/.test((err as Error).message),
    );
  } finally {
    if (typeof savedGoogle === 'string') process.env.GOOGLE_CHROME_CDP_URL = savedGoogle;
    else delete process.env.GOOGLE_CHROME_CDP_URL;
    if (typeof savedAlias === 'string') process.env.CHROME_CDP_URL = savedAlias;
  }
});

test('browser launcher reads the CDP URL from the CHROME_CDP_URL alias', async () => {
  const savedGoogle = process.env.GOOGLE_CHROME_CDP_URL;
  const savedAlias = process.env.CHROME_CDP_URL;
  delete process.env.GOOGLE_CHROME_CDP_URL;
  // An invalid alias value must be picked up (and rejected) exactly like the
  // canonical variable - proving the launcher reads env through the resolver.
  process.env.CHROME_CDP_URL = 'also-not-a-url';
  try {
    await assert.rejects(
      createBrowserContext('https://meet.google.com/abc-defg-hij', 'test-correlation-id', 'google'),
      (err: unknown) => err instanceof ConfigError && /GOOGLE_CHROME_CDP_URL/.test((err as Error).message),
    );
  } finally {
    if (typeof savedGoogle === 'string') process.env.GOOGLE_CHROME_CDP_URL = savedGoogle;
    if (typeof savedAlias === 'string') process.env.CHROME_CDP_URL = savedAlias;
    else delete process.env.CHROME_CDP_URL;
  }
});
