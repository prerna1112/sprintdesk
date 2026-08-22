import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ToastProvider } from './Toast';
import { useToast } from './toast-context';

function ToastHarness() {
  const { dismiss, toast } = useToast();
  return (
    <div>
      <button onClick={() => toast({ title: 'Saved', variant: 'success' })}>Add</button>
      <button onClick={() => {
        const id = toast({ title: 'Temporary', duration: 0 });
        dismiss(id);
      }}>Add and dismiss</button>
      <button onClick={() => {
        for (let index = 1; index <= 5; index += 1) {
          toast({ title: `Notice ${index}`, duration: 0 });
        }
      }}>Fill</button>
    </div>
  );
}

describe('ToastProvider', () => {
  it('adds and dismisses a notification without moving focus', () => {
    render(<ToastProvider><ToastHarness /></ToastProvider>);
    const add = screen.getByRole('button', { name: 'Add' });
    add.focus();
    fireEvent.click(add);

    expect(screen.getByText('Saved')).toBeVisible();
    expect(screen.getByRole('status', { name: 'Notifications' })).toHaveAttribute('aria-live', 'polite');
    expect(add).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss Saved' }));
    expect(screen.queryByText('Saved')).not.toBeInTheDocument();
  });

  it('supports programmatic dismissal and caps the visible stack at four', () => {
    render(<ToastProvider><ToastHarness /></ToastProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Add and dismiss' }));
    expect(screen.queryByText('Temporary')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Fill' }));
    expect(screen.queryByText('Notice 1')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Dismiss Notice/ })).toHaveLength(4);
  });

  it('auto-dismisses after the requested duration', () => {
    vi.useFakeTimers();
    render(<ToastProvider><ToastHarness /></ToastProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByText('Saved')).toBeVisible();
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.queryByText('Saved')).not.toBeInTheDocument();
    vi.useRealTimers();
  });
});
