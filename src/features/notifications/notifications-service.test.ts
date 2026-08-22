import { describe, expect, it, vi } from 'vitest';
import {
  NOTIFICATIONS_POLL_INTERVAL_MS,
  fetchPolledNotifications,
} from './notifications-service';

describe('notification polling service', () => {
  it('documents the named twenty-second polling interval', () => {
    expect(NOTIFICATIONS_POLL_INTERVAL_MS).toBe(20_000);
  });

  it('maps JSONPlaceholder posts to stable notification identities', async () => {
    const fetchImplementation = vi.fn(async () => new Response(JSON.stringify([
      { userId: 1, id: 1, title: 'First post', body: 'First body' },
      { userId: 1, id: 2, title: 'Second post', body: 'Second body' },
    ]), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    const result = await fetchPolledNotifications(
      fetchImplementation as typeof fetch,
      new Date('2026-08-22T12:00:00.000Z'),
    );

    expect(fetchImplementation).toHaveBeenCalledWith(
      'https://jsonplaceholder.typicode.com/posts?_limit=5',
      expect.objectContaining({ headers: { Accept: 'application/json' } }),
    );
    expect(result).toEqual([
      {
        id: 'jsonPlaceholder:1', source: 'jsonPlaceholder', sourceId: 'jsonPlaceholder:1',
        title: 'First post', body: 'First body', createdAt: '2026-08-22T12:00:00.000Z', readAt: null,
      },
      {
        id: 'jsonPlaceholder:2', source: 'jsonPlaceholder', sourceId: 'jsonPlaceholder:2',
        title: 'Second post', body: 'Second body', createdAt: '2026-08-22T12:00:00.000Z', readAt: null,
      },
    ]);
  });

  it('reports HTTP, malformed JSON, invalid payload, and network failures clearly', async () => {
    await expect(fetchPolledNotifications(
      vi.fn(async () => new Response('down', { status: 503 })) as typeof fetch,
    )).rejects.toThrow('Unable to check notifications (503)');

    await expect(fetchPolledNotifications(
      vi.fn(async () => new Response('<html>', { status: 200 })) as typeof fetch,
    )).rejects.toThrow('Notification service returned invalid JSON');

    await expect(fetchPolledNotifications(
      vi.fn(async () => new Response(JSON.stringify([{ id: 'bad' }]), { status: 200 })) as typeof fetch,
    )).rejects.toThrow('Notification service returned invalid data');

    await expect(fetchPolledNotifications(
      vi.fn(async () => { throw new TypeError('offline'); }) as typeof fetch,
    )).rejects.toThrow('Unable to reach the notification service');
  });
});
