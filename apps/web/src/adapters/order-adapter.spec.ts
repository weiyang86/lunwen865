import { test } from 'node:test';
import assert from 'node:assert/strict';

import { adaptToThesisOrder, mapOrderStatus } from './order-adapter';

test('adaptToThesisOrder: thesis 为 null 时保持为 null', () => {
  const o = adaptToThesisOrder({
    id: 'o_1',
    orderNo: 'NO_1',
    status: 'PENDING_PAYMENT',
    totalAmount: 10000,
    payAmount: 0,
    discount: 0,
    createdAt: '2026-05-01T00:00:00.000Z',
    paidAt: null,
    user: { id: 'u_1', phone: '13800000000', nickname: '张三' },
    _count: { items: 1 },
    thesis: null,
    currentStage: null,
    dueDate: null,
    primaryTutorId: null,
    taskId: null,
  });

  assert.equal(o.thesis, null);
  assert.equal(o.currentStage, null);
  assert.equal(o.status, 'pending_deposit');
  assert.equal(o.payment.totalCents, 10000);
});

test('adaptToThesisOrder: thesis 存在时透传关键字段', () => {
  const o = adaptToThesisOrder({
    id: 'o_2',
    orderNo: 'NO_2',
    status: 'FULFILLING',
    totalAmount: 20000,
    payAmount: 20000,
    discount: 1000,
    createdAt: '2026-05-01T00:00:00.000Z',
    paidAt: '2026-05-01T00:01:00.000Z',
    user: { id: 'u_2', phone: null, nickname: null },
    _count: { items: 2 },
    thesis: { title: '论文题目', educationLevel: 'master', major: 'CS' },
    currentStage: 'OUTLINE',
    dueDate: '2026-06-30T00:00:00.000Z',
    primaryTutorId: 't_123456789',
    taskId: null,
  });

  assert.equal(o.thesis?.title, '论文题目');
  assert.equal(o.currentStage, 'OUTLINE');
  assert.equal(o.primaryTutorId, 't_123456789');
  assert.equal(o.status, 'in_progress');
});

test('adaptToThesisOrder: task 关联字段透传（taskId/currentStage/dueDate）', () => {
  const o = adaptToThesisOrder({
    id: 'o_3',
    orderNo: 'NO_3',
    status: 'PAID',
    totalAmount: 30000,
    payAmount: 30000,
    discount: 0,
    createdAt: '2026-05-01T00:00:00.000Z',
    paidAt: '2026-05-01T00:01:00.000Z',
    user: { id: 'u_3', phone: null, nickname: null },
    _count: { items: 1 },
    thesis: { title: '已关联', educationLevel: 'MASTER' },
    currentStage: 'REVIEW',
    dueDate: '2026-05-10T00:00:00.000Z',
    primaryTutorId: null,
    taskId: 't_3',
  });

  assert.equal(o.taskId, 't_3');
  assert.equal(o.currentStage, 'REVIEW');
  assert.equal(o.dueDate, '2026-05-10T00:00:00.000Z');
});

test('adaptToThesisOrder: taskId 存在但 thesis 为 null 时不崩', () => {
  const o = adaptToThesisOrder({
    id: 'o_4',
    orderNo: 'NO_4',
    status: 'PAID',
    totalAmount: 100,
    payAmount: 100,
    discount: 0,
    createdAt: '2026-05-01T00:00:00.000Z',
    paidAt: '2026-05-01T00:01:00.000Z',
    user: { id: 'u_4', phone: null, nickname: null },
    _count: { items: 1 },
    thesis: null,
    currentStage: null,
    dueDate: null,
    primaryTutorId: null,
    taskId: 't_4',
  });

  assert.equal(o.taskId, 't_4');
  assert.equal(o.thesis, null);
});

test('mapOrderStatus: 未知 status 兜底为 in_progress 且 warn', () => {
  const prev = console.warn;
  let called = false;
  console.warn = () => {
    called = true;
  };
  try {
    const s = mapOrderStatus('UNKNOWN_STATUS');
    assert.equal(s, 'in_progress');
    assert.equal(called, true);
  } finally {
    console.warn = prev;
  }
});
