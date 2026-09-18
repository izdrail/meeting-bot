import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import config from '../config';
import { transcribeRecording } from './transcriptionService';

const logger = { info() {}, error() {}, warn() {} } as any;

test('transcribeRecording saves text and structured sidecars', async () => {
  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'meeting-bot-transcribe-'));
  const recording = path.join(root, 'meeting.wav');
  const server = http.createServer((req, res) => {
    req.resume();
    req.on('end', () => {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ text: 'Hello from the meeting.', language: 'en', segments: [{ text: 'Hello' }] }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert(address && typeof address !== 'string');
  const previous = { ...config.transcription };
  Object.assign(config.transcription, { enabled: true, url: `http://127.0.0.1:${address.port}/asr`, timeoutMs: 5000 });
  try {
    // CI does not install ffmpeg. Put a deterministic stand-in first on PATH;
    // the service still exercises execFile, multipart upload and sidecar writes.
    await fs.promises.writeFile(recording, 'recording-bytes');
    const binDir = path.join(root, 'bin');
    await fs.promises.mkdir(binDir);
    const fakeFfmpeg = path.join(binDir, 'ffmpeg');
    await fs.promises.writeFile(fakeFfmpeg, '#!/bin/sh\nfor last do :; done\ncp "$3" "$last"\n', { mode: 0o755 });
    const previousPath = process.env.PATH;
    process.env.PATH = `${binDir}:${previousPath ?? ''}`;
    const result = await transcribeRecording(recording, logger);
    process.env.PATH = previousPath;
    assert(result);
    assert.equal(await fs.promises.readFile(result.textPath, 'utf8'), 'Hello from the meeting.\n');
    const document = JSON.parse(await fs.promises.readFile(result.jsonPath, 'utf8'));
    assert.equal(document.text, 'Hello from the meeting.');
    assert.equal(document.language, 'en');
    assert.equal(document.recording, 'meeting.wav');
  } finally {
    Object.assign(config.transcription, previous);
    server.close();
    await fs.promises.rm(root, { recursive: true, force: true });
  }
});
