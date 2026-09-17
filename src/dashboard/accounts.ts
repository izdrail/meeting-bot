import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { BrowserContext } from 'playwright';
import { chromium } from 'playwright-extra';
import config from '../config';
import { MeetingProvider } from '../app/common';

export interface AuthAccount { id: string; provider: MeetingProvider; label: string; status: 'created' | 'connecting' | 'connected'; createdAt: string; updatedAt: string; }
const loginUrls: Record<MeetingProvider, string> = { google: 'https://accounts.google.com/', microsoft: 'https://login.microsoftonline.com/', zoom: 'https://zoom.us/signin' };

export class AccountService {
  private sessions = new Map<string, BrowserContext>();
  constructor(private readonly root: string, private readonly metadataPath: string) {}
  private async read(): Promise<AuthAccount[]> { try { return JSON.parse(await fs.promises.readFile(this.metadataPath, 'utf8')); } catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return []; throw e; } }
  private async write(accounts: AuthAccount[]) { await fs.promises.mkdir(path.dirname(this.metadataPath), { recursive: true }); await fs.promises.writeFile(this.metadataPath, `${JSON.stringify(accounts, null, 2)}\n`, { mode: 0o600 }); }
  async list() { return this.read(); }
  profilePath(id: string) { if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error('Invalid account id'); return path.join(this.root, id); }
  async create(provider: MeetingProvider, label: string) { const accounts=await this.read(); const now=new Date().toISOString(); const account:AuthAccount={id:randomUUID(),provider,label,status:'created',createdAt:now,updatedAt:now};accounts.unshift(account);await this.write(accounts);return account; }
  async get(id: string) { return (await this.read()).find(a=>a.id===id); }
  private async update(id:string, changes:Partial<AuthAccount>) { const accounts=await this.read();const i=accounts.findIndex(a=>a.id===id);if(i<0)throw new Error('Account not found');accounts[i]={...accounts[i],...changes,updatedAt:new Date().toISOString()};await this.write(accounts);return accounts[i]; }
  async begin(id:string) { const account=await this.get(id);if(!account)throw new Error('Account not found');await this.sessions.get(id)?.close().catch(()=>undefined);await fs.promises.mkdir(this.profilePath(id),{recursive:true});const context=await chromium.launchPersistentContext(this.profilePath(id),{headless:false,executablePath:config.chromeExecutablePath,viewport:{width:1280,height:720},args:['--no-sandbox','--disable-setuid-sandbox','--window-size=1280,800','--start-maximized','--no-first-run','--no-default-browser-check'],ignoreDefaultArgs:['--mute-audio']});this.sessions.set(id,context);const page=context.pages()[0]??await context.newPage();await page.goto(loginUrls[account.provider],{waitUntil:'domcontentloaded'});return this.update(id,{status:'connecting'}); }
  async finish(id:string) { const session=this.sessions.get(id);if(session){await session.close();this.sessions.delete(id);}return this.update(id,{status:'connected'}); }
  async remove(id:string) { const session=this.sessions.get(id);if(session){await session.close();this.sessions.delete(id);}const accounts=await this.read();const next=accounts.filter(a=>a.id!==id);if(next.length===accounts.length)return false;await this.write(next);await fs.promises.rm(this.profilePath(id),{recursive:true,force:true});return true; }
}
