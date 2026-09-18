import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveAuthBaseUrlV2, resolveChromeCdpUrl, validateConfig } from './config';
import { ConfigError } from './error';

test('resolveChromeCdpUrl reads GOOGLE_CHROME_CDP_URL', () => {
  assert.equal(
    resolveChromeCdpUrl({ GOOGLE_CHROME_CDP_URL: 'http://chrome-cdp:9223' }),
    'http://chrome-cdp:9223',
  );
});

test('resolveChromeCdpUrl accepts CHROME_CDP_URL as an alias', () => {
  assert.equal(
    resolveChromeCdpUrl({ CHROME_CDP_URL: 'http://localhost:9223' }),
    'http://localhost:9223',
  );
});

test('resolveChromeCdpUrl prefers the canonical variable over the alias', () => {
  assert.equal(
    resolveChromeCdpUrl({
      GOOGLE_CHROME_CDP_URL: 'http://chrome-cdp:9223',
      CHROME_CDP_URL: 'http://localhost:9223',
    }),
    'http://chrome-cdp:9223',
  );
});

test('resolveChromeCdpUrl treats blank values as unset (in-container browser fallback)', () => {
  assert.equal(resolveChromeCdpUrl({ GOOGLE_CHROME_CDP_URL: '' }), undefined);
  assert.equal(resolveChromeCdpUrl({}), undefined);
});

test('resolveAuthBaseUrlV2 reads AUTH_BASE_URL_V2 and its aliases', () => {
  assert.equal(
    resolveAuthBaseUrlV2({ AUTH_BASE_URL_V2: 'http://backend:8081/v2' }),
    'http://backend:8081/v2',
  );
  assert.equal(
    resolveAuthBaseUrlV2({ API_BASE_URL: 'http://api:9000/v2' }),
    'http://api:9000/v2',
  );
  assert.equal(
    resolveAuthBaseUrlV2({ BACKEND_URL: 'http://backend/v2' }),
    'http://backend/v2',
  );
  assert.equal(
    resolveAuthBaseUrlV2({ APP_URL: 'http://app/v2' }),
    'http://app/v2',
  );
});

test('resolveAuthBaseUrlV2 treats blank values as disabled (local-only mode)', () => {
  assert.equal(resolveAuthBaseUrlV2({ AUTH_BASE_URL_V2: '' }), undefined);
  assert.equal(resolveAuthBaseUrlV2({}), undefined);
});

test('validateConfig accepts valid and absent values', () => {
  assert.doesNotThrow(() => validateConfig({}));
  assert.doesNotThrow(() => validateConfig({
    GOOGLE_CHROME_CDP_URL: 'http://chrome-cdp:9223',
    AUTH_BASE_URL_V2: 'http://host.docker.internal:8081/v2',
  }));
});

test('validateConfig fails fast on an invalid CDP URL', () => {
  assert.throws(
    () => validateConfig({ GOOGLE_CHROME_CDP_URL: 'chrome-cdp:9223' }),
    (err: unknown) => err instanceof ConfigError && /GOOGLE_CHROME_CDP_URL/.test((err as Error).message),
  );
});

test('validateConfig fails fast on an invalid backend base URL', () => {
  assert.throws(
    () => validateConfig({ AUTH_BASE_URL_V2: 'not-a-url' }),
    (err: unknown) => err instanceof ConfigError && /AUTH_BASE_URL_V2/.test((err as Error).message),
  );
  assert.throws(
    () => validateConfig({ AUTH_BASE_URL_V2: '/v2' }),
    (err: unknown) => err instanceof ConfigError && /AUTH_BASE_URL_V2/.test((err as Error).message),
  );
});
