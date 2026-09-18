import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import config from '../config';
import { MeetingProvider } from '../app/common';
import { DashboardStore } from './store';
import { listRecordings, resolveRecording } from './recordings';
import { globalJobStore } from '../lib/globalJobStore';
import { AccountService } from './accounts';
import { authAccountsPath, authProfilesDir, dashboardStatePath } from './storage';
import { dashboardAuth, login, logout } from './auth';

const router = express.Router();
const store = new DashboardStore(dashboardStatePath());
const accounts = new AccountService(authProfilesDir(), authAccountsPath());
const providers: MeetingProvider[] = ['google', 'microsoft', 'zoom'];
const publicDir = path.join(__dirname, 'public');

const isProvider = (value: unknown): value is MeetingProvider => typeof value === 'string' && providers.includes(value as MeetingProvider);
const text = (value: unknown): string => typeof value === 'string' ? value.trim() : '';

router.get('/dashboard/login', (_req, res) => res.sendFile(path.join(publicDir, 'login.html')));
router.get('/dashboard/styles.css', (_req, res) => res.sendFile(path.join(publicDir, 'styles.css')));
router.post('/api/dashboard/login', login);
router.post('/api/dashboard/logout', logout);
router.use(dashboardAuth);
router.use('/dashboard', express.static(publicDir));
router.get('/', (_req, res) => res.redirect('/dashboard/'));

router.get('/api/dashboard', async (_req, res, next) => {
  try {
    const [state, recordings, accountList] = await Promise.all([store.snapshot(), listRecordings(config.recordingsDir), accounts.list()]);
    res.json({
      success: true,
      data: {
        busy: globalJobStore.isBusy(),
        providers: {
          google: {
            ready: Boolean(config.googleChromeCdpUrl || config.googleChromeUserDataDir || config.googleChromeStorageStatePath),
            mode: config.googleChromeCdpUrl ? 'Chrome CDP sidecar' : config.googleChromeUserDataDir ? 'Chrome profile directory' : config.googleChromeStorageStatePath ? 'Playwright storage state' : 'anonymous browser',
          },
          microsoft: { ready: true, mode: 'browser guest or meeting admission' },
          zoom: { ready: true, mode: 'browser guest or meeting admission' },
        },
        accounts: accountList,
        bots: state.bots,
        activity: state.activity,
        recordings,
      },
    });
  } catch (error) { next(error); }
});


router.post('/api/accounts', async (req, res, next) => {
  try { const provider=req.body.provider;const label=text(req.body.label);if(!isProvider(provider)||!label)return res.status(400).json({success:false,error:'provider and label are required'});return res.status(201).json({success:true,data:await accounts.create(provider,label)}); } catch(error){next(error);}
});
router.post('/api/accounts/:id/connect', async (req,res,next)=>{try{return res.json({success:true,data:{account:await accounts.begin(req.params.id),consoleUrl:process.env.AUTH_CONSOLE_URL||'http://localhost:6080/vnc.html?autoconnect=1&resize=scale'}});}catch(error){next(error);}});
router.post('/api/accounts/:id/finish', async (req,res,next)=>{try{return res.json({success:true,data:await accounts.finish(req.params.id)});}catch(error){next(error);}});
router.delete('/api/accounts/:id', async (req,res,next)=>{try{const removed=await accounts.remove(req.params.id);return removed?res.status(204).end():res.status(404).json({success:false,error:'Account not found'});}catch(error){next(error);}});

router.post('/api/bots', async (req, res, next) => {
  try {
    const provider = req.body.provider;
    const name = text(req.body.name);
    const teamId = text(req.body.teamId);
    const userId = text(req.body.userId);
    const timezone = text(req.body.timezone) || 'UTC';
    const accountId = text(req.body.accountId) || undefined;
    if (accountId) { const account = await accounts.get(accountId); if (!account) return res.status(400).json({ success: false, error: 'Account not found' }); if (account.provider !== provider) return res.status(400).json({ success: false, error: 'Account provider must match bot provider' }); }
    if (!isProvider(provider) || !name || !teamId || !userId) {
      return res.status(400).json({ success: false, error: 'provider, name, teamId and userId are required' });
    }
    try {
      const bot = await store.addBot({ provider, name, teamId, userId, timezone, accountId });
      return res.status(201).json({ success: true, data: bot });
    } catch (error) {
      console.error('Failed to persist dashboard bot:', error);
      return res.status(500).json({
        success: false,
        error: 'Bot could not be saved. Check the dashboard data directory and volume permissions.',
      });
    }
  } catch (error) { next(error); }
});

router.delete('/api/bots/:id', async (req, res, next) => {
  try {
    const removed = await store.removeBot(req.params.id);
    return removed ? res.status(204).end() : res.status(404).json({ success: false, error: 'Bot not found' });
  } catch (error) { next(error); }
});

router.post('/api/bots/:id/join', async (req, res, next) => {
  try {
    const bot = await store.findBot(req.params.id);
    if (!bot) return res.status(404).json({ success: false, error: 'Bot not found' });
    const url = text(req.body.url);
    if (!url) return res.status(400).json({ success: false, error: 'Meeting URL is required' });
    const eventId = text(req.body.eventId);
    const botId = text(req.body.botId) || bot.id;
    const bearerToken = text(req.body.bearerToken) || process.env.DASHBOARD_BEARER_TOKEN || 'local-dashboard';
    const endpoint = `http://127.0.0.1:${config.port}/${bot.provider}/join`;
    const upstream = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url, name: bot.name, teamId: bot.teamId, userId: bot.userId, timezone: bot.timezone, botId, eventId: eventId || undefined, accountId: bot.accountId, meetingPassword: text(req.body.meetingPassword) || undefined, bearerToken }),
    });
    const payload = await upstream.json() as { success?: boolean; message?: string; error?: string };
    await store.addActivity({ botId: bot.id, provider: bot.provider, meetingUrl: url, status: upstream.ok ? 'accepted' : 'rejected', message: payload.message || payload.error || `HTTP ${upstream.status}` });
    return res.status(upstream.status).json(payload);
  } catch (error) { next(error); }
});

router.get('/api/recordings', async (_req, res, next) => {
  try { res.json({ success: true, data: await listRecordings(config.recordingsDir) }); }
  catch (error) { next(error); }
});

router.get('/api/recordings/:id', async (req: Request, res: Response, next) => {
  try {
    const filePath = resolveRecording(config.recordingsDir, req.params.id);
    if (!filePath) return res.status(404).json({ success: false, error: 'Recording not found' });
    await fs.promises.access(filePath, fs.constants.R_OK);
    if (req.query.download === '1') return res.download(filePath);
    return res.sendFile(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return res.status(404).json({ success: false, error: 'Recording not found' });
    return next(error);
  }
});

export default router;
