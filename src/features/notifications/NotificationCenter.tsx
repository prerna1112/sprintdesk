import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '../../components/ui/Button';
import { Drawer } from '../../components/ui/Drawer';
import { Icon } from '../../components/ui/Icon';
import { useToast } from '../../components/ui/toast-context';
import { mockDataQueryOptions } from '../../data/mock-data.service';
import { useAuthStore } from '../auth';
import {
  NOTIFICATION_PAGE_SIZE,
  selectNotificationTotalPages,
  selectUnreadNotificationCount,
  useNotificationStore,
} from './notification-store';
import {
  NOTIFICATIONS_POLL_INTERVAL_MS,
  notificationsQueryOptions,
} from './notifications-service';

function formatTimestamp(timestamp: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(timestamp));
}

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [documentHidden, setDocumentHidden] = useState(() =>
    typeof document !== 'undefined' && document.hidden);
  const wasHidden = useRef(documentHidden);
  const previousNotificationCount = useRef(0);
  const previousPageButtonRef = useRef<HTMLButtonElement>(null);
  const nextPageButtonRef = useRef<HTMLButtonElement>(null);
  const pendingPageFocus = useRef<'previous' | 'next' | null>(null);
  const { toast } = useToast();
  const authenticated = useAuthStore((state) => Boolean(state.accessToken && state.user));
  const hasHydrated = useNotificationStore((state) => state.hasHydrated);
  const initializedFromSource = useNotificationStore((state) => state.initializedFromSource);
  const persistenceError = useNotificationStore((state) => state.persistenceError);
  const unreadCount = useNotificationStore(selectUnreadNotificationCount);
  const allNotifications = useNotificationStore((state) => state.notifications);
  const notificationCount = allNotifications.length;
  const totalPages = useNotificationStore(selectNotificationTotalPages);
  const notifications = useMemo(
    () => allNotifications.slice(
      (page - 1) * NOTIFICATION_PAGE_SIZE,
      page * NOTIFICATION_PAGE_SIZE,
    ),
    [allNotifications, page],
  );
  const initializeNotifications = useNotificationStore((state) => state.initializeNotifications);
  const mergeNotifications = useNotificationStore((state) => state.mergeNotifications);
  const markRead = useNotificationStore((state) => state.markRead);
  const markAllRead = useNotificationStore((state) => state.markAllRead);

  const sourceQuery = useQuery({
    ...mockDataQueryOptions(),
    enabled: authenticated,
  });

  useEffect(() => {
    if (!hasHydrated || !sourceQuery.data) return;
    initializeNotifications(sourceQuery.data.notifications);
  }, [hasHydrated, initializeNotifications, sourceQuery.data]);

  const pollEnabled = authenticated && hasHydrated && initializedFromSource;
  const pollQuery = useQuery({
    ...notificationsQueryOptions(),
    enabled: pollEnabled && !documentHidden,
    refetchInterval: pollEnabled && !documentHidden
      ? NOTIFICATIONS_POLL_INTERVAL_MS
      : false,
    refetchIntervalInBackground: false,
  });
  const refetchPoll = pollQuery.refetch;

  useEffect(() => {
    if (typeof document === 'undefined') return;
    function handleVisibilityChange() {
      const hidden = document.hidden;
      setDocumentHidden(hidden);
      if (wasHidden.current && !hidden && pollEnabled) void refetchPoll();
      wasHidden.current = hidden;
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [pollEnabled, refetchPoll]);

  useEffect(() => {
    if (!pollQuery.data) return;
    const { newCount } = mergeNotifications(pollQuery.data);
    if (newCount > 0 && !open) {
      toast({
        title: `${newCount} new notification${newCount === 1 ? '' : 's'}`,
        description: 'Open the notification panel to review the latest updates.',
        variant: 'info',
      });
    }
  }, [mergeNotifications, open, pollQuery.data, pollQuery.dataUpdatedAt, toast]);

  useEffect(() => {
    if (!open && notificationCount > previousNotificationCount.current) setPage(1);
    previousNotificationCount.current = notificationCount;
  }, [notificationCount, open]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    const focusTarget = pendingPageFocus.current;
    if (!focusTarget) return;
    pendingPageFocus.current = null;
    queueMicrotask(() => {
      if (focusTarget === 'previous') previousPageButtonRef.current?.focus();
      else nextPageButtonRef.current?.focus();
    });
  }, [page]);

  function openPanel() {
    setPage(1);
    setOpen(true);
  }

  function handleMarkRead(id: string) {
    markRead(id);
  }

  function handleMarkAllRead() {
    if (unreadCount === 0) return;
    markAllRead();
  }

  function changePage(nextPage: number) {
    pendingPageFocus.current = nextPage > page ? 'previous' : 'next';
    setPage(nextPage);
  }

  const loading = !hasHydrated || (!initializedFromSource && sourceQuery.isPending)
    || (initializedFromSource && notificationCount === 0 && pollQuery.isPending);
  const loadError = sourceQuery.isError && !initializedFromSource;
  const pollError = pollQuery.isError;

  return (
    <>
      <div className="relative">
        <Button
          aria-label={`Notifications, ${unreadCount} unread`}
          aria-expanded={open}
          aria-haspopup="dialog"
          onClick={openPanel}
          size="icon"
          variant="ghost"
        >
          <Icon name="bell" />
        </Button>
        {unreadCount > 0 ? (
          <span
            aria-hidden="true"
            className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-danger px-1 text-[10px] font-black text-danger-foreground"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        ) : null}
      </div>

      <Drawer
        description="Latest SprintDesk and connected service updates."
        onClose={() => setOpen(false)}
        open={open}
        title="Notifications"
      >
        <div className="grid gap-4">
          <div className="flex items-center justify-between gap-3 border-b pb-3">
            <p className="text-sm text-muted-foreground" role="status">
              {unreadCount === 0 ? 'All caught up' : `${unreadCount} unread`}
            </p>
            <Button
              aria-disabled={unreadCount === 0 || undefined}
              className="aria-disabled:cursor-default aria-disabled:opacity-60"
              onClick={handleMarkAllRead}
              size="sm"
              variant="secondary"
            >
              Mark all read
            </Button>
          </div>

          {persistenceError ? (
            <p className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm" role="status">
              {persistenceError}
            </p>
          ) : null}

          {loadError ? (
            <div className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm" role="alert">
              <p>Notifications could not be loaded.</p>
              <Button className="mt-3" onClick={() => void sourceQuery.refetch()} size="sm" variant="secondary">
                Retry
              </Button>
            </div>
          ) : null}

          {pollError ? (
            <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm" role="status">
              <p>Live notification updates are temporarily unavailable. Existing notifications are still here.</p>
              <Button className="mt-3" onClick={() => void pollQuery.refetch()} size="sm" variant="secondary">
                Retry updates
              </Button>
            </div>
          ) : null}

          {loading ? <p aria-busy="true" role="status">Loading notifications…</p> : null}

          {!loading && !loadError && notificationCount === 0 ? (
            <div className="rounded-xl border border-dashed p-6 text-center">
              <p className="font-bold">No notifications yet</p>
              <p className="mt-1 text-sm text-muted-foreground">New activity will appear here.</p>
            </div>
          ) : null}

          {notifications.length > 0 ? (
            <ol aria-label="Latest notifications" className="grid divide-y">
              {notifications.map((notification, index) => {
                const unread = notification.readAt === null;
                return (
                  <li className="py-4 first:pt-0" key={notification.id}>
                    <article
                      aria-label={`${notification.title}, ${unread ? 'unread' : 'read'}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-bold">{notification.title}</p>
                          <p className="mt-1 text-sm leading-5 text-muted-foreground">{notification.body}</p>
                        </div>
                        <span className="shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold">
                          {unread ? 'Unread' : 'Read'}
                        </span>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <time className="text-xs text-muted-foreground" dateTime={notification.createdAt}>
                          {formatTimestamp(notification.createdAt)}
                        </time>
                        <Button
                          aria-disabled={!unread || undefined}
                          aria-label={unread
                            ? `Mark ${notification.title} as read, notification ${(page - 1) * NOTIFICATION_PAGE_SIZE + index + 1}`
                            : `${notification.title} is already read, notification ${(page - 1) * NOTIFICATION_PAGE_SIZE + index + 1}`}
                          onClick={() => {
                            if (unread) handleMarkRead(notification.id);
                          }}
                          className="aria-disabled:cursor-default aria-disabled:opacity-60"
                          size="sm"
                          variant="ghost"
                        >
                          {unread ? 'Mark read' : 'Read'}
                        </Button>
                      </div>
                    </article>
                  </li>
                );
              })}
            </ol>
          ) : null}

          {totalPages > 1 ? (
            <nav aria-label="Notification pages" className="flex items-center justify-between gap-3 border-t pt-3">
              <Button
                disabled={page === 1}
                onClick={() => changePage(Math.max(1, page - 1))}
                ref={previousPageButtonRef}
                size="sm"
                variant="secondary"
              >
                Previous
              </Button>
              <p className="text-sm" role="status">Page {page} of {totalPages}</p>
              <Button
                disabled={page === totalPages}
                onClick={() => changePage(Math.min(totalPages, page + 1))}
                ref={nextPageButtonRef}
                size="sm"
                variant="secondary"
              >
                Next
              </Button>
            </nav>
          ) : null}
        </div>
      </Drawer>
    </>
  );
}
