import { describe, expect, it } from 'vitest';
import type { ColumnTaskIds } from '../../domain/types';
import {
  calculateDragMove,
  columnDropId,
  resolveDragEndTarget,
  statusFromColumnDropId,
  updateRetainedKeyboardTarget,
} from './board-dnd';

const columns: ColumnTaskIds = {
  backlog: ['a', 'b', 'c'], inProgress: ['d', 'e'], review: [], done: ['f'],
};

describe('board drag calculation', () => {
  it('calculates same-column reorder', () => {
    expect(calculateDragMove('a', 'c', columns)).toEqual({ taskId: 'a', toStatus: 'backlog', toIndex: 2 });
    expect(calculateDragMove('c', 'a', columns)).toEqual({ taskId: 'c', toStatus: 'backlog', toIndex: 0 });
  });

  it('calculates cross-column insertion and empty-column drops', () => {
    expect(calculateDragMove('a', 'e', columns)).toEqual({ taskId: 'a', toStatus: 'inProgress', toIndex: 1 });
    expect(calculateDragMove('a', columnDropId('inProgress'), columns)).toEqual({ taskId: 'a', toStatus: 'inProgress', toIndex: 2 });
    expect(calculateDragMove('a', columnDropId('review'), columns)).toEqual({ taskId: 'a', toStatus: 'review', toIndex: 0 });
    expect(calculateDragMove('d', columnDropId('done'), columns)).toEqual({ taskId: 'd', toStatus: 'done', toIndex: 1 });
  });

  it('returns no mutation for cancelled, invalid, and no-op drops', () => {
    expect(calculateDragMove('a', null, columns)).toBeNull();
    expect(calculateDragMove('missing', 'b', columns)).toBeNull();
    expect(calculateDragMove('a', 'unknown', columns)).toBeNull();
    expect(calculateDragMove('a', 'a', columns)).toBeNull();
    expect(calculateDragMove('c', columnDropId('backlog'), columns)).toBeNull();
    expect(statusFromColumnDropId('column:wat')).toBeNull();
  });

  it('retains a keyboard target across a null end event until the active target is reported', () => {
    const movedTarget = updateRetainedKeyboardTarget('a', 'c', null);
    expect(resolveDragEndTarget('a', null, movedTarget, true)).toBe('c');
    expect(resolveDragEndTarget('a', 'a', movedTarget, true)).toBe('c');

    const returnedToActive = updateRetainedKeyboardTarget('a', 'a', movedTarget);
    expect(returnedToActive).toBeNull();
    expect(resolveDragEndTarget('a', 'a', returnedToActive, true)).toBeNull();
    expect(resolveDragEndTarget('a', null, returnedToActive, true)).toBeNull();
  });

  it('does not apply the retained keyboard target to pointer drops', () => {
    expect(resolveDragEndTarget('a', 'a', 'c', false)).toBeNull();
    expect(resolveDragEndTarget('a', null, 'c', false)).toBeNull();
  });
});
