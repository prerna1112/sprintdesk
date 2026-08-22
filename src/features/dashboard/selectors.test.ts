import { describe, expect, it } from 'vitest';
import sourceJson from '../../../public/mock-data.json';
import { parseAndAdaptMockData } from '../../data/mock-data.adapter';
import { createBoardStore } from '../board/board-store';
import { selectCurrentSprint, selectDashboardSummary, selectDashboardTasks } from './selectors';

describe('dashboard selectors', () => {
  it('selects the latest-starting sprint and derives its live summary', () => {
    const data = parseAndAdaptMockData(sourceJson);
    const store = createBoardStore({ skipHydration: true });
    store.getState().initializeBoard({ tasks: data.tasks, comments: data.comments });

    expect(selectCurrentSprint([...data.sprints].reverse())?.name).toBe('Sprint 3');
    expect(selectDashboardSummary(store.getState(), data.sprints, '2026-08-22')).toMatchObject({
      sprint: { id: '3' },
      total: 18,
      backlog: 3,
      inProgress: 5,
      review: 4,
      done: 6,
      completionRate: 33,
    });
  });

  it('returns a due-date ordered, assignee-enriched current-sprint focus list', () => {
    const data = parseAndAdaptMockData(sourceJson);
    const tasksById = Object.fromEntries(data.tasks.map((task) => [task.id, task]));
    const rows = selectDashboardTasks({ tasksById }, data.sprints, data.users, 4);

    expect(rows).toHaveLength(4);
    expect(rows.every((task) => task.sprintId === '3' && task.status !== 'done')).toBe(true);
    expect(rows.map((task) => task.dueDate)).toEqual([...rows.map((task) => task.dueDate)].sort());
    expect(rows.every((task) => task.assigneeName !== 'Unknown assignee')).toBe(true);
  });
});
