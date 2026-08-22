import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppNotification } from '../../domain/types';
import {
  NOTIFICATION_PAGE_SIZE,
  NOTIFICATION_PERSISTENCE_WARNING,
  NOTIFICATION_SEEN_SOURCE_LIMIT,
  NOTIFICATION_STORAGE_KEY,
  NOTIFICATION_STORE_LIMIT,
  createNotificationStore,
  selectNotificationPage,
  selectNotificationTotalPages,
  selectUnreadNotificationCount,
} from './notification-store';

function item(id: string, createdAt: string, readAt: string | null = null): AppNotification {
  const source = id.startsWith('mock:') ? 'mock' : 'jsonPlaceholder';
  return { id, source, sourceId: id, title: `Title ${id}`, body: `Body ${id}`, createdAt, readAt };
}

async function ready(store: ReturnType<typeof createNotificationStore>) {
  await store.persist.rehydrate();
  return store;
}

const initial = [
  item('mock:101', '2026-08-19T11:10:00.000Z'),
  item('mock:102', '2026-08-19T13:30:00.000Z'),
  item('mock:103', '2026-08-18T16:20:00.000Z', '2026-08-18T16:20:00.000Z'),
  item('mock:104', '2026-08-19T14:00:00.000Z'),
];

describe('notification store', () => {
  beforeEach(() => localStorage.clear());

  it('seeds once, sorts latest-first, and preserves user read state', async () => {
    const store = await ready(createNotificationStore());
    expect(store.getState().initializeNotifications(initial)).toEqual({ initialized: true });
    expect(store.getState().notifications.map(({ id }) => id)).toEqual([
      'mock:104', 'mock:102', 'mock:101', 'mock:103',
    ]);
    store.getState().markRead('mock:104', '2026-08-22T00:00:00.000Z');
    expect(store.getState().initializeNotifications(initial)).toEqual({ initialized: false });
    expect(store.getState().notifications[0]?.readAt).toBe('2026-08-22T00:00:00.000Z');
    expect(selectUnreadNotificationCount(store.getState())).toBe(2);
  });

  it('deduplicates polls without resetting timestamps or read state', async () => {
    const store = await ready(createNotificationStore());
    store.getState().initializeNotifications(initial);
    const polled = Array.from({ length: 5 }, (_, index) => item(
      `jsonPlaceholder:${index + 1}`,
      '2026-08-22T12:00:00.000Z',
    ));
    expect(store.getState().mergeNotifications(polled)).toEqual({ newCount: 5 });
    expect(store.getState().notifications).toHaveLength(9);
    expect(selectUnreadNotificationCount(store.getState())).toBe(8);
    store.getState().markRead('jsonPlaceholder:1', '2026-08-22T12:01:00.000Z');
    expect(store.getState().mergeNotifications(polled.map((notification) => ({
      ...notification, createdAt: '2026-08-22T13:00:00.000Z', readAt: null,
    })))).toEqual({ newCount: 0 });
    expect(store.getState().notifications).toHaveLength(9);
    expect(store.getState().notifications.find(({ id }) => id === 'jsonPlaceholder:1')).toMatchObject({
      createdAt: '2026-08-22T12:00:00.000Z', readAt: '2026-08-22T12:01:00.000Z',
    });
  });

  it('marks one or all read using explicit timestamps', async () => {
    const store = await ready(createNotificationStore());
    store.getState().initializeNotifications(initial);
    expect(store.getState().markRead('missing', '2026-08-22T00:00:00.000Z')).toBe(false);
    expect(store.getState().markRead('mock:104', '2026-08-22T00:00:00.000Z')).toBe(true);
    store.getState().markAllRead('2026-08-22T01:00:00.000Z');
    expect(selectUnreadNotificationCount(store.getState())).toBe(0);
    expect(store.getState().notifications.every(({ readAt }) => readAt !== null)).toBe(true);
  });

  it('caps stored notifications and paginates latest twenty deterministically', async () => {
    const store = await ready(createNotificationStore());
    const many = Array.from({ length: NOTIFICATION_STORE_LIMIT + 7 }, (_, index) => item(
      `jsonPlaceholder:${String(index).padStart(3, '0')}`,
      `2026-08-${String((index % 20) + 1).padStart(2, '0')}T12:00:00.000Z`,
    ));
    store.getState().mergeNotifications(many);
    expect(store.getState().notifications).toHaveLength(NOTIFICATION_STORE_LIMIT);
    expect(selectNotificationPage(store.getState(), 1)).toHaveLength(NOTIFICATION_PAGE_SIZE);
    expect(selectNotificationTotalPages(store.getState())).toBe(5);
    expect(selectNotificationPage(store.getState(), 5)).toHaveLength(20);
    const ids = store.getState().notifications.map(({ id }) => id);
    expect(ids).toEqual([...ids].sort((a, b) => {
      const left = many.find((candidate) => candidate.id === a)!;
      const right = many.find((candidate) => candidate.id === b)!;
      return Date.parse(right.createdAt) - Date.parse(left.createdAt) || b.localeCompare(a);
    }));
  });

  it('sorts by actual instants across offsets and uses ID only for equivalent instants', async () => {
    const store = await ready(createNotificationStore());
    store.getState().mergeNotifications([
      item('jsonPlaceholder:a', '2026-08-22T12:00:00+05:30'),
      item('jsonPlaceholder:b', '2026-08-22T07:00:01Z'),
      item('jsonPlaceholder:c', '2026-08-22T06:30:00Z'),
    ]);
    expect(store.getState().notifications.map(({ id }) => id)).toEqual([
      'jsonPlaceholder:b',
      'jsonPlaceholder:c',
      'jsonPlaceholder:a',
    ]);
  });

  it('keeps the true newest records at the cap when timestamps use mixed offsets', async () => {
    const store = await ready(createNotificationStore());
    const middle = Array.from({ length: NOTIFICATION_STORE_LIMIT - 1 }, (_, index) => item(
      `jsonPlaceholder:middle-${index}`,
      '2026-08-22T10:00:00Z',
    ));
    store.getState().mergeNotifications([
      ...middle,
      item('jsonPlaceholder:lexically-late-but-oldest', '2026-08-22T23:00:00+14:00'),
      item('jsonPlaceholder:true-newest', '2026-08-22T12:00:00Z'),
    ]);
    expect(store.getState().notifications).toHaveLength(NOTIFICATION_STORE_LIMIT);
    expect(store.getState().notifications[0]?.id).toBe('jsonPlaceholder:true-newest');
    expect(store.getState().notifications.some(({ id }) => id === 'jsonPlaceholder:lexically-late-but-oldest'))
      .toBe(false);
  });

  it('bounds seen metadata while retaining dedupe for every stored item', async () => {
    const store = await ready(createNotificationStore());
    for (let batch = 0; batch < 60; batch += 1) {
      store.getState().mergeNotifications(Array.from({ length: 5 }, (_, index) => {
        const numericId = batch * 5 + index;
        return item(
          `jsonPlaceholder:${numericId}`,
          new Date(Date.UTC(2026, 0, 1, 0, numericId)).toISOString(),
        );
      }));
    }
    expect(store.getState().notifications).toHaveLength(NOTIFICATION_STORE_LIMIT);
    expect(store.getState().seenSourceIds).toHaveLength(NOTIFICATION_SEEN_SOURCE_LIMIT);
    expect(store.getState().notifications.every(({ sourceId }) =>
      store.getState().seenSourceIds.includes(sourceId))).toBe(true);

    const retained = store.getState().notifications[50]!;
    expect(store.getState().mergeNotifications([{ ...retained, createdAt: '2027-01-01T00:00:00.000Z' }]))
      .toEqual({ newCount: 0 });
    expect(store.getState().notifications.find(({ id }) => id === retained.id)?.createdAt)
      .toBe(retained.createdAt);
  });

  it('persists only validated domain state and rejects corrupt data', async () => {
    let store = await ready(createNotificationStore());
    store.getState().initializeNotifications(initial);
    store.getState().markRead('mock:104', '2026-08-22T00:00:00.000Z');
    const persisted = JSON.parse(localStorage.getItem(NOTIFICATION_STORAGE_KEY) ?? '{}') as { state: Record<string, unknown> };
    expect(Object.keys(persisted.state).sort()).toEqual([
      'initializedFromSource', 'notifications', 'seenSourceIds', 'version',
    ]);
    store = await ready(createNotificationStore());
    expect(store.getState().notifications.find(({ id }) => id === 'mock:104')?.readAt)
      .toBe('2026-08-22T00:00:00.000Z');

    localStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify({
      state: { ...persisted.state, notifications: [{ unsafe: true }] }, version: 1,
    }));
    store = await ready(createNotificationStore());
    expect(store.getState().notifications).toEqual([]);
    expect(store.getState().hasHydrated).toBe(true);

    localStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify({ state: { version: 0 }, version: 0 }));
    store = await ready(createNotificationStore());
    expect(store.getState().notifications).toEqual([]);

    localStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify({
      state: { version: 1, notifications: [], seenSourceIds: ['unscoped'], initializedFromSource: true },
      version: 1,
    }));
    store = await ready(createNotificationStore());
    expect(store.getState().initializedFromSource).toBe(false);

    localStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify({
      state: {
        ...persisted.state,
        seenSourceIds: Array.from({ length: NOTIFICATION_SEEN_SOURCE_LIMIT + 1 }, (_, index) => `mock:${index}`),
      },
      version: 1,
    }));
    store = await ready(createNotificationStore());
    expect(store.getState().notifications).toEqual([]);
  });

  it('finishes hydration and keeps memory mutations when storage fails', async () => {
    const deniedStorage = {
      getItem: vi.fn(() => { throw new DOMException('Denied', 'SecurityError'); }),
      setItem: vi.fn(() => { throw new DOMException('Full', 'QuotaExceededError'); }),
      removeItem: vi.fn(),
    } as unknown as Storage;
    const store = await ready(createNotificationStore({ getStorage: () => deniedStorage }));
    await Promise.resolve();
    expect(store.getState().hasHydrated).toBe(true);
    expect(store.getState().persistenceError).toBe(NOTIFICATION_PERSISTENCE_WARNING);
    store.getState().initializeNotifications(initial);
    expect(store.getState().notifications).toHaveLength(4);
  });

  it('keeps mutations in memory and warns when durable writes fail', async () => {
    const quotaStorage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(() => { throw new DOMException('Full', 'QuotaExceededError'); }),
      removeItem: vi.fn(),
    } as unknown as Storage;
    const store = await ready(createNotificationStore({ getStorage: () => quotaStorage }));
    store.getState().initializeNotifications(initial);
    expect(store.getState().notifications).toHaveLength(4);
    expect(store.getState().persistenceError).toBe(NOTIFICATION_PERSISTENCE_WARNING);
    expect(quotaStorage.setItem).toHaveBeenCalled();
  });
});
