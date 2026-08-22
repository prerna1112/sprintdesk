import { queryOptions } from '@tanstack/react-query';
import { parseAndAdaptMockData } from './mock-data.adapter';
import type { MockData } from '../domain/types';

export const mockDataQueryKey = ['mock-data'] as const;

export async function fetchMockData(
  fetchImplementation: typeof fetch = fetch,
): Promise<MockData> {
  const response = await fetchImplementation('/mock-data.json');

  if (!response.ok) {
    throw new Error(`Unable to load mock data (${response.status})`);
  }

  return parseAndAdaptMockData(await response.json());
}

export function mockDataQueryOptions() {
  return queryOptions({
    queryKey: mockDataQueryKey,
    queryFn: () => fetchMockData(),
    staleTime: Number.POSITIVE_INFINITY,
  });
}
