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

  it('uses stable prefixed notification IDs and maps read state to readAt', () => {
    const source = sourceFixture();
    const data = adaptMockData(source);

    source.notifications.forEach((notification, index) => {
      expect(data.notifications[index]).toMatchObject({
        id: `mock:${notification.id}`,
        sourceId: `mock:${notification.id}`,
        readAt: notification.read ? notification.createdAt : null,
      });
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

  it('derives sprint velocity from completed tasks', () => {
    const velocity = selectSprintVelocity(adaptMockData(sourceFixture()));

    expect(velocity.map(({ completedTasks }) => completedTasks)).toEqual([5, 7, 6]);
  });
});
