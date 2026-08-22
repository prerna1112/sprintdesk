import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import sourceJson from '../../public/mock-data.json';
import { BOARD_PERSISTENCE_WARNING, boardStore, resetBoardStore } from '../features/board';
import { renderWithProviders } from '../test/render';
import DashboardRoute from './DashboardRoute';

function responseFor(source: unknown = sourceJson) {
  return new Response(JSON.stringify(source), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

function summaryCard(label: string): HTMLElement {
  const card = screen.getByText(label, { selector: 'p' }).closest('article');
  if (!card) throw new Error(`Missing ${label} summary card`);
  return card;
}

describe('DashboardRoute', () => {
  beforeEach(() => resetBoardStore());

  it('loads the latest sprint summary and a real DataTable focus list', async () => {
    let resolveFetch!: (response: Response) => void;
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => { resolveFetch = resolve; })));
    renderWithProviders(<DashboardRoute />);

    expect(screen.getByRole('status', { name: 'Loading dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Loading Current sprint focus tasks' })).toBeInTheDocument();
    resolveFetch(responseFor());

    expect(await screen.findByText(/Sprint 3 ·/)).toBeInTheDocument();
    expect(summaryCard('Total')).toHaveTextContent('18');
    expect(summaryCard('Backlog')).toHaveTextContent('3');
    expect(summaryCard('In progress')).toHaveTextContent('5');
    expect(summaryCard('Review')).toHaveTextContent('4');
    expect(summaryCard('Done')).toHaveTextContent('6');
    expect(summaryCard('Completion')).toHaveTextContent('33%');
    const table = screen.getByRole('table', { name: 'Sprint 3 upcoming tasks' });
    expect(within(table).getByText('Build Kanban board')).toBeInTheDocument();
    expect(within(table).getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual(['Task', 'Assignee', 'Priority', 'Due date', 'Status']);
    expect(screen.getByRole('link', { name: 'Open board' })).toHaveAttribute('href', '/board');
    expect(screen.getByRole('link', { name: 'View analytics' })).toHaveAttribute('href', '/analytics');
  });

  it('reflects board mutations without refetching', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(responseFor());
    vi.stubGlobal('fetch', fetchMock);
    renderWithProviders(<DashboardRoute />);
    expect(await screen.findByRole('table', { name: 'Sprint 3 upcoming tasks' })).toBeInTheDocument();

    act(() => { boardStore.getState().moveTask({ taskId: '2', toStatus: 'done', toIndex: 18 }); });
    expect(summaryCard('In progress')).toHaveTextContent('4');
    expect(summaryCard('Done')).toHaveTextContent('7');
    expect(summaryCard('Completion')).toHaveTextContent('39%');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('shows a descriptive error and retries through the shared query options', async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockRejectedValueOnce(new Error('Network unavailable'))
      .mockResolvedValueOnce(responseFor());
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    renderWithProviders(<DashboardRoute />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Network unavailable');
    await user.click(screen.getByRole('button', { name: 'Retry loading dashboard' }));
    expect(await screen.findByRole('table', { name: 'Sprint 3 upcoming tasks' })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('provides empty and durability-warning states', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(responseFor({ ...sourceJson, tasks: [], comments: [] })));
    boardStore.setState({ persistenceError: BOARD_PERSISTENCE_WARNING });
    renderWithProviders(<DashboardRoute />);

    expect(await screen.findByText('No current sprint work yet')).toBeInTheDocument();
    expect(screen.getByText(BOARD_PERSISTENCE_WARNING)).toHaveAttribute('role', 'status');
  });

  it('uses the DataTable empty state when the sprint has no active tasks', async () => {
    const completedSource = {
      ...sourceJson,
      tasks: sourceJson.tasks.map((task) => task.sprintId === 3
        ? { ...task, status: 'done', completedAt: task.completedAt ?? '2026-08-22T12:00:00Z' }
        : task),
    };
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(responseFor(completedSource)));
    renderWithProviders(<DashboardRoute />);

    expect(await screen.findByText('No active tasks remain in the current sprint.')).toBeInTheDocument();
  });
});
