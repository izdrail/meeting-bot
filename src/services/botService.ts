import { createApiV2, buildApiUrl, getAuthBaseUrlV2 } from '../util/auth';
import { resolveAuthBaseUrlV2 } from '../config';
import { BotStatus, IVFSResponse, LogCategory, LogSubCategory } from '../types';
import config from '../config';
import { Logger } from 'winston';

/**
 * Backend status/log reporting is optional in self-hosted local-only mode.
 * Returns the validated base URL, or undefined when reporting is disabled.
 * Throws ConfigError when a value is set but is not an absolute http(s) URL,
 * so a misconfiguration surfaces as a clear error instead of axios' opaque
 * "Invalid URL" TypeError mid-flight.
 */
const resolveStatusApiBase = (logger: Logger, operation: string): string | undefined => {
  const base = resolveAuthBaseUrlV2();
  if (!base) {
    logger.warn(`Skipping "${operation}" - AUTH_BASE_URL_V2 is not configured, backend reporting is disabled (local-only mode)`);
    return undefined;
  }
  return getAuthBaseUrlV2();
};

export const patchBotStatus = async ({
  eventId,
  botId,
  provider,
  status,
  token,
}: {
    eventId?: string,
    token: string,
    botId?: string,
    provider: 'google' | 'microsoft' | 'zoom',
    status: BotStatus[],
}, logger: Logger) => {
  const base = resolveStatusApiBase(logger, 'patchBotStatus');
  if (!base) return false;
  const url = buildApiUrl('/meeting/app/bot/status', base);
  try {
    const apiV2 = createApiV2(token, config.serviceKey);
    const response = await apiV2.patch<
        IVFSResponse<never>
    >(url, {
      eventId,
      botId,
      provider,
      status,
    });
    return response.data.success;
  } catch(e: any) {
    logger.error('Can\'t update the bot status', {
      url,
      error: e?.message || String(e),
      status: e?.response?.status,
      statusText: e?.response?.statusText,
      responseData: e?.response?.data,
      requestData: { eventId, botId, provider, status },
      stack: e?.stack
    });
    return false;
  }
};

export const addBotLog = async ({
  eventId,
  botId,
  provider,
  level,
  message,
  category,
  subCategory,
  token,
}: {
    eventId?: string,
    token: string,
    botId?: string,
    provider: 'google' | 'microsoft' | 'zoom',
    level: 'info' | 'error',
    message: string,
    category: LogCategory,
    subCategory: LogSubCategory<LogCategory>,
}, logger: Logger) => {
  const base = resolveStatusApiBase(logger, 'addBotLog');
  if (!base) return false;
  const url = buildApiUrl('/meeting/app/bot/log', base);
  try {
    const apiV2 = createApiV2(token, config.serviceKey);
    const response = await apiV2.patch<
        IVFSResponse<never>
    >(url, {
      eventId,
      botId,
      provider,
      level,
      message,
      category,
      subCategory,
    });
    return response.data.success;
  } catch(e: any) {
    logger.error('Can\'t add the bot log', {
      url,
      error: e?.message || String(e),
      status: e?.response?.status,
      statusText: e?.response?.statusText,
      responseData: e?.response?.data,
      requestData: { eventId, botId, provider, level, message, category, subCategory },
      stack: e?.stack
    });
    return false;
  }
};
