import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, Skeleton } from '../components/ui';
import { mockDataQueryOptions } from '../data/mock-data.service';
import { Board, useBoardStore } from '../features/board';

export default function BoardRoute() {
  const query = useQuery(mockDataQueryOptions());
  const hasHydrated = useBoardStore((state) => state.hasHydrated);
  const initializedFromSource = useBoardStore((state) => state.initializedFromSource);
  const initializeBoard = useBoardStore((state) => state.initializeBoard);

  useEffect(() => {
    if (!hasHydrated || !query.data) return;
    const currentSprint = query.data.sprints.reduce((latest, sprint) =>
      !latest || sprint.startDate > latest.startDate ? sprint : latest, query.data.sprints[0]);
    initializeBoard({
      tasks: query.data.tasks,
      comments: query.data.comments,
      currentSprintId: currentSprint?.id,
      assigneeIds: query.data.users.map((user) => user.id),
    });
  }, [hasHydrated, initializeBoard, query.data]);

  if (query.isPending || !hasHydrated) {
    return (
      <div aria-busy="true" aria-label="Loading board" className="grid gap-6" role="status">
        <div className="flex justify-between"><div><h1 className="text-3xl font-black">Board</h1><Skeleton className="mt-2 h-4 w-64" /></div><Skeleton className="h-10 w-28" /></div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((item) => <Skeleton className="h-80" key={item} />)}</div>
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="rounded-2xl border bg-surface p-8 text-center" role="alert">
        <h1 className="text-3xl font-black">Board</h1>
        <h2 className="mt-5 text-xl font-black">The board could not be loaded</h2>
        <p className="mt-2 text-sm text-muted-foreground">{query.error instanceof Error ? query.error.message : 'Sprint data is unavailable.'}</p>
        <Button className="mt-5" onClick={() => void query.refetch()}>Retry loading board</Button>
      </div>
    );
  }

  if (!initializedFromSource) {
    return <div aria-busy="true" aria-label="Preparing board" role="status"><Skeleton className="h-96 w-full" /></div>;
  }

  return (
    <Board data={query.data} />
  );
}
