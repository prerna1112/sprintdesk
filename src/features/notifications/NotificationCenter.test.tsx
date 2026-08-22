import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import mockData from '../../../public/mock-data.json';
import { renderWithProviders } from '../../test/render';
import { useAuthStore } from '../auth';
import { NotificationCenter } from './NotificationCenter';
import {
  NOTIFICATION_PERSISTENCE_WARNING,
  NOTIFICATION_STORE_LIMIT,
  notificationStore,
} from './notification-store';
import { NOTIFICATIONS_ENDPOINT, NOTIFICATIONS_POLL_INTERVAL_MS } from './notifications-service';

const testUser = {
  id: '1', username: 'emilys', email: 'emily@example.com', firstName: 'Emily', lastName: 'Johnson', image: '',
};

const posts = Array.from({ length: 5 }, (_, index) => ({
  userId: 1,
  id: index + 1,
  title: `Service update ${index + 1}`,
  body: `Details ${index + 1}`,
}));

function response(value: unknown, status = 200) {
  return new Response(typeof value === 'string' ? value : JSON.stringify(value), { status });
}

function installFetch(options: { pollStatus?: number; neverResolvePoll?: boolean } = {}) {
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    if (String(input) === '/mock-data.json') return Promise.resolve(response(mockData));
    if (String(input) === NOTIFICATIONS_ENDPOINT) {
      if (options.neverResolvePoll) return new Promise<Response>(() => undefined);
      return Promise.resolve(response(options.pollStatus ? 'unavailable' : posts, options.pollStatus ?? 200));
    }
    return Promise.reject(new Error(`Unexpected URL: ${String(input)}`));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('NotificationCenter', () => {
  beforeEach(() => {
    useAuthStore.getState().setSession({
      accessToken: 'access', accessTokenExpiresAt: Date.now() + 60_000, user: testUser,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('seeds four, merges the first five, summarizes once, and supports read actions', async () => {
    installFetch();
    const user = userEvent.setup();
    renderWithProviders(<NotificationCenter />);

    expect(await screen.findByRole('button', { name: 'Notifications, 8 unread' })).toBeVisible();
    expect(screen.getAllByText('5 new notifications')).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'Notifications, 8 unread' }));
    const drawer = screen.getByRole('dialog', { name: 'Notifications' });
    expect(within(drawer).getAllByRole('listitem')).toHaveLength(9);
    expect(within(drawer).getByText('8 unread')).toBeVisible();

    await user.click(within(drawer).getAllByRole('button', { name: 'Mark read' })[0]!);
    expect(within(drawer).getByText('7 unread')).toBeVisible();
    await user.click(within(drawer).getByRole('button', { name: 'Mark all read' }));
    expect(within(drawer).getByText('All caught up')).toBeVisible();
  });

  it('paginates a fixture larger than twenty with latest items on page one', async () => {
    installFetch({ neverResolvePoll: true });
    const many = Array.from({ length: 25 }, (_, index) => ({
      id: `jsonPlaceholder:${index + 1}`,
      source: 'jsonPlaceholder' as const,
      sourceId: `jsonPlaceholder:${index + 1}`,
      title: `Fixture ${index + 1}`,
      body: 'Fixture details',
      createdAt: new Date(Date.UTC(2026, 7, 1, 0, index)).toISOString(),
      readAt: null,
    }));
    notificationStore.getState().initializeNotifications(many);
    const user = userEvent.setup();
    renderWithProviders(<NotificationCenter />);

    await user.click(screen.getByRole('button', { name: 'Notifications, 25 unread' }));
    const drawer = screen.getByRole('dialog', { name: 'Notifications' });
    expect(within(drawer).getAllByRole('listitem')).toHaveLength(20);
    expect(within(drawer).getByText('Fixture 25')).toBeVisible();
    expect(within(drawer).queryByText('Fixture 1')).not.toBeInTheDocument();
    expect(within(drawer).getByText('Page 1 of 2')).toBeVisible();
    await user.click(within(drawer).getByRole('button', { name: 'Next' }));
    expect(within(drawer).getAllByRole('listitem')).toHaveLength(5);
    expect(within(drawer).getByText('Fixture 1')).toBeVisible();
    expect(within(drawer).getByText('Page 2 of 2')).toBeVisible();
  });

  it('shows non-blocking poll errors with retry while retaining existing notifications', async () => {
    installFetch({ pollStatus: 503 });
    notificationStore.getState().initializeNotifications(mockData.notifications.map((item) => ({
      id: `mock:${item.id}`,
      source: 'mock' as const,
      sourceId: `mock:${item.id}`,
      title: item.title,
      body: item.message,
      createdAt: item.createdAt,
      readAt: item.read ? item.createdAt : null,
    })));
    const user = userEvent.setup();
    renderWithProviders(<NotificationCenter />);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Notifications, 3 unread' })).toBeVisible());
    await user.click(screen.getByRole('button', { name: 'Notifications, 3 unread' }));
    const drawer = screen.getByRole('dialog', { name: 'Notifications' });
    expect(await within(drawer).findByText(/Live notification updates are temporarily unavailable/)).toBeVisible();
    expect(within(drawer).getAllByRole('listitem')).toHaveLength(4);
    expect(within(drawer).getByRole('button', { name: 'Retry updates' })).toBeVisible();
  });

  it('renders empty and durability states and closes accessibly with Escape', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      if (String(input) === '/mock-data.json') {
        return Promise.resolve(response({ ...mockData, notifications: [] }));
      }
      if (String(input) === NOTIFICATIONS_ENDPOINT) return Promise.resolve(response([]));
      return Promise.reject(new Error('Unexpected URL'));
    });
    vi.stubGlobal('fetch', fetchMock);
    notificationStore.setState({ persistenceError: NOTIFICATION_PERSISTENCE_WARNING });
    const user = userEvent.setup();
    renderWithProviders(<NotificationCenter />);

    const trigger = await screen.findByRole('button', { name: 'Notifications, 0 unread' });
    await user.click(trigger);
    const drawer = screen.getByRole('dialog', { name: 'Notifications' });
    expect(await within(drawer).findByText('No notifications yet')).toBeVisible();
    expect(within(drawer).getByText(NOTIFICATION_PERSISTENCE_WARNING)).toBeVisible();
    expect(within(drawer).getByText('All caught up')).toBeVisible();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Notifications' })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('pauses while hidden, promptly refetches when visible, and cleans up StrictMode listeners', async () => {
    vi.useFakeTimers();
    let hidden = false;
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
    const addListener = vi.spyOn(document, 'addEventListener');
    const removeListener = vi.spyOn(document, 'removeEventListener');
    const fetchMock = installFetch();
    notificationStore.getState().initializeNotifications([]);
    const view = renderWithProviders(<NotificationCenter />);
    const pollCalls = () => fetchMock.mock.calls.filter(([input]) => String(input) === NOTIFICATIONS_ENDPOINT).length;

    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(pollCalls()).toBe(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(NOTIFICATIONS_POLL_INTERVAL_MS); });
    expect(pollCalls()).toBe(2);

    hidden = true;
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    await act(async () => { await vi.advanceTimersByTimeAsync(NOTIFICATIONS_POLL_INTERVAL_MS * 2); });
    expect(pollCalls()).toBe(2);

    hidden = false;
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); await Promise.resolve(); });
    expect(pollCalls()).toBe(3);

    view.unmount();
    const visibilityAdds = addListener.mock.calls.filter(([type]) => type === 'visibilitychange').length;
    const visibilityRemoves = removeListener.mock.calls.filter(([type]) => type === 'visibilitychange').length;
    expect(visibilityRemoves).toBe(visibilityAdds);
  });

  it('merges silently while open and does not toast duplicate polls', async () => {
    vi.useFakeTimers();
    let currentPosts = posts;
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      if (String(input) === '/mock-data.json') return Promise.resolve(response(mockData));
      if (String(input) === NOTIFICATIONS_ENDPOINT) return Promise.resolve(response(currentPosts));
      return Promise.reject(new Error('Unexpected URL'));
    });
    vi.stubGlobal('fetch', fetchMock);
    notificationStore.getState().initializeNotifications([]);
    renderWithProviders(<NotificationCenter />);

    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(screen.getAllByText('5 new notifications')).toHaveLength(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(NOTIFICATIONS_POLL_INTERVAL_MS); });
    expect(notificationStore.getState().notifications).toHaveLength(5);
    expect(screen.queryByText('1 new notification')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Notifications, 5 unread' }));
    currentPosts = [...posts.slice(0, 4), { userId: 1, id: 6, title: 'Service update 6', body: 'Details 6' }];
    await act(async () => { await vi.advanceTimersByTimeAsync(NOTIFICATIONS_POLL_INTERVAL_MS); });
    expect(notificationStore.getState().notifications).toHaveLength(6);
    expect(screen.queryByText('1 new notification')).not.toBeInTheDocument();
    expect(notificationStore.getState().notifications.length).toBeLessThanOrEqual(NOTIFICATION_STORE_LIMIT);
  });
});
