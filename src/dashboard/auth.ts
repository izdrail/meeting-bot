import crypto from 'node:crypto';
import { NextFunction, Request, Response } from 'express';

const SESSION_TTL_SECONDS = 12 * 60 * 60;
const FAILURE_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;
const failures = new Map<string, { count: number; resetAt: number }>();
let warnedDisabled = false;

type Credentials = { username: string; password: string; secret: string };

const credentials = (): Credentials | undefined => {
  const username = process.env.DASHBOARD_USERNAME;
  const password = process.env.DASHBOARD_PASSWORD;
  if (!username || !password) {
    if (!warnedDisabled) {
      console.warn('Dashboard login is disabled because DASHBOARD_USERNAME and DASHBOARD_PASSWORD are not both set.');
      warnedDisabled = true;
    }
    return undefined;
  }
  return {
    username,
    password,
    secret: process.env.DASHBOARD_SESSION_SECRET || crypto.createHash('sha256').update(`${username}\0${password}`).digest('hex'),
  };
};

const digest = (value: string): Buffer => crypto.createHash('sha256').update(value).digest();
const equal = (left: string, right: string): boolean => crypto.timingSafeEqual(digest(left), digest(right));
const sign = (value: string, secret: string): string => crypto.createHmac('sha256', secret).update(value).digest('base64url');
const cookie = (req: Request, name: string): string | undefined => {
  const match = req.headers.cookie?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : undefined;
};

const makeSession = (username: string, secret: string): string => {
  const payload = Buffer.from(JSON.stringify({ username, expiresAt: Date.now() + SESSION_TTL_SECONDS * 1000 })).toString('base64url');
  return `${payload}.${sign(payload, secret)}`;
};

const validSession = (token: string | undefined, config: Credentials): boolean => {
  if (!token) return false;
  const split = token.lastIndexOf('.');
  if (split < 1 || !equal(token.slice(split + 1), sign(token.slice(0, split), config.secret))) return false;
  try {
    const payload = JSON.parse(Buffer.from(token.slice(0, split), 'base64url').toString()) as { username?: string; expiresAt?: number };
    return payload.username === config.username && typeof payload.expiresAt === 'number' && payload.expiresAt > Date.now();
  } catch { return false; }
};

const validBearer = (req: Request): boolean => {
  const configured = process.env.DASHBOARD_BEARER_TOKEN;
  const supplied = req.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  return Boolean(configured && supplied && equal(supplied, configured));
};

export const dashboardAuth = (req: Request, res: Response, next: NextFunction): void => {
  const config = credentials();
  if (!config || validBearer(req) || validSession(cookie(req, 'meeting_bot_session'), config)) return next();
  if (req.path.startsWith('/api/')) {
    res.status(401).json({ success: false, error: 'Dashboard authentication required' });
    return;
  }
  res.redirect('/dashboard/login');
};

export const login = (req: Request, res: Response): void => {
  const config = credentials();
  if (!config) {
    res.status(204).end();
    return;
  }
  const key = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const record = failures.get(key);
  if (record && record.resetAt > now && record.count >= MAX_FAILURES) {
    res.set('Retry-After', String(Math.ceil((record.resetAt - now) / 1000)));
    res.status(429).json({ success: false, error: 'Too many login attempts. Try again later.' });
    return;
  }
  const username = typeof req.body?.username === 'string' ? req.body.username : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!equal(username, config.username) || !equal(password, config.password)) {
    const current = record && record.resetAt > now ? record : { count: 0, resetAt: now + FAILURE_WINDOW_MS };
    current.count += 1;
    failures.set(key, current);
    res.status(401).json({ success: false, error: 'Invalid username or password' });
    return;
  }
  failures.delete(key);
  res.cookie('meeting_bot_session', makeSession(config.username, config.secret), {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_TTL_SECONDS * 1000,
    path: '/',
  });
  res.json({ success: true });
};

export const logout = (_req: Request, res: Response): void => {
  res.clearCookie('meeting_bot_session', { path: '/' });
  res.status(204).end();
};
