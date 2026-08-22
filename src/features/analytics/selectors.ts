import type {
  ColumnTaskIds,
  Sprint,
  SprintTask,
  TaskPriority,
  TaskStatus,
} from '../../domain/types';

export interface BoardAnalyticsSnapshot {
  tasksById: Record<string, SprintTask>;
  columnTaskIds: ColumnTaskIds;
}

export interface SprintVelocityDatum {
  sprintId: string;
  sprintName: string;
  completed: number;
}

export interface StatusDistributionDatum {
  status: TaskStatus;
  label: string;
  count: number;
}

export interface PriorityBreakdownDatum {
  status: TaskStatus;
  label: string;
  low: number;
  medium: number;
  high: number;
}

export interface CompletionTrendDatum {
  date: string;
  completed: number;
  cumulative: number;
}

export const STATUS_LABELS: Record<TaskStatus, string> = {
  backlog: 'Backlog',
  inProgress: 'In progress',
  review: 'Review',
  done: 'Done',
};

export const STATUS_ORDER: TaskStatus[] = ['backlog', 'inProgress', 'review', 'done'];
export const PRIORITY_ORDER: TaskPriority[] = ['high', 'medium', 'low'];

function isValidDateOnly(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [, yearValue, monthValue, dayValue] = match;
  const year = Number(yearValue);
  const month = Number(monthValue);
  const day = Number(dayValue);
  if (month < 1 || month > 12) return false;
  return day >= 1 && day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function tasksInBoardOrder(snapshot: BoardAnalyticsSnapshot): SprintTask[] {
  return STATUS_ORDER.flatMap((status) => snapshot.columnTaskIds[status])
    .map((taskId) => snapshot.tasksById[taskId])
    .filter((task): task is SprintTask => Boolean(task));
}

export function toLocalDateKey(value: string): string {
  // Date-only values are calendar keys, not instants. Parsing them as UTC would
  // incorrectly shift them to the previous day in negative-offset timezones.
  if (isValidDateOnly(value)) return value;
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function selectSprintVelocity(
  snapshot: BoardAnalyticsSnapshot,
  sprints: Sprint[],
): SprintVelocityDatum[] {
  const completedBySprint = new Map<string, number>();
  tasksInBoardOrder(snapshot).forEach((task) => {
    if (task.status !== 'done') return;
    completedBySprint.set(task.sprintId, (completedBySprint.get(task.sprintId) ?? 0) + 1);
  });

  return [...sprints]
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .map((sprint) => ({
      sprintId: sprint.id,
      sprintName: sprint.name,
      completed: completedBySprint.get(sprint.id) ?? 0,
    }));
}

export function selectStatusDistribution(
  snapshot: BoardAnalyticsSnapshot,
): StatusDistributionDatum[] {
  return STATUS_ORDER.map((status) => ({
    status,
    label: STATUS_LABELS[status],
    count: snapshot.columnTaskIds[status].filter((taskId) => Boolean(snapshot.tasksById[taskId])).length,
  }));
}

export function selectPriorityBreakdown(
  snapshot: BoardAnalyticsSnapshot,
): PriorityBreakdownDatum[] {
  return STATUS_ORDER.map((status) => {
    const counts: Record<TaskPriority, number> = { low: 0, medium: 0, high: 0 };
    snapshot.columnTaskIds[status].forEach((taskId) => {
      const task = snapshot.tasksById[taskId];
      if (task) counts[task.priority] += 1;
    });
    return { status, label: STATUS_LABELS[status], ...counts };
  });
}

export function selectCompletionTrend(
  snapshot: BoardAnalyticsSnapshot,
): CompletionTrendDatum[] {
  const completedByDate = new Map<string, number>();
  tasksInBoardOrder(snapshot).forEach((task) => {
    if (task.status !== 'done' || !task.completedAt) return;
    const date = toLocalDateKey(task.completedAt);
    completedByDate.set(date, (completedByDate.get(date) ?? 0) + 1);
  });

  let cumulative = 0;
  return [...completedByDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, completed]) => {
      cumulative += completed;
      return { date, completed, cumulative };
    });
}

export function selectPriorityTotals(
  breakdown: PriorityBreakdownDatum[],
): Record<TaskPriority, number> {
  return breakdown.reduce<Record<TaskPriority, number>>(
    (totals, datum) => ({
      high: totals.high + datum.high,
      medium: totals.medium + datum.medium,
      low: totals.low + datum.low,
    }),
    { high: 0, medium: 0, low: 0 },
  );
}
