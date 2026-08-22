import type { MockData } from './types';

export interface SprintVelocity {
  sprintId: string;
  completedTasks: number;
}

export function selectSprintVelocity(data: MockData): SprintVelocity[] {
  return data.sprints.map((sprint) => ({
    sprintId: sprint.id,
    completedTasks: data.tasks.filter(
      (task) => task.sprintId === sprint.id && task.status === 'done',
    ).length,
  }));
}
