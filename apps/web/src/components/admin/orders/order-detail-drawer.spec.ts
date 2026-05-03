import { test } from 'node:test';
import assert from 'node:assert/strict';

import { DEFAULT_ORDER_DETAIL_TAB, shouldFetchTaskDetail } from './order-detail-drawer';

test('OrderDetailDrawer: 默认 Tab 为概览', () => {
  assert.equal(DEFAULT_ORDER_DETAIL_TAB, 'overview');
});

test('OrderDetailDrawer: 仅在切到论文进度 Tab 且 taskId 存在时才触发 task 详情请求', () => {
  assert.equal(
    shouldFetchTaskDetail({
      open: true,
      tab: 'overview',
      taskId: 't_1',
      hasTaskDetail: false,
      taskDetailLoading: false,
    }),
    false,
  );

  assert.equal(
    shouldFetchTaskDetail({
      open: true,
      tab: 'progress',
      taskId: null,
      hasTaskDetail: false,
      taskDetailLoading: false,
    }),
    false,
  );

  assert.equal(
    shouldFetchTaskDetail({
      open: true,
      tab: 'progress',
      taskId: 't_1',
      hasTaskDetail: false,
      taskDetailLoading: false,
    }),
    true,
  );
});

