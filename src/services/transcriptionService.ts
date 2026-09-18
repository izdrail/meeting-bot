import axios from 'axios';
import { execFile } from 'child_process';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { Logger } from 'winston';
import config from '../config';

const execFileAsync = promisify(execFile);

export interface TranscriptDocument {
  text: string;
  language?: string;
  segments?: unknown[];
  recording: string;
  createdAt: string;
  engine: 'whisper-http';
  model?: string;
}

export interface TranscriptionResult {
  textPath: string;
  jsonPath: string;
  document: TranscriptDocument;
}

function transcriptPaths(recordingPath: string) {
  return {
    textPath: `${recordingPath}.transcript.txt`,
    jsonPath: `${recordingPath}.transcript.json`,
  };
}

export async function transcribeRecording(
  recordingPath: string,
  logger: Logger,
): Promise<TranscriptionResult | undefined> {
  if (!config.transcription.enabled) return undefined;

  const audioPath = `${recordingPath}.transcription-${process.pid}-${Date.now()}.wav`;
  const { textPath, jsonPath } = transcriptPaths(recordingPath);
  try {
    logger.info('Preparing recording audio for local transcription', { recordingPath });
    await execFileAsync('ffmpeg', [
      '-y', '-i', recordingPath, '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', audioPath,
    ], { maxBuffer: 10 * 1024 * 1024 });

    const form = new FormData();
    form.append('audio_file', fs.createReadStream(audioPath), {
      filename: path.basename(audioPath),
      contentType: 'audio/wav',
    });
    const url = new URL(config.transcription.url);
    url.searchParams.set('output', 'json');
    url.searchParams.set('task', 'transcribe');
    if (config.transcription.language) url.searchParams.set('language', config.transcription.language);

    const response = await axios.post(url.toString(), form, {
      headers: form.getHeaders(),
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      timeout: config.transcription.timeoutMs,
    });
    const payload = response.data;
    const text = typeof payload === 'string' ? payload.trim() : String(payload?.text ?? '').trim();
    if (!text) throw new Error('Transcription service returned no text');

    const document: TranscriptDocument = {
      text,
      ...(typeof payload?.language === 'string' ? { language: payload.language } : {}),
      ...(Array.isArray(payload?.segments) ? { segments: payload.segments } : {}),
      recording: path.basename(recordingPath),
      createdAt: new Date().toISOString(),
      engine: 'whisper-http',
      ...(config.transcription.model ? { model: config.transcription.model } : {}),
    };
    await Promise.all([
      fs.promises.writeFile(textPath, `${text}\n`, 'utf8'),
      fs.promises.writeFile(jsonPath, `${JSON.stringify(document, null, 2)}\n`, 'utf8'),
    ]);
    logger.info('Meeting transcription completed', { recordingPath, textPath, jsonPath });
    return { textPath, jsonPath, document };
  } finally {
    await fs.promises.rm(audioPath, { force: true }).catch(() => undefined);
  }
}
