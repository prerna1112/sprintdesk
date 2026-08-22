import type { Assignee, Sprint, SprintTask, TaskStatus } from '../../domain/types';

export interface DashboardBoardSnapshot {
  tasksById: Record<string, SprintTask>;
}

export interface DashboardSummary {
  sprint: Sprint | null;
  total: number;
  backlog: number;
  inProgress: number;
  review: number;
  done: number;
  completionRate: number;
  overdue: number;
  upcoming: number;
}

export interface DashboardTaskRow extends SprintTask {
  assigneeName: string;
}

const EMPTY_COUNTS: Record<TaskStatus, number> = {
  backlog: 0,
  inProgress: 0,
  review: 0,
  done: 0,
};

export function selectCurrentSprint(sprints: Sprint[]): Sprint | null {
  return sprints.reduce<Sprint | null>(
    (latest, sprint) => (!latest || sprint.startDate > latest.startDate ? sprint : latest),
    null,
  );
}

export function selectDashboardSummary(
  snapshot: DashboardBoardSnapshot,
  sprints: Sprint[],
  asOfDate: string,
): DashboardSummary {
  const sprint = selectCurrentSprint(sprints);
  if (!sprint) return { sprint: null, total: 0, ...EMPTY_COUNTS, completionRate: 0, overdue: 0, upcoming: 0 };

  const tasks = Object.values(snapshot.tasksById).filter((task) => task.sprintId === sprint.id);
  const counts = tasks.reduce<Record<TaskStatus, number>>(
    (result, task) => ({ ...result, [task.status]: result[task.status] + 1 }),
    { ...EMPTY_COUNTS },
  );
  const activeTasks = tasks.filter((task) => task.status !== 'done');
  const overdue = activeTasks.filter((task) => task.dueDate.slice(0, 10) < asOfDate).length;
  const upcoming = activeTasks.filter((task) => task.dueDate.slice(0, 10) >= asOfDate).length;

  return {
    sprint,
    total: tasks.length,
    ...counts,
    completionRate: tasks.length === 0 ? 0 : Math.round((counts.done / tasks.length) * 100),
    overdue,
    upcoming,
  };
}

export function selectDashboardTasks(
  snapshot: DashboardBoardSnapshot,
  sprints: Sprint[],
  assignees: Assignee[],
  limit = 8,
): DashboardTaskRow[] {
  const sprint = selectCurrentSprint(sprints);
  if (!sprint) return [];
  const assigneesById = new Map(assignees.map((assignee) => [assignee.id, assignee.name]));

  return Object.values(snapshot.tasksById)
    .filter((task) => task.sprintId === sprint.id && task.status !== 'done')
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || b.updatedAt.localeCompare(a.updatedAt) || a.title.localeCompare(b.title))
    .slice(0, Math.max(0, limit))
    .map((task) => ({ ...task, assigneeName: assigneesById.get(task.assigneeId) ?? 'Unknown assignee' }));
}
