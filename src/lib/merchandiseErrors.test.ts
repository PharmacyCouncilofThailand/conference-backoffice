import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiError } from './api';
import {
  isVersionConflict,
  merchErrorMessage,
  publishIssuesFromError,
} from './merchandiseErrors';

test('merchErrorMessage maps known codes and preserves unknown error messages', () => {
  const conflict = new ApiError('x', 409, 'MERCH_VERSION_CONFLICT');
  assert.ok(
    merchErrorMessage(conflict).includes('ข้อมูลถูกแก้ไขโดยผู้ใช้อื่น'),
  );
  assert.equal(isVersionConflict(conflict), true);

  const unknown = new ApiError('boom', 500, 'SOMETHING');
  assert.equal(merchErrorMessage(unknown), 'boom');
  assert.equal(isVersionConflict(unknown), false);

  assert.equal(merchErrorMessage('x'), 'เกิดข้อผิดพลาด กรุณาลองอีกครั้ง');
});

test('publishIssuesFromError extracts and translates publish issues', () => {
  const err = new ApiError('x', 422, 'MERCH_PUBLISH_INCOMPLETE', {
    issues: ['NAME_REQUIRED', 'IMAGE_REQUIRED'],
  });
  assert.deepEqual(publishIssuesFromError(err), [
    'ต้องมีชื่อ',
    'ต้องมีรูปอย่างน้อย 1 รูป',
  ]);
  assert.deepEqual(publishIssuesFromError(new ApiError('x', 400, 'OTHER')), []);
});
