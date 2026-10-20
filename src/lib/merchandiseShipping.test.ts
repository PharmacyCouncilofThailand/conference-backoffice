import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  applyShipmentDrafts,
  fillCarrierForEmpty,
  parseShipmentPaste,
} from './merchandiseShipping';

describe('merchandiseShipping', () => {
  it('Review Focus 1: parses tab and comma separated lines, skips header/blanks, preserves leading zero trackingId', () => {
    const text =
      'เลขออเดอร์\tขนส่ง\tTracking\r\nPRIS2026-M-000001\tKerry\t00123\t\r\n\r\npris2026-m-000002 , Flash , TH999\r\n';
    const known = new Set(['PRIS2026-M-000001', 'PRIS2026-M-000002']);

    const res = parseShipmentPaste(text, known);
    assert.deepEqual(res, {
      rows: [
        {
          orderNumber: 'PRIS2026-M-000001',
          carrier: 'Kerry',
          trackingId: '00123',
        },
        {
          orderNumber: 'PRIS2026-M-000002',
          carrier: 'Flash',
          trackingId: 'TH999',
        },
      ],
      unknownOrders: [],
      incomplete: [],
      duplicates: [],
    });
  });

  it('ignores extra columns, classifies incomplete, unknown, and duplicate orders (last wins)', () => {
    const text = [
      'PRIS2026-M-000001\tKerry\t00111\textra-col',
      'PRIS2026-M-000002\tFlash\t',
      'PRIS2026-M-000099\tEMS\tTH00099',
      'PRIS2026-M-000001\tEMS\t00222',
    ].join('\n');
    const known = new Set(['PRIS2026-M-000001', 'PRIS2026-M-000002']);

    const res = parseShipmentPaste(text, known);
    assert.deepEqual(res.rows, [
      {
        orderNumber: 'PRIS2026-M-000001',
        carrier: 'EMS',
        trackingId: '00222',
      },
    ]);
    assert.deepEqual(res.incomplete, ['PRIS2026-M-000002']);
    assert.deepEqual(res.unknownOrders, ['PRIS2026-M-000099']);
    assert.deepEqual(res.duplicates, ['PRIS2026-M-000001']);
  });

  it('applyShipmentDrafts does not overwrite filled fields unless overwrite is true', () => {
    const current = {
      'PRIS2026-M-000001': { carrier: 'Kerry', trackingId: '' },
      'PRIS2026-M-000002': { carrier: '', trackingId: '' },
    };
    const drafts = [
      {
        orderNumber: 'PRIS2026-M-000001',
        carrier: 'Flash',
        trackingId: '00123',
      },
      { orderNumber: 'PRIS2026-M-000002', carrier: 'EMS', trackingId: 'TH999' },
    ];

    const withoutOverwrite = applyShipmentDrafts(current, drafts, false);
    assert.deepEqual(withoutOverwrite, {
      'PRIS2026-M-000001': { carrier: 'Kerry', trackingId: '00123' },
      'PRIS2026-M-000002': { carrier: 'EMS', trackingId: 'TH999' },
    });

    const withOverwrite = applyShipmentDrafts(current, drafts, true);
    assert.deepEqual(withOverwrite, {
      'PRIS2026-M-000001': { carrier: 'Flash', trackingId: '00123' },
      'PRIS2026-M-000002': { carrier: 'EMS', trackingId: 'TH999' },
    });
  });

  it('fillCarrierForEmpty sets carrier only where empty and never changes trackingId', () => {
    const current = {
      'PRIS2026-M-000001': { carrier: 'Kerry', trackingId: '00123' },
      'PRIS2026-M-000002': { carrier: '   ', trackingId: '00456' },
      'PRIS2026-M-000003': { carrier: '', trackingId: '' },
    };

    const next = fillCarrierForEmpty(current, 'ไปรษณีย์ไทย');
    assert.deepEqual(next, {
      'PRIS2026-M-000001': { carrier: 'Kerry', trackingId: '00123' },
      'PRIS2026-M-000002': { carrier: 'ไปรษณีย์ไทย', trackingId: '00456' },
      'PRIS2026-M-000003': { carrier: 'ไปรษณีย์ไทย', trackingId: '' },
    });
  });
});
