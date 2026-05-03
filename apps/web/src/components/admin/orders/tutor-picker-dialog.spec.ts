import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildTutorPickerQuery, performTutorPick } from './tutor-picker-dialog';

test('TutorPicker: buildTutorPickerQuery 默认 role=TUTOR 且 pageSize=20', () => {
  const q = buildTutorPickerQuery({ search: '  alice  ' });
  assert.equal(q.role, 'TUTOR');
  assert.equal(q.page, 1);
  assert.equal(q.pageSize, 20);
  assert.equal(q.keyword, 'alice');
});

test('TutorPicker: buildTutorPickerQuery search 为空时不传 keyword', () => {
  const q = buildTutorPickerQuery({ search: '   ' });
  assert.equal(q.keyword, undefined);
});

test('TutorPicker: performTutorPick 触发 onPicked 且回传 id', async () => {
  const calls: string[] = [];
  await performTutorPick({
    tutorId: 't_1',
    onPicked: (t) => {
      calls.push(`picked:${t.id}`);
    },
  });
  assert.deepEqual(calls, ['picked:t_1']);
});
