import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildTaskPickerQuery, performOrderTaskLink } from './task-picker-dialog';

test('TaskPicker: buildTaskPickerQuery 传入正确 userId 且默认 limit=20', () => {
  const q = buildTaskPickerQuery({
    orderUserId: 'u_1',
    search: '  thesis  ',
    unlinkedOnly: true,
  });

  assert.equal(q.userId, 'u_1');
  assert.equal(q.search, 'thesis');
  assert.equal(q.unlinkedOnly, true);
  assert.equal(q.limit, 20);
});

test('TaskPicker: buildTaskPickerQuery search 为空时不传 search', () => {
  const q = buildTaskPickerQuery({
    orderUserId: 'u_1',
    search: '   ',
    unlinkedOnly: false,
  });

  assert.equal(q.userId, 'u_1');
  assert.equal(q.search, undefined);
  assert.equal(q.unlinkedOnly, false);
});

test('TaskPicker: performOrderTaskLink 点击任务后调用 link-task 并触发 onLinked', async () => {
  const calls: string[] = [];
  await performOrderTaskLink({
    orderId: 'o_1',
    taskId: 't_1',
    link: async (orderId, taskId) => {
      calls.push(`link:${orderId}:${taskId}`);
      return { ok: true };
    },
    onLinked: (taskId) => {
      calls.push(`linked:${taskId}`);
    },
  });

  assert.deepEqual(calls, ['link:o_1:t_1', 'linked:t_1']);
});

