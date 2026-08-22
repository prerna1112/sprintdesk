import { describe, expect, it, vi } from 'vitest';
import sourceJson from '../../public/mock-data.json';
import { fetchMockData } from './mock-data.service';

describe('mock data service', () => {
  it('loads and adapts data through the dedicated endpoint', async () => {
    const fetchImplementation = vi.fn<typeof fetch>(async () => (
      new Response(JSON.stringify(sourceJson), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    ));

    const data = await fetchMockData(fetchImplementation);

    expect(fetchImplementation).toHaveBeenCalledWith('/mock-data.json');
    expect(data.tasks).toHaveLength(30);
    expect(data.tasks.some(({ status }) => status === 'inProgress')).toBe(true);
  });

  it('reports an HTTP failure before attempting adaptation', async () => {
    const fetchImplementation = vi.fn<typeof fetch>(async () => (
      new Response(null, { status: 503 })
    ));

    await expect(fetchMockData(fetchImplementation)).rejects.toThrow(
      'Unable to load mock data (503)',
    );
  });
});
