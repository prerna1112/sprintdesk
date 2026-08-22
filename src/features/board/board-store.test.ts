import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SprintTask, TaskComment } from '../../domain/types';
import {
  BOARD_STORAGE_KEY,
  createBoardStore,
  getBoardInvariantErrors,
} from './board-store';

const tasks: SprintTask[] = [
  {
    id: 'a', title: 'First', description: '', status: 'backlog', priority: 'low',
    assigneeId: 'u1', dueDate: '2026-09-01', sprintId: 's1', createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z', completedAt: null,
  },
  {
    id: 'b', title: 'Second', description: '', status: 'inProgress', priority: 'high',
    assigneeId: 'u2', dueDate: '2026-09-02', sprintId: 's1', createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z', completedAt: null,
  },
  {
    id: 'c', title: 'Third', description: '', status: 'backlog', priority: 'medium',
    assigneeId: 'u1', dueDate: '2026-09-03', sprintId: 's1', createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z', completedAt: null,
  },
];

const comments: TaskComment[] = [
  { id: 'm1', taskId: 'a', authorId: 'u1', body: 'Hello', createdAt: '2026-08-01T00:00:00.000Z' },
];

async function ready(store: ReturnType<typeof createBoardStore>) {
  await store.persist.rehydrate();
  return store;
}

function initialize(store: ReturnType<typeof createBoardStore>) {
  return store.getState().initializeBoard({
    tasks,
    comments,
    currentSprintId: 's2',
    assigneeIds: ['u1', 'u2'],
  });
}

describe('board store', () => {
  beforeEach(() => localStorage.clear());

  it('initializes exactly once and derives source order by status', async () => {
    const store = await ready(createBoardStore());
    expect(initialize(store)).toEqual({ ok: true, initialized: true });
    expect(store.getState().columnTaskIds).toEqual({
      backlog: ['a', 'c'], inProgress: ['b'], review: [], done: [],
    });
    expect(store.getState().commentsByTaskId.a).toEqual(comments);

    expect(store.getState().initializeBoard({ tasks: tasks.slice().reverse(), comments: [] }))
      .toEqual({ ok: true, initialized: false });
    expect(store.getState().columnTaskIds.backlog).toEqual(['a', 'c']);
  });

  it('falls back safely when persisted data is corrupt or an old version', async () => {
    localStorage.setItem(BOARD_STORAGE_KEY, '{not json');
    let store = await ready(createBoardStore());
    expect(store.getState().initializedFromSource).toBe(false);
    expect(store.getState().hasHydrated).toBe(true);

    localStorage.setItem(BOARD_STORAGE_KEY, JSON.stringify({ state: { version: 0 }, version: 0 }));
    store = await ready(createBoardStore());
    expect(store.getState().initializedFromSource).toBe(false);
    expect(getBoardInvariantErrors(store.getState())).toEqual([]);
  });

  it('adds valid tasks to backlog using the configured current sprint', async () => {
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000001');
    const store = await ready(createBoardStore());
    initialize(store);
    const result = store.getState().addTask({
      title: ' New task ', priority: 'high', assigneeId: 'u2', dueDate: '2026-09-10', description: 'Details',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(store.getState().tasksById[result.taskId]).toMatchObject({
      title: 'New task', status: 'backlog', sprintId: 's2', completedAt: null,
    });
    expect(store.getState().columnTaskIds.backlog.at(-1)).toBe(result.taskId);
    expect(store.getState().addTask({ title: '', priority: 'high', assigneeId: 'u2', dueDate: '2026-09-10' })).toMatchObject({ ok: false, error: { field: 'title' } });
    expect(store.getState().addTask({ title: 'x', priority: 'high', assigneeId: 'missing', dueDate: '2026-09-10' })).toMatchObject({ ok: false, error: { field: 'assigneeId' } });
  });

  it('moves and reorders across, within, and into empty columns atomically', async () => {
    const store = await ready(createBoardStore());
    initialize(store);
    expect(store.getState().moveTask({ taskId: 'c', toStatus: 'backlog', toIndex: 0 }).ok).toBe(true);
    expect(store.getState().columnTaskIds.backlog).toEqual(['c', 'a']);
    expect(store.getState().moveTask({ taskId: 'a', toStatus: 'review', toIndex: 0 }).ok).toBe(true);
    expect(store.getState().columnTaskIds.review).toEqual(['a']);
    expect(store.getState().tasksById.a?.status).toBe('review');
    expect(getBoardInvariantErrors(store.getState())).toEqual([]);

    const before = structuredClone(store.getState().columnTaskIds);
    expect(store.getState().moveTask({ taskId: 'missing', toStatus: 'done', toIndex: 0 }).ok).toBe(false);
    expect(store.getState().moveTask({ taskId: 'a', toStatus: 'done', toIndex: 99 }).ok).toBe(false);
    expect(store.getState().columnTaskIds).toEqual(before);
  });

  it('sets, preserves, and clears completion timestamps correctly', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-22T12:00:00.000Z'));
    const store = await ready(createBoardStore());
    initialize(store);
    store.getState().moveTask({ taskId: 'a', toStatus: 'done', toIndex: 0 });
    expect(store.getState().tasksById.a?.completedAt).toBe('2026-08-22T12:00:00.000Z');
    vi.setSystemTime(new Date('2026-08-23T12:00:00.000Z'));
    store.getState().moveTask({ taskId: 'a', toStatus: 'done', toIndex: 0 });
    expect(store.getState().tasksById.a?.completedAt).toBe('2026-08-22T12:00:00.000Z');
    store.getState().moveTask({ taskId: 'a', toStatus: 'review', toIndex: 0 });
    expect(store.getState().tasksById.a?.completedAt).toBeNull();
    vi.useRealTimers();
  });

  it('edits, comments, deletes, validates, and preserves invariants', async () => {
    const store = await ready(createBoardStore());
    initialize(store);
    expect(store.getState().updateTask('a', { title: 'Edited', dueDate: 'bad' })).toMatchObject({ ok: false, error: { field: 'dueDate' } });
    expect(store.getState().tasksById.a?.title).toBe('First');
    expect(store.getState().updateTask('a', { title: 'Edited', priority: 'medium', assigneeId: 'u2', dueDate: '2026-12-01' }).ok).toBe(true);
    expect(store.getState().addComment('a', '   ', 'u1')).toMatchObject({ ok: false, error: { field: 'body' } });
    expect(store.getState().addComment('a', ' New comment ', 'u2').ok).toBe(true);
    expect(store.getState().commentsByTaskId.a).toHaveLength(2);
    expect(store.getState().deleteTask('a').ok).toBe(true);
    expect(store.getState().tasksById.a).toBeUndefined();
    expect(store.getState().commentsByTaskId.a).toBeUndefined();
    expect(getBoardInvariantErrors(store.getState())).toEqual([]);
  });

  it('persists and rehydrates only board domain data', async () => {
    let store = await ready(createBoardStore());
    initialize(store);
    await Promise.resolve();
    store = await ready(createBoardStore());
    expect(store.getState().initializedFromSource).toBe(true);
    expect(store.getState().columnTaskIds.backlog).toEqual(['a', 'c']);
    const stored = localStorage.getItem(BOARD_STORAGE_KEY) ?? '';
    expect(stored).not.toContain('hasHydrated');
    expect(stored).not.toContain('currentSprintId');
  });

  it('provides analytics-compatible counts', async () => {
    const store = await ready(createBoardStore());
    initialize(store);
    expect(store.getState().getCounts()).toEqual({ backlog: 2, inProgress: 1, review: 0, done: 0, total: 3 });
  });
});
