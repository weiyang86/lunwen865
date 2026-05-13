import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildTaskBootstrapPayload } from './client-task-list-page';
import { resolveTaskIdFromQuery } from './client-task-topic-workspace-page';
import { getApiErrorMessage } from '@/lib/client/api-error';

test('Client task flow: buildTaskBootstrapPayload trims fields and omits empty schoolId', () => {
  const payload = buildTaskBootstrapPayload({
    title: '  题目A  ',
    major: '  工商管理 ',
    educationLevel: ' 本科 ',
    topic: ' 供应链金融研究 ',
    schoolId: '   ',
  });

  assert.deepEqual(payload, {
    title: '题目A',
    major: '工商管理',
    educationLevel: '本科',
    topic: '供应链金融研究',
  });
});

test('Client task flow: resolveTaskIdFromQuery decodes taskId safely', () => {
  const taskId = resolveTaskIdFromQuery('task%2F001');
  assert.equal(taskId, 'task/001');
  assert.equal(resolveTaskIdFromQuery(null), '');
});

test('Client task flow: getApiErrorMessage supports array message fallback', () => {
  const message = getApiErrorMessage({
    response: {
      data: {
        message: ['任务不存在', '请刷新后重试'],
      },
    },
  }, 'fallback');

  assert.equal(message, '任务不存在；请刷新后重试');
});
