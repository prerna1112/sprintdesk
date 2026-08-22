export interface Assignee {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
}

export interface Sprint {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
}

export type TaskStatus = 'backlog' | 'inProgress' | 'review' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high';

export interface SprintTask {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId: string;
  dueDate: string;
  sprintId: string;
  createdAt: string;
  completedAt: string | null;
  updatedAt: string;
}

export interface TaskComment {
  id: string;
  taskId: string;
  authorId: string;
  body: string;
  createdAt: string;
}

export interface AppNotification {
  id: string;
  source: 'mock' | 'jsonPlaceholder';
  sourceId: string;
  title: string;
  body: string;
  createdAt: string;
  readAt: string | null;
}

export type ColumnTaskIds = Record<TaskStatus, string[]>;

export interface BoardStateV1 {
  version: 1;
  tasksById: Record<string, SprintTask>;
  columnTaskIds: ColumnTaskIds;
  commentsByTaskId: Record<string, TaskComment[]>;
  initializedFromSource: boolean;
}

export interface MockData {
  users: Assignee[];
  sprints: Sprint[];
  tasks: SprintTask[];
  comments: TaskComment[];
  notifications: AppNotification[];
  columnTaskIds: ColumnTaskIds;
}
