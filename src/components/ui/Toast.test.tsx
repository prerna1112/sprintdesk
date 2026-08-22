import { act, fireEvent, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ToastProvider } from './Toast';
import { useToast } from './toast-context';

function ToastHarness() {
  const { dismiss, toast } = useToast();
  const numberedToast = useRef(0);
  return (
    <div>
      <button onClick={() => toast({ title: 'Saved', variant: 'success' })}>Add</button>
      <button onClick={() => {
        const id = toast({ title: 'Temporary', duration: 0 });
        dismiss(id);
      }}>Add and dismiss</button>
      <button onClick={() => {
        for (let index = 1; index <= 5; index += 1) {
          toast({ title: `Notice ${index}`, duration: 10000 });
        }
      }}>Fill</button>
      <button onClick={() => {
        toast({ title: 'Persistent 1', duration: 0 });
        toast({ title: 'Persistent 2', duration: 0 });
      }}>Add persistent pair</button>
      <button onClick={() => {
        numberedToast.current += 1;
        toast({ title: `Numbered ${numberedToast.current}`, duration: 10000 });
      }}>Add numbered</button>
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
    vi.useFakeTimers();
    render(<ToastProvider><ToastHarness /></ToastProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Add and dismiss' }));
    expect(screen.queryByText('Temporary')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Fill' }));
    expect(screen.queryByText('Notice 1')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Dismiss Notice/ })).toHaveLength(4);
    expect(vi.getTimerCount()).toBe(4);
    vi.useRealTimers();
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

  it('pauses on hover and resumes with the remaining duration', () => {
    vi.useFakeTimers();
    render(<ToastProvider><ToastHarness /></ToastProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    const toast = screen.getByText('Saved').closest('[data-toast-id]') as HTMLElement;

    act(() => vi.advanceTimersByTime(4000));
    fireEvent.mouseEnter(toast);
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.getByText('Saved')).toBeVisible();
    fireEvent.mouseLeave(toast);
    act(() => vi.advanceTimersByTime(999));
    expect(screen.getByText('Saved')).toBeVisible();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByText('Saved')).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it('does not dismiss a focused toast and moves focus on manual dismissal', async () => {
    vi.useFakeTimers();
    render(<ToastProvider><ToastHarness /></ToastProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add persistent pair' }));
    const firstDismiss = screen.getByRole('button', { name: 'Dismiss Saved' });
    firstDismiss.focus();

    act(() => vi.advanceTimersByTime(6000));
    expect(screen.getByText('Saved')).toBeVisible();
    fireEvent.click(firstDismiss);
    await act(async () => Promise.resolve());
    expect(screen.queryByText('Saved')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dismiss Persistent 1' })).toHaveFocus();
    vi.useRealTimers();
  });

  it('resumes a focus-paused timer with only its remaining duration', () => {
    vi.useFakeTimers();
    render(<ToastProvider><ToastHarness /></ToastProvider>);
    const add = screen.getByRole('button', { name: 'Add' });
    fireEvent.click(add);
    act(() => vi.advanceTimersByTime(2000));
    screen.getByRole('button', { name: 'Dismiss Saved' }).focus();

    act(() => vi.advanceTimersByTime(5000));
    expect(screen.getByText('Saved')).toBeVisible();
    add.focus();
    act(() => vi.advanceTimersByTime(2999));
    expect(screen.getByText('Saved')).toBeVisible();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByText('Saved')).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it('preserves a focused oldest toast when a fifth toast arrives', () => {
    vi.useFakeTimers();
    render(<ToastProvider><ToastHarness /></ToastProvider>);
    const addNumbered = screen.getByRole('button', { name: 'Add numbered' });
    for (let index = 0; index < 4; index += 1) fireEvent.click(addNumbered);

    const protectedDismiss = screen.getByRole('button', {
      name: 'Dismiss Numbered 1',
    });
    protectedDismiss.focus();
    fireEvent.click(addNumbered);

    expect(screen.getByText('Numbered 1')).toBeVisible();
    expect(screen.queryByText('Numbered 2')).not.toBeInTheDocument();
    expect(screen.getByText('Numbered 5')).toBeVisible();
    expect(protectedDismiss).toHaveFocus();
    expect(vi.getTimerCount()).toBeLessThanOrEqual(4);

    addNumbered.focus();
    act(() => vi.advanceTimersByTime(10000));
    expect(screen.queryByText(/Numbered/)).not.toBeInTheDocument();
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
  });
});
