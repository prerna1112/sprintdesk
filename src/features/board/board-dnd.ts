import type { ColumnTaskIds, TaskStatus } from '../../domain/types';
import { BOARD_STATUSES, type MoveTaskInput } from './board-store';

export const columnDropId = (status: TaskStatus) => `column:${status}`;

export function statusFromColumnDropId(id: string): TaskStatus | null {
  if (!id.startsWith('column:')) return null;
  const status = id.slice('column:'.length) as TaskStatus;
  return BOARD_STATUSES.includes(status) ? status : null;
}

export function calculateDragMove(
  activeTaskId: string,
  overId: string | null,
  columns: ColumnTaskIds,
): MoveTaskInput | null {
  if (!overId || activeTaskId === overId) return null;
  const sourceStatus = BOARD_STATUSES.find((status) => columns[status].includes(activeTaskId));
  if (!sourceStatus) return null;

  const columnStatus = statusFromColumnDropId(overId);
  if (columnStatus) {
    const alreadyLast = sourceStatus === columnStatus
      && columns[columnStatus].at(-1) === activeTaskId;
    return alreadyLast
      ? null
      : { taskId: activeTaskId, toStatus: columnStatus, toIndex: columns[columnStatus].length - (sourceStatus === columnStatus ? 1 : 0) };
  }

  const destinationStatus = BOARD_STATUSES.find((status) => columns[status].includes(overId));
  if (!destinationStatus) return null;
  const destinationIndex = columns[destinationStatus].indexOf(overId);
  return { taskId: activeTaskId, toStatus: destinationStatus, toIndex: destinationIndex };
}
