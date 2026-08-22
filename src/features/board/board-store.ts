import { useStore } from 'zustand';
import { createStore, type StoreApi } from 'zustand/vanilla';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
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
export const BOARD_ID_GENERATION_ATTEMPTS = 8;
export const BOARD_STATUSES: TaskStatus[] = ['backlog', 'inProgress', 'review', 'done'];
export const BOARD_PERSISTENCE_WARNING = 'Board changes are available in this tab but may not survive reload.';

type ValidationField = 'title' | 'description' | 'priority' | 'assigneeId' | 'dueDate' | 'body' | 'taskId' | 'destination' | 'details';

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

export class BoardIdCollisionError extends Error {
  readonly code = 'idCollision';

  constructor(entity: 'task' | 'comment') {
    super(`Unable to generate a unique ${entity} ID.`);
    this.name = 'BoardIdCollisionError';
  }
}

export interface BoardStore extends BoardStateV1 {
  hasHydrated: boolean;
  persistenceError: string | null;
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
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value))) return false;
  return new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
}

function isValidTimestamp(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match) return false;
  const [, yearValue, monthValue, dayValue, hourValue, minuteValue, secondValue, zone] = match;
  const year = Number(yearValue);
  const month = Number(monthValue);
  const day = Number(dayValue);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth) return false;
  if (Number(hourValue) > 23 || Number(minuteValue) > 59 || Number(secondValue) > 59) return false;
  if (zone && zone !== 'Z') {
    const [zoneHour, zoneMinute] = zone.slice(1).split(':').map(Number);
    if ((zoneHour ?? 0) > 23 || (zoneMinute ?? 0) > 59) return false;
  }
  return Number.isFinite(Date.parse(value));
}

function isTask(value: unknown): value is SprintTask {
  if (!isRecord(value)) return false;
  const statusIsValid = BOARD_STATUSES.includes(value.status as TaskStatus);
  const completionIsValid = value.status === 'done'
    ? typeof value.completedAt === 'string' && isValidTimestamp(value.completedAt)
    : value.completedAt === null;
  return typeof value.id === 'string' && value.id.trim().length > 0
    && typeof value.title === 'string' && value.title.trim().length > 0
    && typeof value.description === 'string'
    && statusIsValid
    && ['low', 'medium', 'high'].includes(value.priority as string)
    && typeof value.assigneeId === 'string' && value.assigneeId.trim().length > 0
    && typeof value.sprintId === 'string' && value.sprintId.trim().length > 0
    && typeof value.dueDate === 'string' && isValidDate(value.dueDate)
    && typeof value.createdAt === 'string' && isValidTimestamp(value.createdAt)
    && typeof value.updatedAt === 'string' && isValidTimestamp(value.updatedAt)
    && completionIsValid;
}

function isComment(value: unknown): value is TaskComment {
  return isRecord(value)
    && typeof value.id === 'string' && value.id.trim().length > 0
    && typeof value.taskId === 'string' && value.taskId.trim().length > 0
    && typeof value.authorId === 'string' && value.authorId.trim().length > 0
    && typeof value.body === 'string' && value.body.trim().length > 0
    && typeof value.createdAt === 'string'
    && isValidTimestamp(value.createdAt);
}

function parsePersistedDomain(value: unknown): BoardStateV1 | null {
  if (!isRecord(value) || value.version !== 1 || typeof value.initializedFromSource !== 'boolean') return null;
  const persistedKeys = Object.keys(value).sort();
  const expectedKeys = ['columnTaskIds', 'commentsByTaskId', 'initializedFromSource', 'tasksById', 'version'];
  if (persistedKeys.length !== expectedKeys.length || persistedKeys.some((key, index) => key !== expectedKeys[index])) return null;
  if (!isRecord(value.tasksById) || !isRecord(value.columnTaskIds) || !isRecord(value.commentsByTaskId)) return null;
  if (!Object.values(value.tasksById).every(isTask)) return null;
  if (Object.entries(value.tasksById).some(([key, task]) => (task as SprintTask).id !== key)) return null;
  const persistedColumns = value.columnTaskIds;
  const persistedColumnKeys = Object.keys(persistedColumns).sort();
  const expectedColumnKeys = [...BOARD_STATUSES].sort();
  if (persistedColumnKeys.length !== expectedColumnKeys.length
    || persistedColumnKeys.some((key, index) => key !== expectedColumnKeys[index])) return null;
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
  Object.values(state.tasksById).forEach((task) => {
    if (task.status === 'done' && (task.completedAt === null || !isValidTimestamp(task.completedAt))) {
      errors.push(`Done task ${task.id} must have a valid completion timestamp.`);
    }
    if (task.status !== 'done' && task.completedAt !== null) {
      errors.push(`Non-done task ${task.id} cannot have a completion timestamp.`);
    }
  });
  const commentIds: string[] = [];
  Object.entries(state.commentsByTaskId).forEach(([taskId, comments]) => {
    if (!state.tasksById[taskId]) errors.push(`Comments reference missing task ${taskId}.`);
    if (comments.some((comment) => comment.taskId !== taskId)) errors.push(`Comment task mismatch for ${taskId}.`);
    comments.forEach((comment) => {
      commentIds.push(comment.id);
      if (!isComment(comment as unknown)) errors.push(`Comment data for ${taskId} is invalid.`);
    });
  });
  if (new Set(commentIds).size !== commentIds.length) errors.push('Comment IDs must be globally unique.');
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

function validateUpdateInput(input: Record<string, unknown>): { ok: true } | { ok: false; error: BoardActionError } {
  if ('title' in input && input.title !== undefined && typeof input.title !== 'string') return validationError('title', 'Title must be text.');
  if ('description' in input && input.description !== undefined && typeof input.description !== 'string') return validationError('description', 'Description must be text.');
  if ('priority' in input && input.priority !== undefined
    && (typeof input.priority !== 'string' || !['low', 'medium', 'high'].includes(input.priority))) {
    return validationError('priority', 'Choose a valid priority.');
  }
  if ('assigneeId' in input && input.assigneeId !== undefined && typeof input.assigneeId !== 'string') return validationError('assigneeId', 'Choose a valid assignee.');
  if ('dueDate' in input && input.dueDate !== undefined && typeof input.dueDate !== 'string') return validationError('dueDate', 'Enter a valid due date.');
  return { ok: true };
}

function nextUniqueId(
  entity: 'task' | 'comment',
  generateId: () => string,
  exists: (id: string) => boolean,
): string {
  for (let attempt = 0; attempt < BOARD_ID_GENERATION_ATTEMPTS; attempt += 1) {
    const candidate = generateId();
    if (typeof candidate === 'string' && candidate.length > 0 && !exists(candidate)) return candidate;
  }
  throw new BoardIdCollisionError(entity);
}

function createResilientStateStorage(
  getStorage: () => Storage | undefined,
  reportError: () => void,
  isReportingError: () => boolean,
): StateStorage {
  const memory = new Map<string, string>();
  let durabilityFailed = false;
  return {
    getItem: (name) => {
      if (durabilityFailed) return memory.get(name) ?? null;
      try {
        const durableStorage = getStorage();
        if (!durableStorage) {
          durabilityFailed = true;
          reportError();
          return memory.get(name) ?? null;
        }
        const value = durableStorage.getItem(name) ?? memory.get(name) ?? null;
        if (value !== null) memory.set(name, value);
        return value;
      } catch {
        durabilityFailed = true;
        reportError();
        return memory.get(name) ?? null;
      }
    },
    setItem: (name, value) => {
      if (isReportingError()) return;
      memory.set(name, value);
      try {
        const durableStorage = getStorage();
        if (!durableStorage) {
          durabilityFailed = true;
          reportError();
          return;
        }
        durableStorage.setItem(name, value);
      } catch {
        durabilityFailed = true;
        reportError();
      }
    },
    removeItem: (name) => {
      memory.delete(name);
      try {
        const durableStorage = getStorage();
        if (!durableStorage) {
          durabilityFailed = true;
          reportError();
          return;
        }
        durableStorage.removeItem(name);
      } catch {
        durabilityFailed = true;
        reportError();
      }
    },
  };
}

export function createBoardStore(options: {
  skipHydration?: boolean;
  generateId?: () => string;
  getStorage?: () => Storage | undefined;
} = {}) {
  const generateId = options.generateId ?? (() => globalThis.crypto.randomUUID());
  let storeRef: StoreApi<BoardStore> | null = null;
  let pendingPersistenceError = false;
  let reportingPersistenceError = false;
  const reportPersistenceError = () => {
    pendingPersistenceError = true;
    if (!storeRef || reportingPersistenceError || storeRef.getState().persistenceError) return;
    reportingPersistenceError = true;
    storeRef.setState({ persistenceError: BOARD_PERSISTENCE_WARNING });
    reportingPersistenceError = false;
  };
  const getStorage = options.getStorage ?? (() => (typeof window === 'undefined' ? undefined : window.localStorage));
  const storage = createJSONStorage(() => createResilientStateStorage(
    getStorage,
    reportPersistenceError,
    () => reportingPersistenceError,
  ));

  const store = createStore<BoardStore>()(
    persist(
      (set, get) => ({
        ...emptyDomainState(),
        hasHydrated: false,
        persistenceError: null,
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
          const taskId = nextUniqueId('task', generateId, (id) => Boolean(state.tasksById[id]));
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
          if (!isRecord(input as unknown)) return validationError('details', 'Task details must be an object.');
          const runtimeInput = input as unknown as Record<string, unknown>;
          const editableKeys = new Set(['title', 'description', 'priority', 'assigneeId', 'dueDate']);
          const unexpectedKey = Object.keys(runtimeInput).find((key) => !editableKeys.has(key));
          if (unexpectedKey) return validationError('details', `Task field “${unexpectedKey}” cannot be updated here.`);
          const runtimeValidation = validateUpdateInput(runtimeInput);
          if (!runtimeValidation.ok) return runtimeValidation;
          const editableInput = input as UpdateTaskInput;
          const next = {
            title: editableInput.title ?? task.title,
            priority: editableInput.priority ?? task.priority,
            assigneeId: editableInput.assigneeId ?? task.assigneeId,
            dueDate: editableInput.dueDate ?? task.dueDate,
          };
          const validation = validateTaskFields(next, state.knownAssigneeIds);
          if (!validation.ok) return validation;
          const updatedTask: SprintTask = {
            ...task,
            title: next.title.trim(),
            description: editableInput.description?.trim() ?? task.description,
            priority: next.priority,
            assigneeId: next.assigneeId,
            dueDate: next.dueDate,
            updatedAt: new Date().toISOString(),
          };
          set((current) => ({
            tasksById: {
              ...current.tasksById,
              [taskId]: updatedTask,
            },
          }));
          return { ok: true };
        },
        addComment: (taskId, body, authorId) => {
          const state = get();
          if (!state.tasksById[taskId]) return { ok: false, error: { code: 'notFound', field: 'taskId', message: 'Task was not found.' } };
          if (!body.trim()) return validationError('body', 'Comment cannot be empty.');
          if (!authorId.trim()) return validationError('assigneeId', 'A comment author is required.');
          const commentIds = new Set(Object.values(state.commentsByTaskId).flat().map((comment) => comment.id));
          const commentId = nextUniqueId('comment', generateId, (id) => commentIds.has(id));
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
  if (pendingPersistenceError) queueMicrotask(reportPersistenceError);
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
    persistenceError: null,
    currentSprintId: null,
    knownAssigneeIds: [],
  });
}
