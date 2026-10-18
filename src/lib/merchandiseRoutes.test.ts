import assert from 'node:assert/strict';
import test from 'node:test';
import { routeForEventSwitch } from './merchandiseRoutes';

test('switching event on a detail page goes to its list page', () => {
  assert.equal(
    routeForEventSwitch(
      '/merchandise/orders/0b6f1c2e-1111-4a2b-9c3d-123456789abc',
    ),
    '/merchandise/orders',
  );
  assert.equal(
    routeForEventSwitch('/merchandise/products/abc/'),
    '/merchandise/products',
  );
});

test('list and other pages keep their path', () => {
  assert.equal(
    routeForEventSwitch('/merchandise/orders'),
    '/merchandise/orders',
  );
  assert.equal(routeForEventSwitch('/merchandise'), '/merchandise');
  assert.equal(
    routeForEventSwitch('/merchandise/shipping'),
    '/merchandise/shipping',
  );
});
