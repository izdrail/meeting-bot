import fs from 'fs';
import os from 'os';
import path from 'path';
import DiskUploader from '../src/middleware/disk-uploader';

const logger = {
  info: () => undefined,
  warn: () => undefined,
  error: console.error,
} as any;

async function main() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'meeting-bot-local-'));
  process.env.UPLOADER_TYPE = 'local';
  process.env.RECORDINGS_DIR = root;
  process.env.UPLOADER_FILE_EXTENSION = '.bin';

  // Config is loaded by DiskUploader before main, so mutate its resolved values too.
  const config = (await import('../src/config')).default;
  config.uploaderType = 'local';
  config.recordingsDir = root;
  config.uploaderFileExtension = '.bin';

  const uploader = await DiskUploader.initialize(
    '', '', 'UTC', 'local-test-user', 'bot-test', 'Local Test', 'recording-test', logger
  );
  const payload = Buffer.from('meeting-bot-local-storage-test');
  if (!await uploader.saveDataToTempFile(payload)) throw new Error('Failed to write test data');
  if (!await uploader.uploadRecordingToRemoteStorage()) throw new Error('Failed to finalize local recording');

  const userDir = path.join(root, 'local-test-user');
  const files = fs.readdirSync(userDir);
  if (files.length !== 1) throw new Error(`Expected one local recording, found ${files.length}`);
  const stored = fs.readFileSync(path.join(userDir, files[0]));
  if (!stored.equals(payload)) throw new Error('Stored recording bytes do not match input');
  console.log(`Local storage test passed: ${path.join(userDir, files[0])}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
