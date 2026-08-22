import type {
  CommentDTO,
  MockDataDTO,
  NotificationDTO,
  SprintDTO,
  TaskDTO,
  TaskPriorityDTO,
  TaskStatusDTO,
  UserDTO,
} from './mock-data.dto';
import type {
  AppNotification,
  Assignee,
  ColumnTaskIds,
  MockData,
  Sprint,
  SprintTask,
  TaskComment,
  TaskPriority,
  TaskStatus,
} from '../domain/types';

const sourceStatuses = ['backlog', 'in-progress', 'review', 'done'] as const;
const priorities = ['low', 'medium', 'high'] as const;
const notificationTypes = ['task', 'review'] as const;

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`Invalid mock data: ${message}`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasString(record: Record<string, unknown>, key: string): void {
  invariant(typeof record[key] === 'string', `${key} must be a string`);
}

function hasNumber(record: Record<string, unknown>, key: string): void {
  invariant(typeof record[key] === 'number' && Number.isFinite(record[key]), `${key} must be a number`);
}

function isValidIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(Z|[+-]\d{2}:\d{2}))?$/.exec(value);

  if (!match) {
    return false;
  }

  const [, yearValue, monthValue, dayValue, hourValue, minuteValue, secondValue] = match;
  const year = Number(yearValue);
  const month = Number(monthValue);
  const day = Number(dayValue);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const validCalendarDate = month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth;

  if (!validCalendarDate) {
    return false;
  }

  if (hourValue !== undefined) {
    const validTime = Number(hourValue) <= 23
      && Number(minuteValue) <= 59
      && Number(secondValue) <= 59;
    return validTime && Number.isFinite(Date.parse(value));
  }

  return true;
}

function hasValidDate(
  record: Record<string, unknown>,
  key: string,
  context: string,
): void {
  const value = record[key];
  invariant(
    typeof value === 'string' && isValidIsoDate(value),
    `${context} ${key} must be a valid ISO date string`,
  );
}

function validateUser(value: unknown): asserts value is UserDTO {
  invariant(isRecord(value), 'user must be an object');
  hasNumber(value, 'id');
  hasString(value, 'name');
  hasString(value, 'email');
  hasString(value, 'avatar');
}

function validateSprint(value: unknown): asserts value is SprintDTO {
  invariant(isRecord(value), 'sprint must be an object');
  hasNumber(value, 'id');
  hasString(value, 'name');
  const context = `sprint ${String(value.id)}`;
  hasValidDate(value, 'startDate', context);
  hasValidDate(value, 'endDate', context);
}

function validateTask(value: unknown): asserts value is TaskDTO {
  invariant(isRecord(value), 'task must be an object');
  hasNumber(value, 'id');
  hasString(value, 'title');
  hasString(value, 'description');
  invariant(sourceStatuses.includes(value.status as TaskStatusDTO), `task ${String(value.id)} has an unsupported status`);
  invariant(priorities.includes(value.priority as TaskPriorityDTO), `task ${String(value.id)} has an unsupported priority`);
  hasNumber(value, 'assigneeId');
  hasNumber(value, 'sprintId');
  hasNumber(value, 'order');
  const context = `task ${String(value.id)}`;
  hasValidDate(value, 'dueDate', context);
  hasValidDate(value, 'createdAt', context);
  invariant(
    value.completedAt === null
      || (typeof value.completedAt === 'string' && isValidIsoDate(value.completedAt)),
    `${context} completedAt must be null or a valid ISO date string`,
  );
  hasValidDate(value, 'updatedAt', context);
}

function validateComment(value: unknown): asserts value is CommentDTO {
  invariant(isRecord(value), 'comment must be an object');
  hasNumber(value, 'id');
  hasNumber(value, 'taskId');
  hasNumber(value, 'authorId');
  hasString(value, 'message');
  hasValidDate(value, 'createdAt', `comment ${String(value.id)}`);
}

function validateNotification(value: unknown): asserts value is NotificationDTO {
  invariant(isRecord(value), 'notification must be an object');
  hasNumber(value, 'id');
  hasString(value, 'title');
  hasString(value, 'message');
  invariant(notificationTypes.includes(value.type as NotificationDTO['type']), `notification ${String(value.id)} has an unsupported type`);
  invariant(typeof value.read === 'boolean', `notification ${String(value.id)} read must be a boolean`);
  hasValidDate(value, 'createdAt', `notification ${String(value.id)}`);
}

function validateCollection<T>(
  source: Record<string, unknown>,
  key: string,
  validateItem: (value: unknown) => asserts value is T,
): T[] {
  const collection = source[key];
  invariant(Array.isArray(collection), `${key} must be an array`);
  collection.forEach(validateItem);
  return collection;
}

export function parseMockDataDTO(value: unknown): MockDataDTO {
  invariant(isRecord(value), 'root must be an object');

  return {
    users: validateCollection(value, 'users', validateUser),
    sprints: validateCollection(value, 'sprints', validateSprint),
    tasks: validateCollection(value, 'tasks', validateTask),
    comments: validateCollection(value, 'comments', validateComment),
    notifications: validateCollection(value, 'notifications', validateNotification),
  };
}

function mapStatus(status: TaskStatusDTO): TaskStatus {
  return status === 'in-progress' ? 'inProgress' : status;
}

function mapPriority(priority: TaskPriorityDTO): TaskPriority {
  return priority;
}

function adaptUser(user: UserDTO): Assignee {
  return {
    id: String(user.id),
    name: user.name,
    email: user.email,
    avatarUrl: user.avatar,
  };
}

function adaptSprint(sprint: SprintDTO): Sprint {
  return { ...sprint, id: String(sprint.id) };
}

function adaptTask(task: TaskDTO): SprintTask {
  return {
    id: String(task.id),
    title: task.title,
    description: task.description,
    status: mapStatus(task.status),
    priority: mapPriority(task.priority),
    assigneeId: String(task.assigneeId),
    dueDate: task.dueDate,
    sprintId: String(task.sprintId),
    createdAt: task.createdAt,
    completedAt: task.completedAt,
    updatedAt: task.updatedAt,
  };
}

function adaptComment(comment: CommentDTO): TaskComment {
  return {
    id: String(comment.id),
    taskId: String(comment.taskId),
    authorId: String(comment.authorId),
    body: comment.message,
    createdAt: comment.createdAt,
  };
}

function adaptNotification(notification: NotificationDTO): AppNotification {
  const sourceId = `mock:${notification.id}`;
  return {
    id: sourceId,
    source: 'mock',
    sourceId,
    title: notification.title,
    body: notification.message,
    readAt: notification.read ? notification.createdAt : null,
    createdAt: notification.createdAt,
  };
}

function assertUniqueIds(collectionName: string, ids: string[]): void {
  invariant(new Set(ids).size === ids.length, `${collectionName} contains duplicate IDs`);
}

function validateReferences(data: MockData): void {
  const userIds = new Set(data.users.map(({ id }) => id));
  const sprintIds = new Set(data.sprints.map(({ id }) => id));
  const taskIds = new Set(data.tasks.map(({ id }) => id));

  data.tasks.forEach((task) => {
    invariant(userIds.has(task.assigneeId), `task ${task.id} references missing user ${task.assigneeId}`);
    invariant(sprintIds.has(task.sprintId), `task ${task.id} references missing sprint ${task.sprintId}`);
  });
  data.comments.forEach((comment) => {
    invariant(taskIds.has(comment.taskId), `comment ${comment.id} references missing task ${comment.taskId}`);
    invariant(userIds.has(comment.authorId), `comment ${comment.id} references missing user ${comment.authorId}`);
  });
}

function mapMockDataDTO(source: MockDataDTO): MockData {
  const tasks = source.tasks.slice(0, 30).map(adaptTask);
  const columnTaskIds: ColumnTaskIds = {
    backlog: [],
    inProgress: [],
    review: [],
    done: [],
  };

  tasks.forEach((task) => columnTaskIds[task.status].push(task.id));

  const data: MockData = {
    users: source.users.map(adaptUser),
    sprints: source.sprints.map(adaptSprint),
    tasks,
    comments: source.comments.map(adaptComment),
    notifications: source.notifications.map(adaptNotification),
    columnTaskIds,
  };

  assertUniqueIds('users', data.users.map(({ id }) => id));
  assertUniqueIds('sprints', data.sprints.map(({ id }) => id));
  assertUniqueIds('tasks', data.tasks.map(({ id }) => id));
  assertUniqueIds('comments', data.comments.map(({ id }) => id));
  assertUniqueIds('notifications', data.notifications.map(({ id }) => id));
  validateReferences(data);

  return data;
}

export function adaptMockData(source: MockDataDTO): MockData {
  return mapMockDataDTO(parseMockDataDTO(source));
}

export function parseAndAdaptMockData(value: unknown): MockData {
  return mapMockDataDTO(parseMockDataDTO(value));
}
