import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Button, DataTable, Skeleton, type DataTableColumn } from '../../components/ui';
import type { TaskPriority, TaskStatus } from '../../domain/types';
import { useBoardStore } from '../board';
import { selectDashboardSummary, selectDashboardTasks, type DashboardTaskRow } from './selectors';
import { useLocalToday } from './use-local-today';
import { useWorkspaceBoard } from './use-workspace-board';

const DASHBOARD_PATHS = {
  board: '/board',
  analytics: '/analytics',
} as const;

const statusLabels: Record<TaskStatus, string> = {
  backlog: 'Backlog',
  inProgress: 'In progress',
  review: 'Review',
  done: 'Done',
};

const priorityClasses: Record<TaskPriority, string> = {
  high: 'bg-priority-high/15 text-priority-high',
  medium: 'bg-priority-medium/15 text-priority-medium',
  low: 'bg-priority-low/15 text-priority-low',
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(`${value.slice(0, 10)}T00:00:00`));
}

const taskColumns: Array<DataTableColumn<DashboardTaskRow>> = [
  {
    key: 'task',
    header: 'Task',
    render: (task) => <span className="font-semibold text-foreground">{task.title}</span>,
  },
  { key: 'assignee', header: 'Assignee', render: (task) => task.assigneeName },
  {
    key: 'priority',
    header: 'Priority',
    render: (task) => (
      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-bold capitalize ${priorityClasses[task.priority]}`}>
        {task.priority}
      </span>
    ),
  },
  { key: 'due', header: 'Due date', render: (task) => formatDate(task.dueDate) },
  { key: 'status', header: 'Status', render: (task) => statusLabels[task.status] },
];

function DashboardLoading() {
  return (
    <div aria-busy="true" aria-label="Loading dashboard" className="grid gap-7" role="status">
      <div><h1 className="text-3xl font-black">Dashboard</h1><Skeleton className="mt-2 h-4 w-64" /></div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((item) => <Skeleton className="h-28" key={item} />)}</div>
      <DataTable caption="Current sprint focus tasks" columns={taskColumns} getRowKey={(row) => row.id} loading rows={[]} />
    </div>
  );
}

function SummaryCard({ label, value, detail }: { label: string; value: number | string; detail?: string }) {
  return (
    <article className="min-w-0 rounded-2xl border bg-surface p-4 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-black tabular-nums">{value}</p>
      {detail ? <p className="mt-1 text-xs text-muted-foreground">{detail}</p> : null}
    </article>
  );
}

export function Dashboard() {
  const { query, hasHydrated, initializedFromSource, persistenceError } = useWorkspaceBoard();
  const tasksById = useBoardStore((state) => state.tasksById);
  const today = useLocalToday();
  const summary = useMemo(
    () => selectDashboardSummary({ tasksById }, query.data?.sprints ?? [], today),
    [query.data?.sprints, tasksById, today],
  );
  const focusTasks = useMemo(
    () => selectDashboardTasks({ tasksById }, query.data?.sprints ?? [], query.data?.users ?? []),
    [query.data?.sprints, query.data?.users, tasksById],
  );

  if (query.isPending || !hasHydrated) return <DashboardLoading />;

  if (query.isError) {
    return (
      <div className="rounded-2xl border bg-surface p-8 text-center" role="alert">
        <h1 className="text-3xl font-black">Dashboard</h1>
        <h2 className="mt-5 text-xl font-black">The dashboard could not be loaded</h2>
        <p className="mt-2 text-sm text-muted-foreground">{query.error instanceof Error ? query.error.message : 'Sprint data is unavailable.'}</p>
        <Button className="mt-5" onClick={() => void query.refetch()}>Retry loading dashboard</Button>
      </div>
    );
  }

  if (!initializedFromSource) return <DashboardLoading />;

  return (
    <div className="grid min-w-0 gap-7">
      {persistenceError ? (
        <div className="rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm font-semibold" role="status">
          {persistenceError}
        </div>
      ) : null}

      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">Overview</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight">Dashboard</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {summary.sprint ? `${summary.sprint.name} · ${formatDate(summary.sprint.startDate)}–${formatDate(summary.sprint.endDate)}` : 'No current sprint is available.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="inline-flex h-10 items-center justify-center rounded-lg border bg-surface px-4 text-sm font-semibold shadow-sm transition-colors hover:bg-muted" to={DASHBOARD_PATHS.analytics}>View analytics</Link>
          <Link className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90" to={DASHBOARD_PATHS.board}>Open board</Link>
        </div>
      </header>

      {!summary.sprint || summary.total === 0 ? (
        <section className="rounded-2xl border bg-surface p-8 text-center">
          <h2 className="text-xl font-black">No current sprint work yet</h2>
          <p className="mt-2 text-sm text-muted-foreground">Tasks added to the current sprint will appear here.</p>
        </section>
      ) : (
        <>
          <section aria-labelledby="sprint-summary-title">
            <h2 className="sr-only" id="sprint-summary-title">Current sprint summary</h2>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
              <SummaryCard label="Total" value={summary.total} />
              <SummaryCard label="Backlog" value={summary.backlog} />
              <SummaryCard label="In progress" value={summary.inProgress} />
              <SummaryCard label="Review" value={summary.review} />
              <SummaryCard label="Done" value={summary.done} />
              <SummaryCard detail={`${summary.done} of ${summary.total} tasks`} label="Completion" value={`${summary.completionRate}%`} />
              <SummaryCard detail={`${summary.upcoming} upcoming`} label="Overdue" value={summary.overdue} />
            </div>
          </section>

          <section aria-labelledby="focus-tasks-title" className="min-w-0">
            <div className="mb-3">
              <h2 className="text-xl font-black" id="focus-tasks-title">Upcoming sprint work</h2>
              <p className="mt-1 text-sm text-muted-foreground">The next active tasks, ordered by due date.</p>
            </div>
            <DataTable
              caption={`${summary.sprint.name} upcoming tasks`}
              columns={taskColumns}
              emptyState="No active tasks remain in the current sprint."
              getRowKey={(task) => task.id}
              rows={focusTasks}
            />
          </section>
        </>
      )}
    </div>
  );
}
