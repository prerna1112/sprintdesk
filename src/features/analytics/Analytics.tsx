import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Button, Skeleton } from '../../components/ui';
import { useBoardStore } from '../board';
import { useWorkspaceBoard } from '../dashboard';
import {
  PRIORITY_ORDER,
  selectCompletionTrend,
  selectPriorityBreakdown,
  selectPriorityTotals,
  selectSprintVelocity,
  selectStatusDistribution,
} from './selectors';

const CHART_COLORS = {
  primary: 'hsl(var(--primary))',
  success: 'hsl(var(--success))',
  backlog: 'hsl(var(--status-backlog))',
  inProgress: 'hsl(var(--status-progress))',
  review: 'hsl(var(--warning))',
  done: 'hsl(var(--status-done))',
  high: 'hsl(var(--priority-high))',
  medium: 'hsl(var(--priority-medium))',
  low: 'hsl(var(--priority-low))',
  grid: 'hsl(var(--border))',
  muted: 'hsl(var(--muted-foreground))',
} as const;

const tooltipStyle = {
  backgroundColor: 'hsl(var(--surface))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '0.75rem',
  color: 'hsl(var(--foreground))',
  fontSize: '0.75rem',
};

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false,
  );

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return reduced;
}

function formatShortDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(`${value}T00:00:00`));
}

function ChartCard({ id, title, description, chart, summary }: {
  id: string;
  title: string;
  description: string;
  chart: ReactNode;
  summary: ReactNode;
}) {
  return (
    <section aria-labelledby={`${id}-title`} className="min-w-0 rounded-2xl border bg-surface p-4 shadow-sm sm:p-5">
      <h2 className="text-lg font-black" id={`${id}-title`}>{title}</h2>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground" id={`${id}-description`}>{description}</p>
      <div aria-hidden="true" className="mt-4 h-[17rem] min-h-[17rem] min-w-0 overflow-hidden" data-chart-visual="" tabIndex={-1}>
        {chart}
      </div>
      <div aria-label={`${title} values`} className="mt-4 border-t pt-4 text-xs">
        {summary}
      </div>
    </section>
  );
}

function ChartEmpty({ children }: { children: ReactNode }) {
  return <div className="grid h-full place-items-center rounded-xl bg-muted/40 px-4 text-center text-sm text-muted-foreground">{children}</div>;
}

function AnalyticsLoading() {
  return (
    <div aria-busy="true" aria-label="Loading analytics" className="grid gap-7" role="status">
      <div><h1 className="text-3xl font-black">Analytics</h1><Skeleton className="mt-2 h-4 w-72" /></div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">{[0, 1, 2, 3].map((item) => <Skeleton className="h-[25rem]" key={item} />)}</div>
    </div>
  );
}

export function Analytics() {
  const { query, hasHydrated, initializedFromSource, persistenceError } = useWorkspaceBoard();
  const tasksById = useBoardStore((state) => state.tasksById);
  const columnTaskIds = useBoardStore((state) => state.columnTaskIds);
  const reducedMotion = useReducedMotion();
  const snapshot = useMemo(() => ({ tasksById, columnTaskIds }), [columnTaskIds, tasksById]);
  const velocity = useMemo(() => selectSprintVelocity(snapshot, query.data?.sprints ?? []), [query.data?.sprints, snapshot]);
  const status = useMemo(() => selectStatusDistribution(snapshot), [snapshot]);
  const priorities = useMemo(() => selectPriorityBreakdown(snapshot), [snapshot]);
  const priorityTotals = useMemo(() => selectPriorityTotals(priorities), [priorities]);
  const trend = useMemo(() => selectCompletionTrend(snapshot), [snapshot]);
  const totalTasks = status.reduce((sum, item) => sum + item.count, 0);
  const totalCompletions = trend.at(-1)?.cumulative ?? 0;
  const animate = !reducedMotion;

  if (query.isPending || !hasHydrated) return <AnalyticsLoading />;

  if (query.isError) {
    return (
      <div className="rounded-2xl border bg-surface p-8 text-center" role="alert">
        <h1 className="text-3xl font-black">Analytics</h1>
        <h2 className="mt-5 text-xl font-black">Analytics could not be loaded</h2>
        <p className="mt-2 text-sm text-muted-foreground">{query.error instanceof Error ? query.error.message : 'Sprint data is unavailable.'}</p>
        <Button className="mt-5" onClick={() => void query.refetch()}>Retry loading analytics</Button>
      </div>
    );
  }

  if (!initializedFromSource) return <AnalyticsLoading />;

  return (
    <div className="grid min-w-0 gap-7">
      {persistenceError ? (
        <div className="rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm font-semibold" role="status">
          {persistenceError}
        </div>
      ) : null}

      <header>
        <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">Insights</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight">Analytics</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">Live delivery insights derived from the persisted board. Changes on the board are reflected here immediately.</p>
      </header>

      <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard
          chart={velocity.some((item) => item.completed > 0) ? (
            <ResponsiveContainer height="100%" width="100%">
              <BarChart accessibilityLayer={false} data={velocity} margin={{ top: 8, right: 8, left: -20, bottom: 4 }}>
                <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="sprintName" minTickGap={20} stroke={CHART_COLORS.muted} tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} stroke={CHART_COLORS.muted} tick={{ fontSize: 12 }} width={42} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'hsl(var(--muted))' }} />
                <Bar dataKey="completed" fill={CHART_COLORS.primary} isAnimationActive={animate} name="Completed tasks" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <ChartEmpty>No completed sprint work is available yet.</ChartEmpty>}
          description="Completed tasks grouped by sprint, using the board’s current task state."
          id="velocity"
          summary={(
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
              {velocity.map((item) => <div className="flex justify-between gap-2" key={item.sprintId}><dt>{item.sprintName}</dt><dd className="font-black tabular-nums">{item.completed}</dd></div>)}
            </dl>
          )}
          title="Sprint velocity"
        />

        <ChartCard
          chart={totalTasks > 0 ? (
            <ResponsiveContainer height="100%" width="100%">
              <PieChart accessibilityLayer={false}>
                <Pie cx="50%" cy="44%" data={status} dataKey="count" innerRadius="43%" isAnimationActive={animate} nameKey="label" outerRadius="72%" paddingAngle={2}>
                  {status.map((item) => <Cell fill={CHART_COLORS[item.status]} key={item.status} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend iconSize={10} wrapperStyle={{ fontSize: '12px', lineHeight: '20px' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <ChartEmpty>No board tasks are available to distribute.</ChartEmpty>}
          description="All persisted tasks across the board’s four workflow columns."
          id="status"
          summary={(
            <ul className="grid grid-cols-2 gap-x-4 gap-y-2">
              {status.map((item) => <li className="flex justify-between gap-2" key={item.status}><span>{item.label}</span><span className="font-black tabular-nums">{item.count}</span></li>)}
            </ul>
          )}
          title="Task status distribution"
        />

        <ChartCard
          chart={totalTasks > 0 ? (
            <ResponsiveContainer height="100%" width="100%">
              <BarChart accessibilityLayer={false} data={priorities} margin={{ top: 8, right: 8, left: -20, bottom: 4 }}>
                <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" minTickGap={12} stroke={CHART_COLORS.muted} tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} stroke={CHART_COLORS.muted} tick={{ fontSize: 12 }} width={42} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'hsl(var(--muted))' }} />
                <Legend iconSize={10} wrapperStyle={{ fontSize: '12px', lineHeight: '20px' }} />
                <Bar dataKey="high" fill={CHART_COLORS.high} isAnimationActive={animate} name="High" stackId="priority" />
                <Bar dataKey="medium" fill={CHART_COLORS.medium} isAnimationActive={animate} name="Medium" stackId="priority" />
                <Bar dataKey="low" fill={CHART_COLORS.low} isAnimationActive={animate} name="Low" radius={[5, 5, 0, 0]} stackId="priority" />
              </BarChart>
            </ResponsiveContainer>
          ) : <ChartEmpty>No task priorities are available yet.</ChartEmpty>}
          description="Priority mix within each board column. Bars are stacked by priority."
          id="priority"
          summary={(
            <div className="overflow-x-auto">
              <table className="w-full min-w-[20rem] text-left">
                <caption className="sr-only">Priority totals and board-column breakdown</caption>
                <thead><tr className="text-muted-foreground"><th className="pb-2 font-semibold" scope="col">Status</th>{PRIORITY_ORDER.map((priority) => <th className="pb-2 text-right font-semibold capitalize" key={priority} scope="col">{priority}</th>)}</tr></thead>
                <tbody>{priorities.map((item) => <tr key={item.status}><th className="py-1 font-semibold" scope="row">{item.label}</th>{PRIORITY_ORDER.map((priority) => <td className="py-1 text-right tabular-nums" key={priority}>{item[priority]}</td>)}</tr>)}</tbody>
                <tfoot><tr className="border-t font-black"><th className="pt-2" scope="row">Total</th>{PRIORITY_ORDER.map((priority) => <td className="pt-2 text-right tabular-nums" key={priority}>{priorityTotals[priority]}</td>)}</tr></tfoot>
              </table>
            </div>
          )}
          title="Priority breakdown"
        />

        <ChartCard
          chart={trend.length > 0 ? (
            <ResponsiveContainer height="100%" width="100%">
              <LineChart accessibilityLayer={false} data={trend} margin={{ top: 8, right: 12, left: -20, bottom: 4 }}>
                <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" interval="preserveStartEnd" minTickGap={36} stroke={CHART_COLORS.muted} tick={{ fontSize: 11 }} tickFormatter={formatShortDate} />
                <YAxis allowDecimals={false} stroke={CHART_COLORS.muted} tick={{ fontSize: 12 }} width={42} />
                <Tooltip contentStyle={tooltipStyle} labelFormatter={(value) => formatShortDate(String(value))} />
                <Line dataKey="cumulative" dot={{ r: 2 }} isAnimationActive={animate} name="Cumulative completed" stroke={CHART_COLORS.success} strokeWidth={3} type="monotone" />
              </LineChart>
            </ResponsiveContainer>
          ) : <ChartEmpty>No completion dates have been recorded yet.</ChartEmpty>}
          description="Cumulative completions on each recorded completion date; no completions are inferred."
          id="trend"
          summary={trend.length > 0 ? (
            <div>
              <p className="mb-2 font-semibold">{totalCompletions} tasks completed across {trend.length} recorded dates.</p>
              <ul className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
                {trend.map((item) => <li className="flex justify-between gap-2" key={item.date}><span>{formatShortDate(item.date)}</span><span className="font-black tabular-nums">+{item.completed} · {item.cumulative}</span></li>)}
              </ul>
            </div>
          ) : <p>No recorded completion dates.</p>}
          title="Completion trend"
        />
      </div>
    </div>
  );
}
