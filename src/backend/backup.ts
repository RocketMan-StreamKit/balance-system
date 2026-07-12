import { loadParams, saveParams, setViewerSavedHook } from '../balance/store';
import type { ViewerBackupData, ViewerEntry } from '../types';
import { resolveLicenseAuth } from './register';
import { buildApiUrl } from './urls';

type BackupApiResponse = {
  success?: boolean;
  code?: string;
  message?: string;
  data?: ViewerBackupData | null;
};

const BACKUP_DEBOUNCE_MS = 5_000;

let backupTimer: ReturnType<typeof setTimeout> | null = null;
let pendingViewers: ViewerEntry[] | null = null;
let uploadInFlight = false;

/**
 * Wires viewer save hook to debounced server backup uploads.
 * @example bindViewerBackupOnSave();
 */
export const bindViewerBackupOnSave = () => {
  setViewerSavedHook(viewers => {
    void scheduleViewerBackup(viewers);
  });
};

/**
 * Returns true when startup should restore viewer data from server backup.
 * @param params Current addon params.
 */
export const shouldAttemptViewerRestore = (params: {
  viewers: ViewerEntry[];
}) => params.viewers.length === 0;

/**
 * On startup with an empty viewer list, restores from server backup when available.
 * Runs even when server backup uploads are disabled in settings.
 * @example await restoreViewersFromBackup();
 */
export const restoreViewersFromBackup = async () => {
  const params = await loadParams();
  if (!shouldAttemptViewerRestore(params)) {
    return;
  }

  try {
    const backup = await fetchViewerBackup();
    if (!backup?.viewers?.length) {
      console.log('[balance] no server backup found for empty viewer list');
      return;
    }

    await saveParams({ viewers: backup.viewers }, { skipBackup: true });
    console.log(
      `[balance] restored ${backup.viewers.length} viewers from server backup`
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Viewer backup restore failed';
    console.warn('[balance] viewer backup restore failed:', message);
  }
};

/**
 * Schedules a debounced viewer backup upload when the setting is enabled.
 * @param viewers Viewer list to upload.
 */
export const scheduleViewerBackup = async (viewers: ViewerEntry[]) => {
  const params = await loadParams();
  if (!params.viewer_backup_enabled) {
    return;
  }

  pendingViewers = viewers;
  if (backupTimer) {
    clearTimeout(backupTimer);
  }

  backupTimer = setTimeout(() => {
    backupTimer = null;
    const snapshot = pendingViewers;
    pendingViewers = null;
    if (snapshot) {
      void uploadViewerBackup(snapshot);
    }
  }, BACKUP_DEBOUNCE_MS);
};

/**
 * Loads viewer backup from the balance backend.
 * @example const backup = await fetchViewerBackup();
 */
export const fetchViewerBackup = async (): Promise<ViewerBackupData | null> => {
  const licenseAuth = resolveLicenseAuth();
  const baseUrl = await buildApiUrl('/backup');
  const query = new URLSearchParams({
    licenseId: licenseAuth.licenseId,
    accessToken: licenseAuth.accessToken,
  });
  const url = `${baseUrl}?${query.toString()}`;

  console.log('[balance] backup restore →', url);
  const rawResponse = await network.request.get(url);
  const parsed = parseBackupResponse(url, rawResponse);

  if (!parsed.success) {
    throw new Error(parsed.message ?? parsed.code ?? 'Backup restore failed');
  }

  if (!parsed.data?.viewers?.length) {
    return null;
  }

  return {
    viewers: normalizeBackupViewers(parsed.data.viewers),
  };
};

/**
 * Uploads viewer backup to the balance backend.
 * @param viewers Viewer list to persist on the server.
 */
export const uploadViewerBackup = async (viewers: ViewerEntry[]) => {
  if (uploadInFlight) {
    pendingViewers = viewers;
    return;
  }

  uploadInFlight = true;
  try {
    const params = await loadParams();
    if (!params.viewer_backup_enabled) {
      return;
    }

    const licenseAuth = resolveLicenseAuth();
    const url = await buildApiUrl('/backup');
    const body = {
      ...licenseAuth,
      data: {
        viewers: normalizeBackupViewers(viewers),
      } satisfies ViewerBackupData,
    };

    console.log('[balance] backup upload →', url, `${viewers.length} viewers`);
    const rawResponse = await network.request.post(url, body);
    const parsed = parseBackupResponse(url, rawResponse);

    if (!parsed.success) {
      throw new Error(parsed.message ?? parsed.code ?? 'Backup upload failed');
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Viewer backup upload failed';
    console.warn('[balance] viewer backup upload failed:', message);
  } finally {
    uploadInFlight = false;
    if (pendingViewers) {
      const snapshot = pendingViewers;
      pendingViewers = null;
      void scheduleViewerBackup(snapshot);
    }
  }
};

const parseBackupResponse = (url: string, rawResponse: string) => {
  const trimmed = rawResponse.trim();

  if (trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html')) {
    console.error(
      '[balance] backup HTML response from',
      url,
      trimmed.slice(0, 200)
    );
    return {
      success: false as const,
      code: 'route_not_found',
      message: 'Balance backup API is not deployed on this server host.',
    };
  }

  try {
    return JSON.parse(trimmed) as BackupApiResponse;
  } catch (error) {
    console.error(
      '[balance] backup non-JSON response from',
      url,
      trimmed.slice(0, 500)
    );
    throw new Error(
      `Backend returned non-JSON response (${trimmed.slice(0, 80)})`
    );
  }
};

const normalizeBackupViewers = (raw: unknown): ViewerEntry[] => {
  if (!Array.isArray(raw)) {
    return [];
  }

  const viewers: ViewerEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') {
      continue;
    }

    const entry = item as Partial<ViewerEntry>;
    const twitchId = String(entry.twitchId ?? '').trim();
    const login = String(entry.login ?? '')
      .trim()
      .toLowerCase();
    const displayName = String(entry.displayName ?? login).trim();
    const balance = Number(entry.balance);

    if (!twitchId || !login || !Number.isFinite(balance)) {
      continue;
    }

    viewers.push({
      twitchId,
      login,
      displayName: displayName || login,
      balance,
      updatedAt:
        typeof entry.updatedAt === 'number' && Number.isFinite(entry.updatedAt)
          ? entry.updatedAt
          : Date.now(),
    });
  }

  return viewers.sort(
    (a, b) => b.balance - a.balance || a.login.localeCompare(b.login)
  );
};
