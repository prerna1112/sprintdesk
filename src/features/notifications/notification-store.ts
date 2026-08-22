import { useStore } from 'zustand';
import { createStore, type StoreApi } from 'zustand/vanilla';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import type { AppNotification } from '../../domain/types';

export const NOTIFICATION_STORAGE_KEY = 'sprintdesk.notifications.v1';
export const NOTIFICATION_STORAGE_VERSION = 1;
/** Durable notification history is intentionally bounded; the panel pages it 20 at a time. */
export const NOTIFICATION_STORE_LIMIT = 100;
export const NOTIFICATION_PAGE_SIZE = 20;
export const NOTIFICATION_PERSISTENCE_WARNING = 'Notifications are available in this tab but may not survive reload.';

interface NotificationDomainStateV1 {
  version: 1;
  notifications: AppNotification[];
  seenSourceIds: string[];
  initializedFromSource: boolean;
}

export interface NotificationStore extends NotificationDomainStateV1 {
  hasHydrated: boolean;
  persistenceError: string | null;
  initializeNotifications: (notifications: AppNotification[]) => { initialized: boolean };
  mergeNotifications: (notifications: AppNotification[]) => { newCount: number };
  markRead: (id: string, readAt?: string) => boolean;
  markAllRead: (readAt?: string) => number;
}

const emptyDomainState = (): NotificationDomainStateV1 => ({
  version: 1,
  notifications: [],
  seenSourceIds: [],
  initializedFromSource: false,
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match) return false;
  const [, yearValue, monthValue, dayValue, hourValue, minuteValue, secondValue, zone] = match;
  const year = Number(yearValue);
  const month = Number(monthValue);
  const day = Number(dayValue);
  if (month < 1 || month > 12 || day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate()) return false;
  if (Number(hourValue) > 23 || Number(minuteValue) > 59 || Number(secondValue) > 59) return false;
  if (zone && zone !== 'Z') {
    const [zoneHour, zoneMinute] = zone.slice(1).split(':').map(Number);
    if ((zoneHour ?? 0) > 23 || (zoneMinute ?? 0) > 59) return false;
  }
  return Number.isFinite(Date.parse(value));
}

function isNotification(value: unknown): value is AppNotification {
  if (!isRecord(value)) return false;
  const source = value.source;
  const expectedPrefix = source === 'mock' ? 'mock:' : source === 'jsonPlaceholder' ? 'jsonPlaceholder:' : null;
  return expectedPrefix !== null
    && typeof value.id === 'string' && value.id.startsWith(expectedPrefix)
    && typeof value.sourceId === 'string' && value.sourceId.startsWith(expectedPrefix)
    && value.id === value.sourceId
    && typeof value.title === 'string' && value.title.trim().length > 0
    && typeof value.body === 'string' && value.body.trim().length > 0
    && isTimestamp(value.createdAt)
    && (value.readAt === null || isTimestamp(value.readAt));
}

export function sortNotifications(notifications: AppNotification[]): AppNotification[] {
  return [...notifications].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id));
}

function parsePersistedDomain(value: unknown): NotificationDomainStateV1 | null {
  if (!isRecord(value) || value.version !== 1 || typeof value.initializedFromSource !== 'boolean') return null;
  const keys = Object.keys(value).sort();
  const expected = ['initializedFromSource', 'notifications', 'seenSourceIds', 'version'];
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) return null;
  if (!Array.isArray(value.notifications) || value.notifications.length > NOTIFICATION_STORE_LIMIT
    || !value.notifications.every(isNotification)) return null;
  if (!Array.isArray(value.seenSourceIds)
    || !value.seenSourceIds.every((id) => typeof id === 'string' && id.length > 0)) return null;
  const notifications = value.notifications as AppNotification[];
  const seenSourceIds = value.seenSourceIds as string[];
  if (new Set(notifications.map(({ id }) => id)).size !== notifications.length
    || new Set(notifications.map(({ sourceId }) => sourceId)).size !== notifications.length
    || new Set(seenSourceIds).size !== seenSourceIds.length
    || notifications.some(({ sourceId }) => !seenSourceIds.includes(sourceId))) return null;
  return {
    version: 1,
    notifications: sortNotifications(notifications),
    seenSourceIds: [...seenSourceIds],
    initializedFromSource: value.initializedFromSource,
  };
}

function createResilientStateStorage(
  getStorage: () => Storage | undefined,
  reportError: () => void,
  isReportingError: () => boolean,
): StateStorage {
  const memory = new Map<string, string>();
  let durabilityFailed = false;
  return {
    getItem: (name) => {
      if (durabilityFailed) return memory.get(name) ?? null;
      try {
        const storage = getStorage();
        if (!storage) throw new DOMException('Unavailable', 'SecurityError');
        const value = storage.getItem(name) ?? memory.get(name) ?? null;
        if (value !== null) memory.set(name, value);
        return value;
      } catch {
        durabilityFailed = true;
        reportError();
        return memory.get(name) ?? null;
      }
    },
    setItem: (name, value) => {
      if (isReportingError()) return;
      memory.set(name, value);
      try {
        const storage = getStorage();
        if (!storage) throw new DOMException('Unavailable', 'SecurityError');
        storage.setItem(name, value);
      } catch {
        durabilityFailed = true;
        reportError();
      }
    },
    removeItem: (name) => {
      memory.delete(name);
      try {
        const storage = getStorage();
        if (!storage) throw new DOMException('Unavailable', 'SecurityError');
        storage.removeItem(name);
      } catch {
        durabilityFailed = true;
        reportError();
      }
    },
  };
}

function normalizeIncoming(notifications: AppNotification[]): AppNotification[] {
  const sourceIds = new Set<string>();
  return notifications.filter((notification) => {
    if (!isNotification(notification) || sourceIds.has(notification.sourceId)) return false;
    sourceIds.add(notification.sourceId);
    return true;
  });
}

export function createNotificationStore(options: {
  skipHydration?: boolean;
  getStorage?: () => Storage | undefined;
} = {}) {
  let storeRef: StoreApi<NotificationStore> | null = null;
  let pendingPersistenceError = false;
  let reportingPersistenceError = false;
  const reportPersistenceError = () => {
    pendingPersistenceError = true;
    if (!storeRef || reportingPersistenceError || storeRef.getState().persistenceError) return;
    reportingPersistenceError = true;
    storeRef.setState({ persistenceError: NOTIFICATION_PERSISTENCE_WARNING });
    reportingPersistenceError = false;
  };
  const getStorage = options.getStorage ?? (() => (typeof window === 'undefined' ? undefined : window.localStorage));
  const storage = createJSONStorage(() => createResilientStateStorage(
    getStorage,
    reportPersistenceError,
    () => reportingPersistenceError,
  ));

  const store = createStore<NotificationStore>()(persist(
    (set) => ({
      ...emptyDomainState(),
      hasHydrated: false,
      persistenceError: null,
      initializeNotifications: (incoming) => {
        let initialized = false;
        set((state) => {
          if (state.initializedFromSource) return state;
          const valid = normalizeIncoming(incoming);
          const bySourceId = new Map(state.notifications.map((notification) => [notification.sourceId, notification]));
          valid.forEach((notification) => {
            if (!bySourceId.has(notification.sourceId)) bySourceId.set(notification.sourceId, { ...notification });
          });
          initialized = true;
          return {
            notifications: sortNotifications([...bySourceId.values()]).slice(0, NOTIFICATION_STORE_LIMIT),
            seenSourceIds: [...new Set([...state.seenSourceIds, ...valid.map(({ sourceId }) => sourceId)])],
            initializedFromSource: true,
          };
        });
        return { initialized };
      },
      mergeNotifications: (incoming) => {
        let newCount = 0;
        set((state) => {
          const seen = new Set(state.seenSourceIds);
          const additions = normalizeIncoming(incoming).filter(({ sourceId }) => !seen.has(sourceId));
          if (additions.length === 0) return state;
          newCount = additions.length;
          return {
            notifications: sortNotifications([
              ...state.notifications,
              ...additions.map((notification) => ({ ...notification })),
            ]).slice(0, NOTIFICATION_STORE_LIMIT),
            seenSourceIds: [...seen, ...additions.map(({ sourceId }) => sourceId)],
          };
        });
        return { newCount };
      },
      markRead: (id, readAt = new Date().toISOString()) => {
        let changed = false;
        set((state) => ({
          notifications: state.notifications.map((notification) => {
            if (notification.id !== id || notification.readAt !== null) return notification;
            changed = true;
            return { ...notification, readAt };
          }),
        }));
        return changed;
      },
      markAllRead: (readAt = new Date().toISOString()) => {
        let changed = 0;
        set((state) => ({
          notifications: state.notifications.map((notification) => {
            if (notification.readAt !== null) return notification;
            changed += 1;
            return { ...notification, readAt };
          }),
        }));
        return changed;
      },
    }),
    {
      name: NOTIFICATION_STORAGE_KEY,
      version: NOTIFICATION_STORAGE_VERSION,
      storage,
      skipHydration: options.skipHydration ?? true,
      partialize: (state) => ({
        version: state.version,
        notifications: state.notifications,
        seenSourceIds: state.seenSourceIds,
        initializedFromSource: state.initializedFromSource,
      }) as NotificationStore,
      migrate: () => emptyDomainState() as NotificationStore,
      merge: (persisted, current) => {
        const parsed = parsePersistedDomain(persisted);
        return parsed ? { ...current, ...parsed } : current;
      },
      onRehydrateStorage: () => () => {
        queueMicrotask(() => storeRef?.setState({ hasHydrated: true }));
      },
    },
  ));
  storeRef = store;
  if (pendingPersistenceError) queueMicrotask(reportPersistenceError);
  return store;
}

export const notificationStore = createNotificationStore({ skipHydration: false });

export function useNotificationStore<T>(selector: (state: NotificationStore) => T): T {
  return useStore(notificationStore, selector);
}

export const selectUnreadNotificationCount = (state: NotificationStore): number =>
  state.notifications.filter(({ readAt }) => readAt === null).length;

export const selectNotificationTotalPages = (state: NotificationStore): number =>
  Math.max(1, Math.ceil(state.notifications.length / NOTIFICATION_PAGE_SIZE));

export const selectNotificationPage = (state: NotificationStore, page: number): AppNotification[] => {
  const totalPages = selectNotificationTotalPages(state);
  const safePage = Math.min(Math.max(1, Math.trunc(page) || 1), totalPages);
  const start = (safePage - 1) * NOTIFICATION_PAGE_SIZE;
  return state.notifications.slice(start, start + NOTIFICATION_PAGE_SIZE);
};

export function resetNotificationStore(): void {
  notificationStore.setState({
    ...emptyDomainState(),
    hasHydrated: true,
    persistenceError: null,
  });
}
