export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
}

export interface Sprint {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
}

export type TaskStatus = 'backlog' | 'inProgress' | 'review' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high';

export interface Task {
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

export interface Comment {
  id: string;
  taskId: string;
  authorId: string;
  body: string;
  createdAt: string;
}

export type NotificationType = 'task' | 'review';

export interface Notification {
  id: string;
  sourceId: string;
  title: string;
  message: string;
  type: NotificationType;
  readAt: string | null;
  createdAt: string;
}

export type ColumnTaskIds = Record<TaskStatus, string[]>;

export interface MockData {
  users: User[];
  sprints: Sprint[];
  tasks: Task[];
  comments: Comment[];
  notifications: Notification[];
  columnTaskIds: ColumnTaskIds;
}
