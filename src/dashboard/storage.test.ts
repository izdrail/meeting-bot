import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { initializeDashboardStorage } from './storage';

test('initializeDashboardStorage creates the configured directory', async () => {
  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'meeting-bot-storage-'));
  const directory = path.join(root, 'nested', 'data');
  try {
    await initializeDashboardStorage(directory);
    await fs.promises.access(directory, fs.constants.W_OK);
  } finally {
    await fs.promises.rm(root, { recursive: true, force: true });
  }
});

test('initializeDashboardStorage reports an actionable fatal error', async () => {
  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'meeting-bot-storage-failure-'));
  const blockingFile = path.join(root, 'not-a-directory');
  await fs.promises.writeFile(blockingFile, 'blocking file');
  const directory = path.join(blockingFile, 'data');
  const originalConsoleError = console.error;
  console.error = () => undefined;
  try {
    await assert.rejects(
      initializeDashboardStorage(directory),
      new RegExp(`Data directory ${directory.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} is not writable\\. Check volume mount and ownership\\.`),
    );
  } finally {
    console.error = originalConsoleError;
    await fs.promises.rm(root, { recursive: true, force: true });
  }
});
