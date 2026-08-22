import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { mockDataQueryOptions } from '../../data/mock-data.service';
import { useBoardStore } from '../board';
import { selectCurrentSprint } from './selectors';

export function useWorkspaceBoard() {
  const query = useQuery(mockDataQueryOptions());
  const hasHydrated = useBoardStore((state) => state.hasHydrated);
  const initializedFromSource = useBoardStore((state) => state.initializedFromSource);
  const persistenceError = useBoardStore((state) => state.persistenceError);
  const initializeBoard = useBoardStore((state) => state.initializeBoard);

  useEffect(() => {
    if (!hasHydrated || !query.data) return;
    initializeBoard({
      tasks: query.data.tasks,
      comments: query.data.comments,
      currentSprintId: selectCurrentSprint(query.data.sprints)?.id,
      assigneeIds: query.data.users.map((user) => user.id),
    });
  }, [hasHydrated, initializeBoard, query.data]);

  return { query, hasHydrated, initializedFromSource, persistenceError };
}
