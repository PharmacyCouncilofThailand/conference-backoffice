import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiError } from './api';
import { healthHackFromError, healthHackOf } from './healthhack-checkin';

test('reads team and nickname from a HealthHack registration', () => {
  assert.deepEqual(
    healthHackOf({ healthHack: { teamName: 'Team A', nickname: 'Bee' } }),
    { teamName: 'Team A', nickname: 'Bee' },
  );
  assert.deepEqual(
    healthHackOf({ healthHack: { teamName: 'Team A', nickname: '' } }),
    { teamName: 'Team A', nickname: null },
  );
  assert.equal(healthHackOf({ healthHack: null }), null);
  assert.equal(healthHackOf({}), null);
  assert.equal(healthHackOf(null), null);
});

test('reads HealthHack team from a duplicate check-in error', () => {
  assert.deepEqual(
    healthHackFromError(
      new ApiError('duplicate', 409, 'ALREADY_CHECKED_IN', {
        registration: { healthHack: { teamName: 'Team A', nickname: null } },
      }),
    ),
    { teamName: 'Team A', nickname: null },
  );
  assert.equal(healthHackFromError(new Error('x')), null);
});
