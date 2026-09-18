import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { listRecordings, resolveTranscript } from './recordings';

test('listRecordings exposes transcript sidecars without listing them as recordings', async () => {
  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'meeting-bot-recordings-'));
  try {
    const userDir = path.join(root, 'user-1');
    await fs.promises.mkdir(userDir);
    const recording = path.join(userDir, 'meeting.webm');
    await fs.promises.writeFile(recording, 'video');
    await fs.promises.writeFile(`${recording}.transcript.txt`, 'Hello meeting\n');
    await fs.promises.writeFile(`${recording}.transcript.json`, '{"text":"Hello meeting"}\n');
    const items = await listRecordings(root);
    assert.equal(items.length, 1);
    assert.match(items[0].transcriptTextUrl ?? '', /\/transcript$/);
    assert.match(items[0].transcriptJsonUrl ?? '', /format=json$/);
    assert.equal(resolveTranscript(root, items[0].id, 'text'), `${recording}.transcript.txt`);
  } finally {
    await fs.promises.rm(root, { recursive: true, force: true });
  }
});
