import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Sprint, SprintTask } from '../../domain/types';
import { selectDashboardSummary } from './selectors';
import { millisecondsUntilNextLocalMidnight, toLocalDateKey, useLocalToday } from './use-local-today';

const sprint: Sprint = { id: 'current', name: 'Current sprint', startDate: '2026-08-01', endDate: '2026-08-31' };

function SummaryProbe() {
  const today = useLocalToday();
  const task: SprintTask = {
    id: 'due-today',
    title: 'Due today',
    description: '',
    status: 'inProgress',
    priority: 'medium',
    assigneeId: '1',
    dueDate: '2026-08-22',
    sprintId: sprint.id,
    createdAt: '2026-08-20T00:00:00.000Z',
    updatedAt: '2026-08-20T00:00:00.000Z',
    completedAt: null,
  };
  const summary = selectDashboardSummary({ tasksById: { [task.id]: task } }, [sprint], today);
  return <output>{today}|overdue:{summary.overdue}|upcoming:{summary.upcoming}</output>;
}

afterEach(() => {
  vi.useRealTimers();
});

describe('useLocalToday', () => {
  it('uses the actual next local midnight, including the local timezone offset', () => {
    const now = new Date(2026, 2, 8, 12, 30, 0);
    const nextMidnight = new Date(2026, 2, 9, 0, 0, 0);
    expect(millisecondsUntilNextLocalMidnight(now)).toBe(nextMidnight.getTime() - now.getTime());
  });

  it('rerenders overdue and upcoming values at midnight and cleans up its timer', () => {
    vi.useFakeTimers();
    const beforeMidnight = new Date(2026, 7, 22, 23, 59, 59, 900);
    vi.setSystemTime(beforeMidnight);
    const { unmount } = render(<SummaryProbe />);

    expect(screen.getByText(`${toLocalDateKey(beforeMidnight)}|overdue:0|upcoming:1`)).toBeInTheDocument();
    expect(vi.getTimerCount()).toBe(1);
    act(() => { vi.advanceTimersByTime(100); });
    const afterMidnight = new Date(2026, 7, 23, 0, 0, 0, 0);
    expect(screen.getByText(`${toLocalDateKey(afterMidnight)}|overdue:1|upcoming:0`)).toBeInTheDocument();
    expect(vi.getTimerCount()).toBe(1);

    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
