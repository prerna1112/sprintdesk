import type { PropsWithChildren } from 'react';
import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import sourceJson from '../../public/mock-data.json';
import { boardStore, resetBoardStore } from '../features/board';
import { renderWithProviders } from '../test/render';
import AnalyticsRoute from './AnalyticsRoute';

type MockChartProps = PropsWithChildren<{ isAnimationActive?: boolean; name?: string }>;

vi.mock('recharts', () => {
  const container = ({ children }: MockChartProps) => <div data-testid="responsive-container">{children}</div>;
  const group = ({ children }: MockChartProps) => <div>{children}</div>;
  const primitive = () => <span />;
  const animated = ({ isAnimationActive, name }: MockChartProps) => (
    <span data-animation={String(isAnimationActive)} data-testid={`series-${name ?? 'unnamed'}`} />
  );
  return {
    ResponsiveContainer: container,
    BarChart: group,
    LineChart: group,
    PieChart: group,
    Pie: animated,
    Bar: animated,
    Line: animated,
    CartesianGrid: primitive,
    Cell: primitive,
    Legend: primitive,
    Tooltip: primitive,
    XAxis: primitive,
    YAxis: primitive,
  };
});

function responseFor(source: unknown = sourceJson) {
  return new Response(JSON.stringify(source), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

function mediaQuery(matches: boolean): MediaQueryList {
  return {
    matches,
    media: '(prefers-reduced-motion: reduce)',
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  };
}

describe('AnalyticsRoute', () => {
  beforeEach(() => {
    resetBoardStore();
    vi.stubGlobal('matchMedia', vi.fn(() => mediaQuery(false)));
  });

  it('renders four responsive charts with complete textual values from live board state', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(responseFor()));
    renderWithProviders(<AnalyticsRoute />);

    expect(screen.getByRole('status', { name: 'Loading analytics' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Sprint velocity' })).toBeInTheDocument();
    expect(screen.getAllByTestId('responsive-container')).toHaveLength(4);

    const velocity = screen.getByRole('heading', { name: 'Sprint velocity' }).closest('section');
    const status = screen.getByRole('heading', { name: 'Task status distribution' }).closest('section');
    const priority = screen.getByRole('heading', { name: 'Priority breakdown' }).closest('section');
    const trend = screen.getByRole('heading', { name: 'Completion trend' }).closest('section');
    if (!velocity || !status || !priority || !trend) throw new Error('Missing chart section');

    expect(within(velocity).getByText('Sprint 1').parentElement).toHaveTextContent('5');
    expect(within(velocity).getByText('Sprint 2').parentElement).toHaveTextContent('7');
    expect(within(velocity).getByText('Sprint 3').parentElement).toHaveTextContent('6');
    expect(within(status).getByText('Backlog').parentElement).toHaveTextContent('3');
    expect(within(status).getByText('In progress').parentElement).toHaveTextContent('5');
    expect(within(status).getByText('Review').parentElement).toHaveTextContent('4');
    expect(within(status).getByText('Done').parentElement).toHaveTextContent('18');
    expect(within(priority).getByRole('row', { name: /Total/ })).toHaveTextContent('Total13125');
    expect(within(trend).getByText('18 tasks completed across 14 recorded dates.')).toBeInTheDocument();
  });

  it('updates displayed chart summaries after a board mutation', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(responseFor());
    vi.stubGlobal('fetch', fetchMock);
    renderWithProviders(<AnalyticsRoute />);
    expect(await screen.findByRole('heading', { name: 'Task status distribution' })).toBeInTheDocument();

    act(() => { boardStore.getState().moveTask({ taskId: '2', toStatus: 'done', toIndex: 18 }); });
    const status = screen.getByRole('heading', { name: 'Task status distribution' }).closest('section');
    const velocity = screen.getByRole('heading', { name: 'Sprint velocity' }).closest('section');
    if (!status || !velocity) throw new Error('Missing chart section');
    expect(within(status).getByText('In progress').parentElement).toHaveTextContent('4');
    expect(within(status).getByText('Done').parentElement).toHaveTextContent('19');
    expect(within(velocity).getByText('Sprint 3').parentElement).toHaveTextContent('7');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('disables chart animation when reduced motion is requested', async () => {
    vi.stubGlobal('matchMedia', vi.fn(() => mediaQuery(true)));
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(responseFor()));
    renderWithProviders(<AnalyticsRoute />);
    expect(await screen.findByRole('heading', { name: 'Sprint velocity' })).toBeInTheDocument();

    screen.getAllByTestId(/^series-/).forEach((series) => expect(series).toHaveAttribute('data-animation', 'false'));
  });

  it('shows chart empty states for an empty initialized board', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(responseFor({ ...sourceJson, tasks: [], comments: [] })));
    renderWithProviders(<AnalyticsRoute />);

    expect(await screen.findByText('No completed sprint work is available yet.')).toBeInTheDocument();
    expect(screen.getByText('No board tasks are available to distribute.')).toBeInTheDocument();
    expect(screen.getByText('No task priorities are available yet.')).toBeInTheDocument();
    expect(screen.getByText('No completion dates have been recorded yet.')).toBeInTheDocument();
  });

  it('shows a descriptive error and retries through the shared query options', async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockRejectedValueOnce(new Error('Analytics network unavailable'))
      .mockResolvedValueOnce(responseFor());
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    renderWithProviders(<AnalyticsRoute />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Analytics network unavailable');
    await user.click(screen.getByRole('button', { name: 'Retry loading analytics' }));
    expect(await screen.findByRole('heading', { name: 'Sprint velocity' })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
