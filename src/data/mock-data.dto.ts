export interface UserDTO {
  id: number;
  name: string;
  email: string;
  avatar: string;
}

export interface SprintDTO {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
}

export type TaskStatusDTO = 'backlog' | 'in-progress' | 'review' | 'done';
export type TaskPriorityDTO = 'low' | 'medium' | 'high';

export interface TaskDTO {
  id: number;
  title: string;
  description: string;
  status: TaskStatusDTO;
  priority: TaskPriorityDTO;
  assigneeId: number;
  dueDate: string;
  sprintId: number;
  order: number;
  createdAt: string;
  completedAt: string | null;
  updatedAt: string;
}

export interface CommentDTO {
  id: number;
  taskId: number;
  authorId: number;
  message: string;
  createdAt: string;
}

export type NotificationTypeDTO = 'task' | 'review';

export interface NotificationDTO {
  id: number;
  title: string;
  message: string;
  type: NotificationTypeDTO;
  read: boolean;
  createdAt: string;
}

export interface MockDataDTO {
  users: UserDTO[];
  sprints: SprintDTO[];
  tasks: TaskDTO[];
  comments: CommentDTO[];
  notifications: NotificationDTO[];
}
