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
  ColumnTaskIds,
  Comment,
  MockData,
  Notification,
  Sprint,
  Task,
  TaskPriority,
  TaskStatus,
  User,
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
  hasString(value, 'startDate');
  hasString(value, 'endDate');
}

function validateTask(value: unknown): asserts value is TaskDTO {
  invariant(isRecord(value), 'task must be an object');
  hasNumber(value, 'id');
  hasString(value, 'title');
  hasString(value, 'description');
  invariant(sourceStatuses.includes(value.status as TaskStatusDTO), `task ${String(value.id)} has an unsupported status`);
  invariant(priorities.includes(value.priority as TaskPriorityDTO), `task ${String(value.id)} has an unsupported priority`);
  hasNumber(value, 'assigneeId');
  hasString(value, 'dueDate');
  hasNumber(value, 'sprintId');
  hasNumber(value, 'order');
  hasString(value, 'createdAt');
  invariant(value.completedAt === null || typeof value.completedAt === 'string', `task ${String(value.id)} completedAt must be a string or null`);
  hasString(value, 'updatedAt');
}

function validateComment(value: unknown): asserts value is CommentDTO {
  invariant(isRecord(value), 'comment must be an object');
  hasNumber(value, 'id');
  hasNumber(value, 'taskId');
  hasNumber(value, 'authorId');
  hasString(value, 'message');
  hasString(value, 'createdAt');
}

function validateNotification(value: unknown): asserts value is NotificationDTO {
  invariant(isRecord(value), 'notification must be an object');
  hasNumber(value, 'id');
  hasString(value, 'title');
  hasString(value, 'message');
  invariant(notificationTypes.includes(value.type as NotificationDTO['type']), `notification ${String(value.id)} has an unsupported type`);
  invariant(typeof value.read === 'boolean', `notification ${String(value.id)} read must be a boolean`);
  hasString(value, 'createdAt');
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

function adaptUser(user: UserDTO): User {
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

function adaptTask(task: TaskDTO): Task {
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

function adaptComment(comment: CommentDTO): Comment {
  return {
    id: String(comment.id),
    taskId: String(comment.taskId),
    authorId: String(comment.authorId),
    body: comment.message,
    createdAt: comment.createdAt,
  };
}

function adaptNotification(notification: NotificationDTO): Notification {
  const sourceId = `mock:${notification.id}`;
  return {
    id: sourceId,
    sourceId,
    title: notification.title,
    message: notification.message,
    type: notification.type,
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

export function adaptMockData(source: MockDataDTO): MockData {
  const tasks = source.tasks.map(adaptTask);
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

export function parseAndAdaptMockData(value: unknown): MockData {
  return adaptMockData(parseMockDataDTO(value));
}
