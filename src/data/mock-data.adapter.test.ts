import { describe, expect, it } from 'vitest';
import sourceJson from '../../public/mock-data.json';
import { selectSprintVelocity } from '../domain/selectors';
import type { MockDataDTO } from './mock-data.dto';
import {
  adaptMockData,
  parseAndAdaptMockData,
  parseMockDataDTO,
} from './mock-data.adapter';

function sourceFixture(): MockDataDTO {
  return parseMockDataDTO(structuredClone(sourceJson));
}

describe('mock data adapter', () => {
  it('adapts every source collection without losing records', () => {
    const data = adaptMockData(sourceFixture());

    expect(data.users).toHaveLength(6);
    expect(data.sprints).toHaveLength(3);
    expect(data.tasks).toHaveLength(30);
    expect(data.comments).toHaveLength(5);
    expect(data.notifications).toHaveLength(4);
  });

  it('stringifies IDs and maps source-only field names', () => {
    const source = sourceFixture();
    const data = adaptMockData(source);
    const firstUser = data.users[0];
    const inProgressTask = data.tasks.find(({ status }) => status === 'inProgress');
    const firstComment = data.comments[0];

    expect(firstUser).toMatchObject({
      id: String(source.users[0]?.id),
      avatarUrl: source.users[0]?.avatar,
    });
    expect(firstUser).not.toHaveProperty('avatar');
    expect(inProgressTask?.id).toEqual(String(source.tasks[1]?.id));
    expect(firstComment).toMatchObject({
      id: String(source.comments[0]?.id),
      body: source.comments[0]?.message,
    });
    expect(firstComment).not.toHaveProperty('message');
  });

  it('maps notifications to the application contract', () => {
    const source = sourceFixture();
    const data = adaptMockData(source);

    source.notifications.forEach((notification, index) => {
      expect(data.notifications[index]).toMatchObject({
        id: `mock:${notification.id}`,
        source: 'mock',
        sourceId: `mock:${notification.id}`,
        body: notification.message,
        readAt: notification.read ? notification.createdAt : null,
      });
      expect(data.notifications[index]).not.toHaveProperty('message');
      expect(data.notifications[index]).not.toHaveProperty('type');
    });
  });

  it('builds columns in source array order and ignores the raw order field', () => {
    const source = sourceFixture();
    source.tasks.forEach((task, index) => {
      task.order = source.tasks.length - index;
    });

    const data = adaptMockData(source);

    expect(Object.fromEntries(
      Object.entries(data.columnTaskIds).map(([status, ids]) => [status, ids.length]),
    )).toEqual({ backlog: 3, inProgress: 5, review: 4, done: 18 });
    expect(data.columnTaskIds.inProgress).toEqual(
      source.tasks
        .filter(({ status }) => status === 'in-progress')
        .map(({ id }) => String(id)),
    );
  });

  it('adapts only the first 30 tasks and preserves their source ordering', () => {
    const source = sourceFixture();
    source.tasks.unshift({
      ...source.tasks[0]!,
      id: 31,
      order: 999,
    });

    const data = adaptMockData(source);
    const ingestedSourceTasks = source.tasks.slice(0, 30);

    expect(data.tasks).toHaveLength(30);
    expect(data.tasks.map(({ id }) => id)).toEqual(
      ingestedSourceTasks.map(({ id }) => String(id)),
    );
    expect(data.tasks.some(({ id }) => id === '30')).toBe(false);
    expect(data.columnTaskIds.done).toEqual(
      ingestedSourceTasks
        .filter(({ status }) => status === 'done')
        .map(({ id }) => String(id)),
    );
  });

  it('preserves valid task and comment references', () => {
    const data = adaptMockData(sourceFixture());
    const userIds = new Set(data.users.map(({ id }) => id));
    const sprintIds = new Set(data.sprints.map(({ id }) => id));
    const taskIds = new Set(data.tasks.map(({ id }) => id));

    expect(data.tasks.every((task) => (
      userIds.has(task.assigneeId) && sprintIds.has(task.sprintId)
    ))).toBe(true);
    expect(data.comments.every((comment) => (
      userIds.has(comment.authorId) && taskIds.has(comment.taskId)
    ))).toBe(true);
  });

  it('rejects a task with a missing user reference', () => {
    const source = sourceFixture();
    source.tasks[0]!.assigneeId = 999;

    expect(() => adaptMockData(source)).toThrow(
      'task 1 references missing user 999',
    );
  });

  it('rejects a comment with a missing task reference', () => {
    const source = sourceFixture();
    source.comments[0]!.taskId = 999;

    expect(() => adaptMockData(source)).toThrow(
      'comment 1 references missing task 999',
    );
  });

  it('rejects unsupported task priorities at the parsing boundary', () => {
    const source = structuredClone(sourceJson) as unknown as {
      tasks: Array<{ priority: string }>;
    };
    source.tasks[0]!.priority = 'urgent';

    expect(() => parseAndAdaptMockData(source)).toThrow(
      'task 1 has an unsupported priority',
    );
  });

  it.each([
    {
      field: 'sprint startDate',
      mutate: (source: typeof sourceJson) => {
        source.sprints[0]!.startDate = '2026-02-30';
      },
      error: 'sprint 1 startDate must be a valid ISO date string',
    },
    {
      field: 'task dueDate',
      mutate: (source: typeof sourceJson) => {
        source.tasks[0]!.dueDate = 'August 18, 2026';
      },
      error: 'task 1 dueDate must be a valid ISO date string',
    },
    {
      field: 'task completedAt',
      mutate: (source: typeof sourceJson) => {
        source.tasks[0]!.completedAt = 'not-a-date';
      },
      error: 'task 1 completedAt must be null or a valid ISO date string',
    },
    {
      field: 'comment createdAt',
      mutate: (source: typeof sourceJson) => {
        source.comments[0]!.createdAt = '2026-08-19T25:00:00Z';
      },
      error: 'comment 1 createdAt must be a valid ISO date string',
    },
    {
      field: 'notification createdAt',
      mutate: (source: typeof sourceJson) => {
        source.notifications[0]!.createdAt = '2026-13-19T11:10:00Z';
      },
      error: 'notification 101 createdAt must be a valid ISO date string',
    },
  ])('rejects an invalid $field', ({ mutate, error }) => {
    const source = structuredClone(sourceJson);
    mutate(source);

    expect(() => adaptMockData(source as MockDataDTO)).toThrow(error);
  });

  it('derives sprint velocity from completed tasks', () => {
    const velocity = selectSprintVelocity(adaptMockData(sourceFixture()));

    expect(velocity.map(({ completedTasks }) => completedTasks)).toEqual([5, 7, 6]);
  });
});
