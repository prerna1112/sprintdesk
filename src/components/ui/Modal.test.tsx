import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Modal } from './Modal';

describe('Modal', () => {
  it('moves focus in, traps it, closes on Escape, and restores trigger focus', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>Open modal</button>
          <Modal
            onClose={() => {
              onClose();
              setOpen(false);
            }}
            open={open}
            title="Edit task"
          >
            <button>Save</button>
            <button>Cancel</button>
          </Modal>
        </>
      );
    }

    const view = render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'Open modal' });
    await user.click(trigger);
    expect(screen.getByRole('dialog', { name: 'Edit task' })).toBeVisible();
    expect(view.container).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByRole('button', { name: 'Close dialog' })).toHaveFocus();
    trigger.focus();
    expect(screen.getByRole('button', { name: 'Close dialog' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Save' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Close dialog' })).toHaveFocus();

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(view.container).not.toHaveAttribute('aria-hidden');
  });

  it('closes from the backdrop when enabled', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Modal onClose={onClose} open title="Details"><p>Content</p></Modal>);

    await user.click(screen.getByRole('dialog').parentElement as HTMLElement);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('keeps focus in a controlled input through parent rerenders', async () => {
    const user = userEvent.setup();

    function Harness() {
      const [value, setValue] = useState('');
      return (
        <Modal onClose={() => setValue('')} open title="Rename task">
          <input
            aria-label="Task name"
            onChange={(event) => setValue(event.target.value)}
            value={value}
          />
          <output>{value.length}</output>
        </Modal>
      );
    }

    render(<Harness />);
    const input = screen.getByRole('textbox', { name: 'Task name' });
    await user.click(input);
    await user.type(input, 'Refined title');
    expect(input).toHaveValue('Refined title');
    expect(input).toHaveFocus();
  });

  it('keeps Escape and scroll locking scoped to the topmost overlay', async () => {
    const user = userEvent.setup();
    document.body.style.overflow = 'clip';

    function Harness() {
      const [firstOpen, setFirstOpen] = useState(false);
      const [secondOpen, setSecondOpen] = useState(false);
      return (
        <>
          <button onClick={() => setFirstOpen(true)}>Open first</button>
          <Modal onClose={() => setFirstOpen(false)} open={firstOpen} title="First dialog">
            <button onClick={() => setSecondOpen(true)}>Open second</button>
          </Modal>
          <Modal onClose={() => setSecondOpen(false)} open={secondOpen} title="Second dialog">
            <button>Second action</button>
          </Modal>
        </>
      );
    }

    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Open first' }));
    const secondTrigger = screen.getByRole('button', { name: 'Open second' });
    await user.click(secondTrigger);
    expect(document.body.style.overflow).toBe('hidden');

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Second dialog' })).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'First dialog' })).toBeVisible();
    expect(document.body.style.overflow).toBe('hidden');
    expect(secondTrigger).toHaveFocus();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe('clip');
    expect(screen.getByRole('button', { name: 'Open first' })).toHaveFocus();
    document.body.style.overflow = '';
  });
});
