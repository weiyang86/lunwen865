import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { OrderStatusBadge } from './OrderStatusBadge';
import { StageBadge } from './StageBadge';

test('OrderStatusBadge snapshot', () => {
  const html = renderToStaticMarkup(
    React.createElement(OrderStatusBadge, { status: 'in_progress' }),
  );
  assert.ok(html.includes('进行中'));
  assert.ok(html.includes('bg-blue-100'));
});

test('StageBadge snapshot', () => {
  const html = renderToStaticMarkup(
    React.createElement(StageBadge, { stage: 'TOPIC' }),
  );
  assert.ok(html.includes('题目'));
});
