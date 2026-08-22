import { queryOptions } from '@tanstack/react-query';
import type { AppNotification } from '../../domain/types';

export const NOTIFICATIONS_ENDPOINT = 'https://jsonplaceholder.typicode.com/posts?_limit=5';
export const NOTIFICATIONS_POLL_INTERVAL_MS = 20_000;
export const notificationsQueryKey = ['notifications', 'jsonPlaceholder'] as const;

interface JsonPlaceholderPost {
  userId: number;
  id: number;
  title: string;
  body: string;
}

function isPost(value: unknown): value is JsonPlaceholderPost {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const post = value as Record<string, unknown>;
  return Number.isInteger(post.userId)
    && Number.isInteger(post.id)
    && (post.id as number) > 0
    && typeof post.title === 'string'
    && post.title.trim().length > 0
    && typeof post.body === 'string'
    && post.body.trim().length > 0;
}

export async function fetchPolledNotifications(
  fetchImplementation: typeof fetch = fetch,
  receivedAt: Date = new Date(),
): Promise<AppNotification[]> {
  let response: Response;
  try {
    response = await fetchImplementation(NOTIFICATIONS_ENDPOINT, {
      headers: { Accept: 'application/json' },
    });
  } catch {
    throw new Error('Unable to reach the notification service.');
  }

  if (!response.ok) {
    throw new Error(`Unable to check notifications (${response.status}).`);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error('Notification service returned invalid JSON.');
  }
  if (!Array.isArray(payload) || payload.length > 5 || !payload.every(isPost)) {
    throw new Error('Notification service returned invalid data.');
  }

  const createdAt = receivedAt.toISOString();
  return payload.map((post) => {
    const sourceId = `jsonPlaceholder:${post.id}`;
    return {
      id: sourceId,
      source: 'jsonPlaceholder',
      sourceId,
      title: post.title.trim(),
      body: post.body.trim(),
      createdAt,
      readAt: null,
    };
  });
}

export function notificationsQueryOptions() {
  return queryOptions({
    queryKey: notificationsQueryKey,
    queryFn: () => fetchPolledNotifications(),
    retry: false,
    staleTime: 0,
  });
}
