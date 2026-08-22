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
  toLocalDateKey,
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

  it('groups equivalent completion instants with different offsets on one local date', () => {
    const { store } = initializedStore();
    const state = store.getState();
    const first = { ...state.tasksById['1']!, completedAt: '2026-08-19T22:30:00.000Z' };
    const second = { ...state.tasksById['5']!, completedAt: '2026-08-20T00:30:00.000+02:00' };
    const snapshot = {
      tasksById: { [first.id]: first, [second.id]: second },
      columnTaskIds: { backlog: [], inProgress: [], review: [], done: [first.id, second.id] },
    };

    expect(new Date(first.completedAt!).getTime()).toBe(new Date(second.completedAt!).getTime());
    expect(toLocalDateKey(first.completedAt!)).toBe(toLocalDateKey(second.completedAt!));
    expect(selectCompletionTrend(snapshot)).toEqual([{
      date: toLocalDateKey(first.completedAt!),
      completed: 2,
      cumulative: 2,
    }]);
  });

  it('uses the local calendar day for completions near UTC midnight', () => {
    const instant = '2026-08-19T23:55:00.000Z';
    const localInstant = new Date(instant);
    const expectedLocalKey = [
      localInstant.getFullYear(),
      String(localInstant.getMonth() + 1).padStart(2, '0'),
      String(localInstant.getDate()).padStart(2, '0'),
    ].join('-');

    expect(toLocalDateKey(instant)).toBe(expectedLocalKey);
    const { store } = initializedStore();
    const boundaryTask = { ...store.getState().tasksById['1']!, id: 'boundary', completedAt: instant };
    expect(selectCompletionTrend({
      tasksById: { [boundaryTask.id]: boundaryTask },
      columnTaskIds: { backlog: [], inProgress: [], review: [], done: [boundaryTask.id] },
    })).toEqual([{ date: expectedLocalKey, completed: 1, cumulative: 1 }]);
  });
});
