/**
 * Poolside Offline-First Store & Auto-Sync Engine
 * Ensures 100% resilient timing operations at the pool deck even during total network blackouts.
 * Caches heat times, splits, DQs and official stamps locally, automatically syncing
 * back to the cloud as soon as connection is restored.
 */

export interface OfflineHeatCapturePayload {
  queueId: string;
  meetId: string;
  eventId: string;
  heatNumber: number;
  round: string;
  capturedAt: string; // ISO
  capturedBy: string;
  rows: {
    laneNumber: number;
    timeMs: number | null;
    status: 'OK' | 'DQ' | 'NS' | 'SCR' | 'EXH';
    dqCode?: string;
    splits?: { distance: number; timeMs: number }[];
  }[];
  synced: boolean;
  syncAttempts: number;
  lastError?: string;
}

const OFFLINE_QUEUE_KEY = 'swim_lane_coach_offline_timing_queue';

let inMemoryQueue: OfflineHeatCapturePayload[] = [];

/**
 * Returns all captured heats waiting in the local queue.
 */
export function getOfflineTimingQueue(): OfflineHeatCapturePayload[] {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = window.localStorage.getItem(OFFLINE_QUEUE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [...inMemoryQueue];
    }
  }
  return [...inMemoryQueue];
}

/**
 * Saves a heat capture to the local offline queue.
 */
export function enqueueOfflineHeat(
  payload: Omit<OfflineHeatCapturePayload, 'queueId' | 'capturedAt' | 'synced' | 'syncAttempts'>
): OfflineHeatCapturePayload {
  const item: OfflineHeatCapturePayload = {
    ...payload,
    queueId: `queue_${payload.meetId}_${payload.eventId}_h${payload.heatNumber}_${Date.now()}`,
    capturedAt: new Date().toISOString(),
    synced: false,
    syncAttempts: 0,
  };

  const current = getOfflineTimingQueue();
  const filtered = current.filter(
    (c) => !(c.meetId === item.meetId && c.eventId === item.eventId && c.heatNumber === item.heatNumber && c.round === item.round)
  );
  filtered.push(item);

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(filtered));
    } catch {
      inMemoryQueue = filtered;
    }
  } else {
    inMemoryQueue = filtered;
  }

  return item;
}

/**
 * Removes or marks an item as synced in the local queue.
 */
export function markOfflineHeatSynced(queueId: string): void {
  const current = getOfflineTimingQueue();
  const updated = current.filter((item) => item.queueId !== queueId);

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(updated));
    } catch {
      inMemoryQueue = updated;
    }
  } else {
    inMemoryQueue = updated;
  }
}

/**
 * Drains the offline queue by calling the remote sync callback for each item.
 */
export async function drainOfflineQueue(
  syncItemFn: (item: OfflineHeatCapturePayload) => Promise<boolean>
): Promise<{ syncedCount: number; remainingCount: number }> {
  const queue = getOfflineTimingQueue();
  if (queue.length === 0) return { syncedCount: 0, remainingCount: 0 };

  let syncedCount = 0;
  for (const item of queue) {
    try {
      const success = await syncItemFn(item);
      if (success) {
        markOfflineHeatSynced(item.queueId);
        syncedCount++;
      }
    } catch (err) {
      item.syncAttempts++;
      item.lastError = err instanceof Error ? err.message : 'Error desconocido';
    }
  }

  const remaining = getOfflineTimingQueue().length;
  return { syncedCount, remainingCount: remaining };
}

/**
 * Exports all offline captured data into a downloadable JSON backup.
 */
export function exportOfflineQueueBackupJson(): string {
  const queue = getOfflineTimingQueue();
  return JSON.stringify({
    exportedAt: new Date().toISOString(),
    totalHeats: queue.length,
    heats: queue,
  }, null, 2);
}

/**
 * Online / Offline connectivity listener
 */
export function registerNetworkSyncListener(onNetworkStatusChange: (isOnline: boolean) => void): () => void {
  if (typeof window === 'undefined') return () => {};

  const handleOnline = () => onNetworkStatusChange(true);
  const handleOffline = () => onNetworkStatusChange(false);

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}
