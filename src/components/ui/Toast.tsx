import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
  type PropsWithChildren,
} from 'react';
import { Button } from './Button';
import { Icon } from './Icon';
import { cn } from './cn';
import {
  ToastContext,
  type ToastInput,
  type ToastVariant,
} from './toast-context';

interface ToastItem extends ToastInput {
  id: string;
  variant: ToastVariant;
}

interface TimerState {
  remaining: number;
  startedAt: number;
  timer?: ReturnType<typeof setTimeout>;
}

type PauseReason = 'focus' | 'hover';

const MAX_TOASTS = 4;

const accents: Record<ToastVariant, string> = {
  success: 'border-l-success',
  error: 'border-l-danger',
  info: 'border-l-info',
};

export function ToastProvider({ children }: PropsWithChildren) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counter = useRef(0);
  const timers = useRef(new Map<string, TimerState>());
  const pauseReasons = useRef(new Map<string, Set<PauseReason>>());

  const clearTimer = useCallback((id: string) => {
    const state = timers.current.get(id);
    if (state?.timer) clearTimeout(state.timer);
    timers.current.delete(id);
    pauseReasons.current.delete(id);
  }, []);

  useEffect(() => {
    const activeTimers = timers.current;
    return () =>
      activeTimers.forEach((state) => {
        if (state.timer) clearTimeout(state.timer);
      });
  }, []);

  const dismiss = useCallback(
    (id: string) => {
      setToasts((current) => current.filter((item) => item.id !== id));
      clearTimer(id);
    },
    [clearTimer],
  );

  const startTimer = useCallback(
    (id: string, remaining: number) => {
      if (remaining <= 0) {
        dismiss(id);
        return;
      }
      const state: TimerState = {
        remaining,
        startedAt: Date.now(),
      };
      state.timer = setTimeout(() => dismiss(id), remaining);
      timers.current.set(id, state);
    },
    [dismiss],
  );

  const pauseTimer = useCallback((id: string, reason: PauseReason) => {
    const reasons = pauseReasons.current.get(id) ?? new Set<PauseReason>();
    if (reasons.has(reason)) return;
    reasons.add(reason);
    pauseReasons.current.set(id, reasons);

    const state = timers.current.get(id);
    if (!state?.timer) return;
    clearTimeout(state.timer);
    state.timer = undefined;
    state.remaining = Math.max(0, state.remaining - (Date.now() - state.startedAt));
  }, []);

  const resumeTimer = useCallback(
    (id: string, reason: PauseReason) => {
      const reasons = pauseReasons.current.get(id);
      reasons?.delete(reason);
      if (reasons && reasons.size > 0) return;
      pauseReasons.current.delete(id);

      const state = timers.current.get(id);
      if (!state || state.timer) return;
      startTimer(id, state.remaining);
    },
    [startTimer],
  );

  const toast = useCallback(
    (input: ToastInput) => {
      counter.current += 1;
      const id = `toast-${counter.current}`;
      const item: ToastItem = { ...input, id, variant: input.variant ?? 'info' };
      const duration = input.duration ?? 5000;

      setToasts((current) => {
        const all = [...current, item];
        const evicted = all.slice(0, Math.max(0, all.length - MAX_TOASTS));
        evicted.forEach((removed) => clearTimer(removed.id));
        return all.slice(-MAX_TOASTS);
      });
      if (duration > 0) startTimer(id, duration);
      return id;
    },
    [clearTimer, startTimer],
  );

  const handleManualDismiss = useCallback(
    (id: string, button: HTMLButtonElement) => {
      const toastElements = Array.from(
        document.querySelectorAll<HTMLElement>('[data-toast-id]'),
      );
      const index = toastElements.findIndex(
        (element) => element.dataset.toastId === id,
      );
      const nextToast = toastElements[index + 1] ?? toastElements[index - 1];
      const nextButton = nextToast?.querySelector<HTMLButtonElement>('button');
      const shouldMoveFocus = document.activeElement === button && !!nextButton;
      dismiss(id);
      if (shouldMoveFocus) queueMicrotask(() => nextButton.focus());
    },
    [dismiss],
  );

  const value = useMemo(() => ({ dismiss, toast }), [dismiss, toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-atomic="false"
        aria-label="Notifications"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-[60] ml-auto grid max-w-sm gap-2"
        role="status"
      >
        {toasts.map((item) => (
          <div
            className={cn(
              'pointer-events-auto rounded-xl border border-l-4 bg-elevated p-4 shadow-xl',
              accents[item.variant],
            )}
            data-toast-id={item.id}
            data-variant={item.variant}
            key={item.id}
            onBlur={(event: FocusEvent<HTMLDivElement>) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                resumeTimer(item.id, 'focus');
              }
            }}
            onFocus={() => pauseTimer(item.id, 'focus')}
            onMouseEnter={() => pauseTimer(item.id, 'hover')}
            onMouseLeave={() => resumeTimer(item.id, 'hover')}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold">{item.title}</p>
                {item.description ? <div className="mt-1 text-sm text-muted-foreground">{item.description}</div> : null}
              </div>
              <Button
                aria-label={`Dismiss ${item.title}`}
                onClick={(event) => handleManualDismiss(item.id, event.currentTarget)}
                size="icon"
                variant="ghost"
              >
                <Icon name="close" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
