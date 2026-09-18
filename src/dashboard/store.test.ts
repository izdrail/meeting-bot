import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { DashboardStore } from './store';

test('DashboardStore writes a bot atomically to a configurable temporary directory', async () => {
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'meeting-bot-store-'));
  const statePath = path.join(directory, 'nested', 'state.json');
  try {
    const store = new DashboardStore(statePath);
    const bot = await store.addBot({
      provider: 'google',
      name: 'Recorder',
      teamId: 'team',
      userId: 'user',
      timezone: 'Europe/London',
    });
    const saved = JSON.parse(await fs.promises.readFile(statePath, 'utf8'));
    assert.equal(saved.bots.length, 1);
    assert.equal(saved.bots[0].id, bot.id);
    assert.deepEqual(await fs.promises.readdir(path.dirname(statePath)), ['state.json']);
  } finally {
    await fs.promises.rm(directory, { recursive: true, force: true });
  }
});

test('DashboardStore leaves no partial state when the configured path cannot be written', async () => {
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'meeting-bot-store-failure-'));
  const blockingFile = path.join(directory, 'not-a-directory');
  await fs.promises.writeFile(blockingFile, 'blocking file');
  const statePath = path.join(blockingFile, 'state.json');
  try {
    const store = new DashboardStore(statePath);
    await assert.rejects(store.addBot({
      provider: 'google',
      name: 'Recorder',
      teamId: 'team',
      userId: 'user',
      timezone: 'Europe/London',
    }));
    assert.equal(await fs.promises.readFile(blockingFile, 'utf8'), 'blocking file');
  } finally {
    await fs.promises.rm(directory, { recursive: true, force: true });
  }
});
