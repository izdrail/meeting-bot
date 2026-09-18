import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { MeetingProvider } from '../app/common';

export interface ManagedBot {
  id: string;
  name: string;
  provider: MeetingProvider;
  teamId: string;
  userId: string;
  timezone: string;
  accountId?: string;
  createdAt: string;
}

export interface JoinActivity {
  id: string;
  botId: string;
  provider: MeetingProvider;
  meetingUrl: string;
  status: 'accepted' | 'rejected';
  message: string;
  createdAt: string;
}

interface DashboardState {
  bots: ManagedBot[];
  activity: JoinActivity[];
}

const emptyState = (): DashboardState => ({ bots: [], activity: [] });

export class DashboardStore {
  constructor(private readonly statePath: string) {}

  private async read(): Promise<DashboardState> {
    try {
      const raw = await fs.promises.readFile(this.statePath, 'utf8');
      const parsed = JSON.parse(raw) as Partial<DashboardState>;
      return {
        bots: Array.isArray(parsed.bots) ? parsed.bots : [],
        activity: Array.isArray(parsed.activity) ? parsed.activity : [],
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return emptyState();
      throw error;
    }
  }

  private async write(state: DashboardState): Promise<void> {
    const directory = path.dirname(this.statePath);
    await fs.promises.mkdir(directory, { recursive: true });
    await fs.promises.access(directory, fs.constants.W_OK);
    const tempPath = `${this.statePath}.${process.pid}.${randomUUID()}.tmp`;
    try {
      await fs.promises.writeFile(tempPath, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
      await fs.promises.rename(tempPath, this.statePath);
    } finally {
      await fs.promises.rm(tempPath, { force: true }).catch(() => undefined);
    }
  }

  async snapshot(): Promise<DashboardState> {
    return this.read();
  }

  async addBot(input: Omit<ManagedBot, 'id' | 'createdAt'>): Promise<ManagedBot> {
    const state = await this.read();
    const bot: ManagedBot = { ...input, id: randomUUID(), createdAt: new Date().toISOString() };
    state.bots.unshift(bot);
    await this.write(state);
    return bot;
  }

  async removeBot(id: string): Promise<boolean> {
    const state = await this.read();
    const next = state.bots.filter((bot) => bot.id !== id);
    if (next.length === state.bots.length) return false;
    state.bots = next;
    await this.write(state);
    return true;
  }

  async findBot(id: string): Promise<ManagedBot | undefined> {
    const state = await this.read();
    return state.bots.find((bot) => bot.id === id);
  }

  async addActivity(input: Omit<JoinActivity, 'id' | 'createdAt'>): Promise<JoinActivity> {
    const state = await this.read();
    const item: JoinActivity = { ...input, id: randomUUID(), createdAt: new Date().toISOString() };
    state.activity = [item, ...state.activity].slice(0, 50);
    await this.write(state);
    return item;
  }
}
