import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
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

const MAX_TOASTS = 4;

const accents: Record<ToastVariant, string> = {
  success: 'border-l-success',
  error: 'border-l-danger',
  info: 'border-l-info',
};

export function ToastProvider({ children }: PropsWithChildren) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counter = useRef(0);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const activeTimers = timers.current;
    return () => activeTimers.forEach((timer) => clearTimeout(timer));
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((item) => item.id !== id));
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
  }, []);

  const toast = useCallback(
    (input: ToastInput) => {
      counter.current += 1;
      const id = `toast-${counter.current}`;
      const item: ToastItem = { ...input, id, variant: input.variant ?? 'info' };
      setToasts((current) => [...current, item].slice(-MAX_TOASTS));
      const duration = input.duration ?? 5000;
      if (duration > 0) {
        timers.current.set(id, setTimeout(() => dismiss(id), duration));
      }
      return id;
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
            data-variant={item.variant}
            key={item.id}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold">{item.title}</p>
                {item.description ? <div className="mt-1 text-sm text-muted-foreground">{item.description}</div> : null}
              </div>
              <Button aria-label={`Dismiss ${item.title}`} onClick={() => dismiss(item.id)} size="icon" variant="ghost">
                <Icon name="close" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
