import { describe, expect, it } from 'vitest';
import sourceJson from '../../../public/mock-data.json';
import { parseAndAdaptMockData } from '../../data/mock-data.adapter';
import { createBoardStore } from '../board/board-store';
import {
  selectCompletionTrend,
  selectPriorityBreakdown,
  selectPriorityTotals,
  selectSprintVelocity,
  selectStatusDistribution,
} from './selectors';

function initializedStore() {
  const data = parseAndAdaptMockData(sourceJson);
  const ids = ['new-task'];
  const store = createBoardStore({ skipHydration: true, generateId: () => ids.shift() ?? 'fallback-id' });
  store.getState().initializeBoard({
    tasks: data.tasks,
    comments: data.comments,
    currentSprintId: '3',
    assigneeIds: data.users.map((user) => user.id),
  });
  return { data, store };
}

describe('analytics selectors', () => {
  it('derives all fresh-source chart baselines from the normalized board', () => {
    const { data, store } = initializedStore();
    const snapshot = store.getState();

    expect(selectSprintVelocity(snapshot, data.sprints).map(({ completed }) => completed)).toEqual([5, 7, 6]);
    expect(selectStatusDistribution(snapshot).map(({ count }) => count)).toEqual([3, 5, 4, 18]);
    expect(selectPriorityTotals(selectPriorityBreakdown(snapshot))).toEqual({ high: 13, medium: 12, low: 5 });
    const trend = selectCompletionTrend(snapshot);
    expect(trend).toHaveLength(14);
    expect(trend.at(-1)?.cumulative).toBe(18);
    expect(trend.map(({ date }) => date)).toEqual([...trend.map(({ date }) => date)].sort());
  });

  it('updates synchronously after move, add, edit, and delete actions', () => {
    const { data, store } = initializedStore();
    const beforeTrendTotal = selectCompletionTrend(store.getState()).at(-1)?.cumulative;

    expect(store.getState().moveTask({ taskId: '2', toStatus: 'done', toIndex: 18 }).ok).toBe(true);
    expect(selectStatusDistribution(store.getState()).map(({ count }) => count)).toEqual([3, 4, 4, 19]);
    expect(selectSprintVelocity(store.getState(), data.sprints).map(({ completed }) => completed)).toEqual([5, 7, 7]);
    expect(selectCompletionTrend(store.getState()).at(-1)?.cumulative).toBe((beforeTrendTotal ?? 0) + 1);

    expect(store.getState().addTask({ title: 'New task', priority: 'low', assigneeId: '1', dueDate: '2026-08-28' })).toEqual({ ok: true, taskId: 'new-task' });
    expect(selectPriorityTotals(selectPriorityBreakdown(store.getState())).low).toBe(6);

    expect(store.getState().updateTask('new-task', { priority: 'high' }).ok).toBe(true);
    expect(selectPriorityTotals(selectPriorityBreakdown(store.getState()))).toMatchObject({ high: 14, low: 5 });

    expect(store.getState().deleteTask('new-task').ok).toBe(true);
    expect(selectPriorityTotals(selectPriorityBreakdown(store.getState()))).toEqual({ high: 13, medium: 12, low: 5 });
  });
});
