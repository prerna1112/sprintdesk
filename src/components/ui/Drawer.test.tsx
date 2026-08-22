import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Drawer } from './Drawer';

describe('Drawer', () => {
  it('focuses its close control, closes on Escape, and restores focus', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>Open menu</button>
          <Drawer
            onClose={() => {
              onClose();
              setOpen(false);
            }}
            open={open}
            title="Navigation"
          >
            <a href="/dashboard">Dashboard</a>
          </Drawer>
        </>
      );
    }

    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'Open menu' });
    await user.click(trigger);
    expect(screen.getByRole('button', { name: 'Close drawer' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Close drawer' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledOnce();
    expect(trigger).toHaveFocus();
  });
});
