import { useStore } from 'zustand';
import { createStore, type StoreApi } from 'zustand/vanilla';
import { createJSONStorage, persist } from 'zustand/middleware';
import type {
  BoardStateV1,
  ColumnTaskIds,
  SprintTask,
  TaskComment,
  TaskPriority,
  TaskStatus,
} from '../../domain/types';

export const BOARD_STORAGE_KEY = 'sprintdesk.board.v1';
export const BOARD_STORAGE_VERSION = 1;
export const BOARD_STATUSES: TaskStatus[] = ['backlog', 'inProgress', 'review', 'done'];

type ValidationField = 'title' | 'priority' | 'assigneeId' | 'dueDate' | 'body' | 'taskId' | 'destination';

export interface BoardActionError {
  code: 'validation' | 'notFound' | 'invalidMove' | 'notReady';
  field?: ValidationField;
  message: string;
}

export type BoardActionResult<T extends object = object> =
  | ({ ok: true } & T)
  | { ok: false; error: BoardActionError };

export interface InitializeBoardInput {
  tasks: SprintTask[];
  comments: TaskComment[];
  currentSprintId?: string;
  assigneeIds?: string[];
}

export interface AddTaskInput {
  title: string;
  priority: TaskPriority;
  assigneeId: string;
  dueDate: string;
  description?: string;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  priority?: TaskPriority;
  assigneeId?: string;
  dueDate?: string;
}

export interface MoveTaskInput {
  taskId: string;
  toStatus: TaskStatus;
  toIndex: number;
}

export interface BoardCounts extends Record<TaskStatus, number> {
  total: number;
}

export interface BoardStore extends BoardStateV1 {
  hasHydrated: boolean;
  currentSprintId: string | null;
  knownAssigneeIds: string[];
  initializeBoard: (input: InitializeBoardInput) => BoardActionResult<{ initialized: boolean }>;
  addTask: (input: AddTaskInput) => BoardActionResult<{ taskId: string }>;
  updateTask: (taskId: string, input: UpdateTaskInput) => BoardActionResult;
  addComment: (taskId: string, body: string, authorId: string) => BoardActionResult<{ commentId: string }>;
  deleteTask: (taskId: string) => BoardActionResult;
  moveTask: (input: MoveTaskInput) => BoardActionResult;
  getCounts: () => BoardCounts;
}

const emptyColumns = (): ColumnTaskIds => ({
  backlog: [],
  inProgress: [],
  review: [],
  done: [],
});

const emptyDomainState = (): BoardStateV1 => ({
  version: 1,
  tasksById: {},
  columnTaskIds: emptyColumns(),
  commentsByTaskId: {},
  initializedFromSource: false,
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value) || !Number.isFinite(Date.parse(value))) return false;
  const datePart = value.slice(0, 10);
  return new Date(`${datePart}T00:00:00.000Z`).toISOString().slice(0, 10) === datePart;
}

function isTask(value: unknown): value is SprintTask {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string'
    && typeof value.title === 'string'
    && typeof value.description === 'string'
    && BOARD_STATUSES.includes(value.status as TaskStatus)
    && ['low', 'medium', 'high'].includes(value.priority as string)
    && typeof value.assigneeId === 'string'
    && typeof value.sprintId === 'string'
    && typeof value.dueDate === 'string' && isValidDate(value.dueDate)
    && typeof value.createdAt === 'string' && Number.isFinite(Date.parse(value.createdAt))
    && typeof value.updatedAt === 'string' && Number.isFinite(Date.parse(value.updatedAt))
    && (value.completedAt === null || (typeof value.completedAt === 'string' && Number.isFinite(Date.parse(value.completedAt))));
}

function isComment(value: unknown): value is TaskComment {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.taskId === 'string'
    && typeof value.authorId === 'string'
    && typeof value.body === 'string'
    && typeof value.createdAt === 'string'
    && Number.isFinite(Date.parse(value.createdAt));
}

function parsePersistedDomain(value: unknown): BoardStateV1 | null {
  if (!isRecord(value) || value.version !== 1 || typeof value.initializedFromSource !== 'boolean') return null;
  if (!isRecord(value.tasksById) || !isRecord(value.columnTaskIds) || !isRecord(value.commentsByTaskId)) return null;
  if (!Object.values(value.tasksById).every(isTask)) return null;
  const persistedColumns = value.columnTaskIds;
  if (!BOARD_STATUSES.every((status) => Array.isArray(persistedColumns[status]) && (persistedColumns[status] as unknown[]).every((id: unknown) => typeof id === 'string'))) return null;
  if (!Object.values(value.commentsByTaskId).every((comments) => Array.isArray(comments) && comments.every(isComment))) return null;

  const candidate = value as unknown as BoardStateV1;
  return getBoardInvariantErrors(candidate).length === 0 ? candidate : null;
}

export function getBoardInvariantErrors(
  state: Pick<BoardStateV1, 'tasksById' | 'columnTaskIds' | 'commentsByTaskId'>,
): string[] {
  const errors: string[] = [];
  const allIds = BOARD_STATUSES.flatMap((status) => state.columnTaskIds[status] ?? []);
  if (new Set(allIds).size !== allIds.length) errors.push('A task appears in more than one board position.');
  const taskIds = Object.keys(state.tasksById);
  if (allIds.length !== taskIds.length || taskIds.some((id) => !allIds.includes(id))) errors.push('Every task must appear in exactly one column.');
  BOARD_STATUSES.forEach((status) => {
    state.columnTaskIds[status]?.forEach((id) => {
      if (state.tasksById[id]?.status !== status) errors.push(`Task ${id} does not match its column.`);
    });
  });
  Object.entries(state.commentsByTaskId).forEach(([taskId, comments]) => {
    if (!state.tasksById[taskId]) errors.push(`Comments reference missing task ${taskId}.`);
    if (comments.some((comment) => comment.taskId !== taskId)) errors.push(`Comment task mismatch for ${taskId}.`);
  });
  return errors;
}

function validationError(field: ValidationField, message: string): { ok: false; error: BoardActionError } {
  return { ok: false, error: { code: 'validation', field, message } };
}

function validateTaskFields(
  input: Pick<AddTaskInput, 'title' | 'priority' | 'assigneeId' | 'dueDate'>,
  knownAssigneeIds: string[],
): { ok: true } | { ok: false; error: BoardActionError } {
  if (!input.title.trim()) return validationError('title', 'Title is required.');
  if (!['low', 'medium', 'high'].includes(input.priority)) return validationError('priority', 'Choose a valid priority.');
  if (!input.assigneeId || (knownAssigneeIds.length > 0 && !knownAssigneeIds.includes(input.assigneeId))) return validationError('assigneeId', 'Choose a valid assignee.');
  if (!isValidDate(input.dueDate)) return validationError('dueDate', 'Enter a valid due date.');
  return { ok: true };
}

function uuid(): string {
  return globalThis.crypto.randomUUID();
}

export function createBoardStore(options: { skipHydration?: boolean } = {}) {
  const storage = typeof window === 'undefined'
    ? undefined
    : createJSONStorage(() => localStorage);
  let storeRef: StoreApi<BoardStore> | null = null;

  const store = createStore<BoardStore>()(
    persist(
      (set, get) => ({
        ...emptyDomainState(),
        hasHydrated: false,
        currentSprintId: null,
        knownAssigneeIds: [],
        initializeBoard: ({ tasks, comments, currentSprintId, assigneeIds }) => {
          let initialized = false;
          set((state) => {
            const runtime = {
              currentSprintId: currentSprintId ?? state.currentSprintId,
              knownAssigneeIds: assigneeIds ?? state.knownAssigneeIds,
            };
            if (state.initializedFromSource) return runtime;

            const tasksById: Record<string, SprintTask> = {};
            const columnTaskIds = emptyColumns();
            tasks.forEach((task) => {
              if (tasksById[task.id]) return;
              tasksById[task.id] = { ...task };
              columnTaskIds[task.status].push(task.id);
            });
            const commentsByTaskId: Record<string, TaskComment[]> = {};
            comments.forEach((comment) => {
              if (!tasksById[comment.taskId]) return;
              (commentsByTaskId[comment.taskId] ??= []).push({ ...comment });
            });
            initialized = true;
            return { ...runtime, tasksById, columnTaskIds, commentsByTaskId, initializedFromSource: true };
          });
          return { ok: true, initialized };
        },
        addTask: (input) => {
          const state = get();
          if (!state.currentSprintId) return { ok: false, error: { code: 'notReady', message: 'Sprint data is not ready.' } };
          const validation = validateTaskFields(input, state.knownAssigneeIds);
          if (!validation.ok) return validation;
          const taskId = uuid();
          const now = new Date().toISOString();
          const task: SprintTask = {
            id: taskId,
            title: input.title.trim(),
            description: input.description?.trim() ?? '',
            status: 'backlog',
            priority: input.priority,
            assigneeId: input.assigneeId,
            dueDate: input.dueDate,
            sprintId: state.currentSprintId,
            createdAt: now,
            updatedAt: now,
            completedAt: null,
          };
          set((current) => ({
            tasksById: { ...current.tasksById, [taskId]: task },
            columnTaskIds: { ...current.columnTaskIds, backlog: [...current.columnTaskIds.backlog, taskId] },
          }));
          return { ok: true, taskId };
        },
        updateTask: (taskId, input) => {
          const state = get();
          const task = state.tasksById[taskId];
          if (!task) return { ok: false, error: { code: 'notFound', field: 'taskId', message: 'Task was not found.' } };
          const next = {
            title: input.title ?? task.title,
            priority: input.priority ?? task.priority,
            assigneeId: input.assigneeId ?? task.assigneeId,
            dueDate: input.dueDate ?? task.dueDate,
          };
          const validation = validateTaskFields(next, state.knownAssigneeIds);
          if (!validation.ok) return validation;
          set((current) => ({
            tasksById: {
              ...current.tasksById,
              [taskId]: {
                ...task,
                ...input,
                title: next.title.trim(),
                description: input.description?.trim() ?? task.description,
                updatedAt: new Date().toISOString(),
              },
            },
          }));
          return { ok: true };
        },
        addComment: (taskId, body, authorId) => {
          const state = get();
          if (!state.tasksById[taskId]) return { ok: false, error: { code: 'notFound', field: 'taskId', message: 'Task was not found.' } };
          if (!body.trim()) return validationError('body', 'Comment cannot be empty.');
          if (!authorId.trim()) return validationError('assigneeId', 'A comment author is required.');
          const commentId = uuid();
          const comment: TaskComment = { id: commentId, taskId, authorId, body: body.trim(), createdAt: new Date().toISOString() };
          set((current) => ({
            commentsByTaskId: {
              ...current.commentsByTaskId,
              [taskId]: [...(current.commentsByTaskId[taskId] ?? []), comment],
            },
          }));
          return { ok: true, commentId };
        },
        deleteTask: (taskId) => {
          const state = get();
          const task = state.tasksById[taskId];
          if (!task) return { ok: false, error: { code: 'notFound', field: 'taskId', message: 'Task was not found.' } };
          set((current) => {
            const tasksById = { ...current.tasksById };
            const commentsByTaskId = { ...current.commentsByTaskId };
            delete tasksById[taskId];
            delete commentsByTaskId[taskId];
            return {
              tasksById,
              commentsByTaskId,
              columnTaskIds: {
                ...current.columnTaskIds,
                [task.status]: current.columnTaskIds[task.status].filter((id) => id !== taskId),
              },
            };
          });
          return { ok: true };
        },
        moveTask: ({ taskId, toStatus, toIndex }) => {
          const state = get();
          const task = state.tasksById[taskId];
          if (!task) return { ok: false, error: { code: 'notFound', field: 'taskId', message: 'Task was not found.' } };
          if (!BOARD_STATUSES.includes(toStatus)) return { ok: false, error: { code: 'invalidMove', field: 'destination', message: 'Destination column is invalid.' } };
          const fromStatus = task.status;
          const source = state.columnTaskIds[fromStatus];
          const sourceIndex = source.indexOf(taskId);
          const destinationLength = state.columnTaskIds[toStatus].length - (fromStatus === toStatus ? 1 : 0);
          if (sourceIndex < 0 || !Number.isInteger(toIndex) || toIndex < 0 || toIndex > destinationLength) {
            return { ok: false, error: { code: 'invalidMove', field: 'destination', message: 'Task cannot be moved to that position.' } };
          }

          const nextColumns: ColumnTaskIds = {
            backlog: [...state.columnTaskIds.backlog],
            inProgress: [...state.columnTaskIds.inProgress],
            review: [...state.columnTaskIds.review],
            done: [...state.columnTaskIds.done],
          };
          nextColumns[fromStatus].splice(sourceIndex, 1);
          nextColumns[toStatus].splice(toIndex, 0, taskId);
          const now = new Date().toISOString();
          const completedAt = toStatus === 'done'
            ? (fromStatus === 'done' ? task.completedAt : now)
            : null;
          set({
            columnTaskIds: nextColumns,
            tasksById: {
              ...state.tasksById,
              [taskId]: { ...task, status: toStatus, completedAt, updatedAt: now },
            },
          });
          return { ok: true };
        },
        getCounts: () => {
          const columns = get().columnTaskIds;
          return {
            backlog: columns.backlog.length,
            inProgress: columns.inProgress.length,
            review: columns.review.length,
            done: columns.done.length,
            total: BOARD_STATUSES.reduce((sum, status) => sum + columns[status].length, 0),
          };
        },
      }),
      {
        name: BOARD_STORAGE_KEY,
        version: BOARD_STORAGE_VERSION,
        storage,
        skipHydration: options.skipHydration ?? true,
        partialize: (state) => ({
          version: state.version,
          tasksById: state.tasksById,
          columnTaskIds: state.columnTaskIds,
          commentsByTaskId: state.commentsByTaskId,
          initializedFromSource: state.initializedFromSource,
        }) as BoardStore,
        migrate: () => emptyDomainState() as BoardStore,
        merge: (persisted, current) => {
          const parsed = parsePersistedDomain(persisted);
          return parsed ? { ...current, ...parsed } : current;
        },
        onRehydrateStorage: () => () => {
          queueMicrotask(() => storeRef?.setState({ hasHydrated: true }));
        },
      },
    ),
  );
  storeRef = store;
  return store;
}

export const boardStore = createBoardStore({ skipHydration: false });

export function useBoardStore<T>(selector: (state: BoardStore) => T): T {
  return useStore(boardStore, selector);
}

export const selectBoardCounts = (state: BoardStore): BoardCounts => ({
  backlog: state.columnTaskIds.backlog.length,
  inProgress: state.columnTaskIds.inProgress.length,
  review: state.columnTaskIds.review.length,
  done: state.columnTaskIds.done.length,
  total: Object.keys(state.tasksById).length,
});

export function resetBoardStore(): void {
  boardStore.setState({
    ...emptyDomainState(),
    hasHydrated: true,
    currentSprintId: null,
    knownAssigneeIds: [],
  });
}
