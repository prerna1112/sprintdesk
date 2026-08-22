import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import sourceJson from '../../../public/mock-data.json';
import { parseAndAdaptMockData } from '../../data/mock-data.adapter';
import { useAuthStore } from '../auth';
import { renderWithProviders } from '../../test/render';
import { Board } from './Board';
import { boardStore, resetBoardStore } from './board-store';

const data = parseAndAdaptMockData(sourceJson);
const authUser = {
  id: '1', username: 'emilys', email: 'emily@example.com', firstName: 'Emily', lastName: 'Johnson', image: '',
};

function seedBoard() {
  resetBoardStore();
  boardStore.getState().initializeBoard({
    tasks: data.tasks,
    comments: data.comments,
    currentSprintId: '3',
    assigneeIds: data.users.map((user) => user.id),
  });
}

describe('Board interactions', () => {
  beforeEach(() => {
    seedBoard();
    useAuthStore.getState().setSession({ accessToken: 'token', accessTokenExpiresAt: Date.now() + 60_000, user: authUser });
  });

  it('renders all columns, initial counts, assignees, due text, and sensor semantics', () => {
    renderWithProviders(<Board data={data} />);
    expect(screen.getByRole('heading', { name: 'Backlog' })).toBeInTheDocument();
    expect(screen.getByLabelText('3 tasks')).toBeInTheDocument();
    expect(screen.getByLabelText('5 tasks')).toBeInTheDocument();
    expect(screen.getByLabelText('4 tasks')).toBeInTheDocument();
    expect(screen.getByLabelText('18 tasks')).toBeInTheDocument();
    expect(screen.getAllByText('Emily Johnson').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Due|Overdue/).length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Sprint task board')).toHaveAttribute('data-keyboard-sensor', 'sortableKeyboardCoordinates');
    expect(screen.getByRole('button', { name: /Move Build Kanban board/ })).toBeInTheDocument();
  });

  it('moves a task with the keyboard sensor and announces the destination', async () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function getBoardRect(this: HTMLElement) {
      const section = this.closest('section');
      const sectionLabel = section?.querySelector('h2')?.textContent;
      const columnIndex = ['Backlog', 'In Progress', 'Review', 'Done'].indexOf(sectionLabel ?? '');
      const isTask = Boolean(this.querySelector('button[aria-label^="Move "]'));
      const taskIndex = isTask && this.parentElement ? Array.from(this.parentElement.children).indexOf(this) : 0;
      const left = Math.max(0, columnIndex) * 400;
      const top = isTask ? taskIndex * 100 : 0;
      const width = 300;
      const height = isTask ? 80 : 1000;
      return {
        x: left, y: top, left, top, width, height,
        right: left + width, bottom: top + height,
        toJSON: () => ({}),
      } as DOMRect;
    });
    const user = userEvent.setup();
    renderWithProviders(<Board data={data} />);
    const handle = screen.getByRole('button', { name: 'Move Design notification system' });
    handle.focus();
    await user.keyboard('[Space]');
    await user.keyboard('[ArrowDown]');
    expect(screen.getByText('Design notification system is over Backlog, position 3.')).toBeInTheDocument();
    await user.keyboard('[Space]');
    await waitFor(() => expect(boardStore.getState().columnTaskIds.backlog).toEqual(['7', '11', '4']));
    expect(screen.getByText('Design notification system was moved to Backlog, position 3.')).toBeInTheDocument();
  });

  it('creates a task with accessible inline validation and success feedback', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Board data={data} />);
    await user.click(screen.getByRole('button', { name: 'Create task' }));
    const dialog = screen.getByRole('dialog', { name: 'Create task' });
    await user.click(within(dialog).getByRole('button', { name: 'Create task' }));
    expect(within(dialog).getByText('Title is required.')).toBeInTheDocument();
    expect(within(dialog).getByText('Choose an assignee.')).toBeInTheDocument();
    expect(within(dialog).getByText('Enter a valid due date.')).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText('Title'), 'Ship release notes');
    await user.selectOptions(within(dialog).getByLabelText('Assignee'), '2');
    await user.type(within(dialog).getByLabelText('Due date'), '2026-08-28');
    await user.click(within(dialog).getByRole('button', { name: 'Create task' }));
    expect(await screen.findByText('Task created')).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Create task' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open details for Ship release notes' })).toBeInTheDocument();
    expect(boardStore.getState().getCounts().backlog).toBe(4);
    expect(Object.values(boardStore.getState().tasksById).find((task) => task.title === 'Ship release notes')?.sprintId).toBe('3');
  });

  it('edits a task and adds a comment without losing the drawer flow', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Board data={data} />);
    await user.click(screen.getByRole('button', { name: 'Open details for Build Kanban board' }));
    let drawer = screen.getByRole('dialog', { name: 'Build Kanban board' });
    expect(within(drawer).getAllByText('Michael Williams').length).toBeGreaterThan(0);
    await user.click(within(drawer).getByRole('button', { name: 'Edit task' }));
    const title = within(drawer).getByLabelText('Title');
    await user.clear(title);
    await user.type(title, 'Build accessible Kanban board');
    await user.click(within(drawer).getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Task updated')).toBeInTheDocument();
    expect(boardStore.getState().tasksById['2']?.title).toBe('Build accessible Kanban board');

    drawer = screen.getByRole('dialog', { name: 'Build accessible Kanban board' });
    await user.click(within(drawer).getByRole('button', { name: 'Add comment' }));
    expect(within(drawer).getByText('Comment cannot be empty.')).toBeInTheDocument();
    await user.type(within(drawer).getByLabelText('Add comment'), 'Keyboard flow verified.');
    await user.click(within(drawer).getByRole('button', { name: 'Add comment' }));
    expect(await within(drawer).findByText('Keyboard flow verified.')).toBeInTheDocument();
    expect(within(drawer).getAllByText('Emily Johnson').length).toBeGreaterThan(0);
  });

  it('resets an invalid edit draft and errors when editing is cancelled and reopened', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Board data={data} />);
    await user.click(screen.getByRole('button', { name: 'Open details for Build Kanban board' }));
    const drawer = screen.getByRole('dialog', { name: 'Build Kanban board' });
    await user.click(within(drawer).getByRole('button', { name: 'Edit task' }));
    const title = within(drawer).getByLabelText('Title');
    await user.clear(title);
    await user.type(within(drawer).getByLabelText('Description'), 'Unsaved draft');
    await user.click(within(drawer).getByRole('button', { name: 'Save changes' }));
    expect(within(drawer).getByText('Title is required.')).toBeInTheDocument();
    await user.click(within(drawer).getByRole('button', { name: 'Cancel editing' }));
    await user.click(within(drawer).getByRole('button', { name: 'Edit task' }));
    expect(within(drawer).getByLabelText('Title')).toHaveValue('Build Kanban board');
    expect(within(drawer).getByLabelText('Description')).toHaveValue('Create the sprint board with four columns and task management.');
    expect(within(drawer).queryByText('Title is required.')).not.toBeInTheDocument();
  });

  it('focuses cancel in destructive confirmation and deletes the open task safely', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Board data={data} />);
    await user.click(screen.getByRole('button', { name: 'Open details for Build Kanban board' }));
    await user.click(within(screen.getByRole('dialog', { name: 'Build Kanban board' })).getByRole('button', { name: 'Delete task' }));
    const confirmation = screen.getByRole('dialog', { name: 'Delete task?' });
    expect(confirmation).toHaveTextContent('Build Kanban board');
    await waitFor(() => expect(within(confirmation).getByRole('button', { name: 'Cancel' })).toHaveFocus());
    await user.click(within(confirmation).getByRole('button', { name: 'Delete task' }));
    expect(await screen.findByText('Task deleted')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open details for Build Kanban board' })).not.toBeInTheDocument();
  });
});
