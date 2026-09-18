import fs from 'fs';
import path from 'path';

export interface RecordingItem {
  id: string;
  name: string;
  userId: string;
  size: number;
  updatedAt: string;
  streamUrl: string;
  downloadUrl: string;
  transcriptTextUrl?: string;
  transcriptJsonUrl?: string;
}

const allowedExtensions = new Set(['.webm', '.mp4', '.mkv', '.mp3', '.wav']);

export const encodeRecordingId = (relativePath: string): string => Buffer.from(relativePath, 'utf8').toString('base64url');
export const decodeRecordingId = (id: string): string => Buffer.from(id, 'base64url').toString('utf8');

export async function listRecordings(root: string): Promise<RecordingItem[]> {
  const resolvedRoot = path.resolve(root);
  let users: fs.Dirent[];
  try {
    users = await fs.promises.readdir(resolvedRoot, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }

  const recordings: RecordingItem[] = [];
  for (const user of users) {
    if (!user.isDirectory()) continue;
    const userDir = path.join(resolvedRoot, user.name);
    for (const entry of await fs.promises.readdir(userDir, { withFileTypes: true })) {
      if (!entry.isFile() || !allowedExtensions.has(path.extname(entry.name).toLowerCase())) continue;
      const fullPath = path.join(userDir, entry.name);
      const stats = await fs.promises.stat(fullPath);
      const relativePath = path.relative(resolvedRoot, fullPath);
      const id = encodeRecordingId(relativePath);
      recordings.push({
        id,
        name: entry.name,
        userId: user.name,
        size: stats.size,
        updatedAt: stats.mtime.toISOString(),
        streamUrl: `/api/recordings/${id}`,
        downloadUrl: `/api/recordings/${id}?download=1`,
        ...await transcriptLinks(fullPath, id),
      });
    }
  }
  return recordings.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

async function transcriptLinks(recordingPath: string, id: string): Promise<Pick<RecordingItem, 'transcriptTextUrl' | 'transcriptJsonUrl'>> {
  const [textExists, jsonExists] = await Promise.all([
    fs.promises.access(`${recordingPath}.transcript.txt`, fs.constants.R_OK).then(() => true).catch(() => false),
    fs.promises.access(`${recordingPath}.transcript.json`, fs.constants.R_OK).then(() => true).catch(() => false),
  ]);
  return {
    ...(textExists ? { transcriptTextUrl: `/api/recordings/${id}/transcript` } : {}),
    ...(jsonExists ? { transcriptJsonUrl: `/api/recordings/${id}/transcript?format=json` } : {}),
  };
}

export function resolveTranscript(root: string, id: string, format: 'text' | 'json'): string | undefined {
  const recordingPath = resolveRecording(root, id);
  return recordingPath ? `${recordingPath}.transcript.${format === 'json' ? 'json' : 'txt'}` : undefined;
}

export function resolveRecording(root: string, id: string): string | undefined {
  let relativePath: string;
  try {
    relativePath = decodeRecordingId(id);
  } catch {
    return undefined;
  }
  const resolvedRoot = path.resolve(root);
  const candidate = path.resolve(resolvedRoot, relativePath);
  if (!candidate.startsWith(`${resolvedRoot}${path.sep}`)) return undefined;
  if (!allowedExtensions.has(path.extname(candidate).toLowerCase())) return undefined;
  return candidate;
}
