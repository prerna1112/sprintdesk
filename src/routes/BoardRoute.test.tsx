import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import sourceJson from '../../public/mock-data.json';
import { renderWithProviders } from '../test/render';
import { BOARD_PERSISTENCE_WARNING, boardStore, resetBoardStore } from '../features/board';
import BoardRoute from './BoardRoute';

function sourceResponse() {
  return new Response(JSON.stringify(sourceJson), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

describe('BoardRoute', () => {
  beforeEach(() => resetBoardStore());

  it('shows a loading skeleton then initializes all 30 tasks with expected counts', async () => {
    let resolveFetch!: (response: Response) => void;
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => { resolveFetch = resolve; })));
    renderWithProviders(<BoardRoute />);
    expect(screen.getByRole('status', { name: 'Loading board' })).toBeInTheDocument();
    resolveFetch(sourceResponse());
    expect(await screen.findByLabelText('3 tasks')).toBeInTheDocument();
    expect(screen.getByLabelText('5 tasks')).toBeInTheDocument();
    expect(screen.getByLabelText('4 tasks')).toBeInTheDocument();
    expect(screen.getByLabelText('18 tasks')).toBeInTheDocument();
  });

  it('shows a descriptive error and retries through the query layer', async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockRejectedValueOnce(new Error('Network unavailable'))
      .mockResolvedValueOnce(sourceResponse());
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    renderWithProviders(<BoardRoute />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Network unavailable');
    await user.click(screen.getByRole('button', { name: 'Retry loading board' }));
    expect(await screen.findByLabelText('18 tasks')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('warns accessibly when board changes are not durable', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(sourceResponse()));
    boardStore.setState({ persistenceError: BOARD_PERSISTENCE_WARNING });
    renderWithProviders(<BoardRoute />);
    expect(await screen.findByRole('status', { name: '' })).toHaveTextContent(BOARD_PERSISTENCE_WARNING);
  });
});
