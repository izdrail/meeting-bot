import axios from 'axios';
import { resolveAuthBaseUrlV2 } from '../config';
import { ConfigError } from '../error';

/**
 * Base URL of the ScreenApp-compatible backend, resolved lazily per call so
 * tests (and any runtime env reload) see the current value. Throws ConfigError
 * when the operator set a value that is not an absolute http(s) URL - startup
 * validation (validateConfig) should catch this first, this is defense in depth.
 */
export const getAuthBaseUrlV2 = (): string => {
  const base = resolveAuthBaseUrlV2();
  if (!base) {
    throw new ConfigError(
      'AUTH_BASE_URL_V2 is not configured. Set it to the ScreenApp-compatible backend base URL (e.g. http://localhost:8081/v2), or leave it unset only when no backend calls are made.'
    );
  }
  try {
    const parsed = new URL(base);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('bad protocol');
  } catch {
    throw new ConfigError(
      `AUTH_BASE_URL_V2 must be an absolute http(s) URL, e.g. http://localhost:8081/v2. Got: "${base}"`
    );
  }
  return base;
};

/**
 * Join a request path onto the backend base URL with URL semantics. The base
 * path is preserved (base http://host:8081/v2 + /meeting/app/bot/status ->
 * http://host:8081/v2/meeting/app/bot/status), matching axios' historical
 * baseURL concatenation, and a malformed base can never reach axios as a
 * relative URL (which is what produced the opaque "Invalid URL" TypeError).
 */
export const buildApiUrl = (path: string, base: string = getAuthBaseUrlV2()): string => {
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  return new URL(path.replace(/^\/+/, ''), normalizedBase).toString();
};

export const createApiV2 = (token: string, serviceKey?: string) =>
  axios.create({
    baseURL: getAuthBaseUrlV2(),
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(serviceKey && { 'x-sa-api-key': serviceKey }),
    },
  });
