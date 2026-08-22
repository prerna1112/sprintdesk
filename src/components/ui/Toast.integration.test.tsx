import { StrictMode, useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '../../features/theme';
import { Modal } from './Modal';
import { ToastProvider } from './Toast';
import { useToast } from './toast-context';
import { GLOBAL_LIVE_LAYER_SELECTOR } from './globalLiveLayer';

function ModalToastHarness() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  return (
    <>
      <button onClick={() => setOpen(true)}>Open editor</button>
      <Modal onClose={() => setOpen(false)} open={open} title="Task editor">
        <button
          onClick={() => toast({ title: 'Changes saved', duration: 0 })}
        >
          Save with notification
        </button>
      </Modal>
    </>
  );
}

describe('Toast and overlay provider integration', () => {
  it('keeps the live toast layer operable while the app background is isolated', async () => {
    const user = userEvent.setup();
    const media = {
      matches: false,
      media: '(prefers-color-scheme: dark)',
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as MediaQueryList;
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn(() => media),
    });

    const view = render(
      <StrictMode>
        <ThemeProvider>
          <ToastProvider>
            <ModalToastHarness />
          </ToastProvider>
        </ThemeProvider>
      </StrictMode>,
    );
    await user.click(screen.getByRole('button', { name: 'Open editor' }));

    const liveLayer = document.querySelector<HTMLElement>(
      GLOBAL_LIVE_LAYER_SELECTOR,
    );
    expect(view.container).toHaveAttribute('aria-hidden', 'true');
    expect(view.container.inert).toBe(true);
    expect(liveLayer).not.toBeNull();
    expect(liveLayer).not.toHaveAttribute('aria-hidden');
    expect(liveLayer?.inert).not.toBe(true);

    const saveButton = screen.getByRole('button', {
      name: 'Save with notification',
    });
    await user.click(saveButton);
    expect(
      screen.getByRole('status', { name: 'Notifications' }),
    ).toHaveAttribute('aria-live', 'polite');
    const dismiss = screen.getByRole('button', {
      name: 'Dismiss Changes saved',
    });
    await user.tab();
    expect(dismiss).toHaveFocus();
    await user.click(dismiss);
    expect(screen.queryByText('Changes saved')).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Task editor' })).toBeVisible();
    expect(saveButton).toHaveFocus();
  });
});
