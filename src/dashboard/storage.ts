import fs from 'fs';
import path from 'path';

const isContainerEnvironment = (): boolean => process.env.NODE_ENV === 'production';

export const dashboardDataDir = (): string => {
  const configured = process.env.DASHBOARD_DATA_DIR || process.env.DATA_DIR;
  return configured ? path.resolve(configured) : isContainerEnvironment() ? '/data' : path.resolve('data');
};

export const dashboardStatePath = (): string =>
  process.env.DASHBOARD_STATE_PATH || path.join(dashboardDataDir(), 'meeting-bot-dashboard.json');

export const authProfilesDir = (): string =>
  process.env.AUTH_PROFILES_DIR || path.join(dashboardDataDir(), 'auth-profiles');

export const authAccountsPath = (): string =>
  process.env.AUTH_ACCOUNTS_PATH || path.join(dashboardDataDir(), 'auth-accounts.json');

export const initializeDashboardStorage = async (directory = dashboardDataDir()): Promise<void> => {
  try {
    await fs.promises.mkdir(directory, { recursive: true });
    await fs.promises.access(directory, fs.constants.W_OK);
  } catch (error) {
    const message = `Data directory ${directory} is not writable. Check volume mount and ownership.`;
    console.error(message, error);
    throw new Error(message);
  }
};
