import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { AdminOrderDetail } from '@/types/merchandise';
import {
  buildOrderEditPayload,
  computeEditedTotal,
  isAddableProduct,
  normalizePhone,
  type EditLine,
} from './merchandiseOrderEdit';

function makeOrder(
  overrides: Partial<AdminOrderDetail> = {},
): AdminOrderDetail {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    orderNumber: 'PRIS2026-M-000001',
    createdAt: '2026-10-18T10:00:00.000Z',
    paymentStatus: 'pending',
    paidAt: null,
    shipping: {
      status: 'not_shipped',
      carrier: null,
      trackingId: null,
      shippedAt: null,
    },
    amounts: {
      subtotalBaht: 500,
      shippingBaht: 50,
      totalBaht: 550,
      currency: 'THB',
    },
    buyer: {
      name: 'สมชาย ใจดี',
      email: 'somchai@example.com',
      phone: '0812345678',
    },
    recipient: {
      fullName: 'สมชาย ใจดี',
      phone: '0812345678',
      addressLine: '123 ถนนสุขุมวิท',
      subdistrict: 'คลองเตย',
      district: 'คลองเตย',
      province: 'กรุงเทพมหานคร',
      postalCode: '10110',
      company: null,
      deliveryNote: null,
    },
    items: [
      {
        id: '22222222-2222-4222-8222-222222222222',
        kind: 'single',
        nameTh: 'เสื้อโปโล',
        sizeTh: 'M',
        colorTh: 'กรมท่า',
        quantity: 2,
        unitPriceBaht: 250,
        lineTotalBaht: 500,
        components: [],
      },
    ],
    productionInfoTh: null,
    shippingInfoTh: null,
    payment: {
      state: 'awaiting_qr',
      attempt: null,
      canRequestNewQr: true,
      canCheck: false,
      retryAfterSeconds: null,
      serverNow: '2026-10-18T10:05:00.000Z',
    },
    version: 3,
    attempts: [],
    notifications: [],
    audit: [],
    ...overrides,
  };
}

describe('merchandiseOrderEdit', () => {
  it('computes edited total keeping source price, removing 0 qty, adding new lines, +50 shipping', () => {
    const lines: EditLine[] = [
      {
        kind: 'source',
        sourceItemId: '22222222-2222-4222-8222-222222222222',
        quantity: 1,
        unitPriceBaht: 250,
      },
      {
        kind: 'source',
        sourceItemId: '33333333-3333-4333-8333-333333333333',
        quantity: 0,
        unitPriceBaht: 999,
      },
      {
        kind: 'new',
        productId: '44444444-4444-4444-8444-444444444444',
        variantId: '55555555-5555-4555-8555-555555555555',
        bundleSelections: [],
        quantity: 2,
        unitPriceBaht: 300,
      },
    ];
    assert.deepEqual(computeEditedTotal(lines), {
      subtotalBaht: 850,
      totalBaht: 900,
    });

    assert.equal(
      computeEditedTotal([
        ...lines,
        {
          kind: 'new',
          productId: '66666666-6666-4666-8666-666666666666',
          variantId: null,
          bundleSelections: [],
          quantity: 1,
          unitPriceBaht: null,
        },
      ]),
      null,
    );
  });

  it('normalizes Thai phone numbers like the API', () => {
    assert.equal(normalizePhone('081-234-5678'), '0812345678');
    assert.equal(normalizePhone('+66 81 234 5678'), '0812345678');
    assert.equal(normalizePhone('(02) 123-4567'), '021234567');
    assert.equal(normalizePhone('12345'), null);
  });

  it('sends recipient only when only recipient changed', () => {
    const order = makeOrder();
    const res = buildOrderEditPayload(order, {
      recipient: {
        ...order.recipient,
        fullName: 'สมหญิง ใจดี',
        phone: '081-234-5678',
      },
      lines: [
        {
          kind: 'source',
          sourceItemId: order.items[0].id,
          quantity: order.items[0].quantity,
          unitPriceBaht: order.items[0].unitPriceBaht,
        },
      ],
      reason: 'แก้ชื่อผู้รับตามที่แจ้ง',
      contactConfirmed: false,
      contactNote: '',
    });

    assert.ok('payload' in res);
    assert.equal(res.payload.expectedVersion, 3);
    assert.equal(res.payload.reason, 'แก้ชื่อผู้รับตามที่แจ้ง');
    assert.equal(res.payload.recipient?.fullName, 'สมหญิง ใจดี');
    assert.equal(res.payload.recipient?.phone, '0812345678');
    assert.equal(res.payload.lines, undefined);
  });

  it('Review Focus 4: rejects when all source lines are set to 0 and no new lines exist', () => {
    const order = makeOrder();
    const res = buildOrderEditPayload(order, {
      recipient: { ...order.recipient },
      lines: [
        {
          kind: 'source',
          sourceItemId: order.items[0].id,
          quantity: 0,
          unitPriceBaht: order.items[0].unitPriceBaht,
        },
      ],
      reason: 'ลบสินค้าออก',
      contactConfirmed: false,
      contactNote: '',
    });

    assert.deepEqual(res, {
      error: 'คำสั่งซื้อต้องมีสินค้าอย่างน้อย 1 รายการ',
    });
  });

  it('enforces paid order contact confirmation and matching total', () => {
    const order = makeOrder({
      paymentStatus: 'paid',
      paidAt: '2026-10-18T11:00:00.000Z',
      payment: {
        ...makeOrder().payment,
        state: 'paid',
      },
    });

    // Contact missing
    const missingContact = buildOrderEditPayload(order, {
      recipient: { ...order.recipient, addressLine: '999 ถนนพระราม 4' },
      lines: [
        {
          kind: 'source',
          sourceItemId: order.items[0].id,
          quantity: 2,
          unitPriceBaht: 250,
        },
      ],
      reason: 'เปลี่ยนที่อยู่จัดส่ง',
      contactConfirmed: false,
      contactNote: '',
    });
    assert.deepEqual(missingContact, {
      error: 'กรุณายืนยันว่าติดต่อผู้ซื้อแล้ว และบันทึกการติดต่อ',
    });

    // Total changed on paid order
    const totalChanged = buildOrderEditPayload(order, {
      recipient: { ...order.recipient },
      lines: [
        {
          kind: 'source',
          sourceItemId: order.items[0].id,
          quantity: 1,
          unitPriceBaht: 250,
        },
      ],
      reason: 'ลดจำนวน',
      contactConfirmed: true,
      contactNote: 'โทรคุยวันที่ 18/10/2026',
    });
    assert.deepEqual(totalChanged, {
      error: 'ออเดอร์ที่ชำระแล้วต้องมียอดรวมเท่าเดิม',
    });

    // Same total with contact confirmed
    const validPaid = buildOrderEditPayload(order, {
      recipient: { ...order.recipient },
      lines: [
        {
          kind: 'source',
          sourceItemId: order.items[0].id,
          quantity: 1,
          unitPriceBaht: 250,
        },
        {
          kind: 'new',
          productId: '44444444-4444-4444-8444-444444444444',
          variantId: '55555555-5555-4555-8555-555555555555',
          bundleSelections: [],
          quantity: 1,
          unitPriceBaht: 250,
        },
      ],
      reason: 'เปลี่ยนไซซ์ 1 ตัวจาก M เป็น L',
      contactConfirmed: true,
      contactNote: 'โทรยืนยันกับลูกค้าแล้ว 18/10/2026',
    });
    assert.ok('payload' in validPaid);
    assert.equal(validPaid.payload.contactConfirmed, true);
    assert.equal(
      validPaid.payload.contactNote,
      'โทรยืนยันกับลูกค้าแล้ว 18/10/2026',
    );
    assert.equal(validPaid.payload.recipient, undefined);
    assert.deepEqual(validPaid.payload.lines, [
      { sourceItemId: order.items[0].id, quantity: 1 },
      {
        productId: '44444444-4444-4444-8444-444444444444',
        variantId: '55555555-5555-4555-8555-555555555555',
        bundleSelections: [],
        quantity: 1,
      },
    ]);
  });

  it('rejects when nothing changed, reason is empty, phone invalid, or postal code invalid', () => {
    const order = makeOrder();
    const baseLines: EditLine[] = [
      {
        kind: 'source',
        sourceItemId: order.items[0].id,
        quantity: order.items[0].quantity,
        unitPriceBaht: order.items[0].unitPriceBaht,
      },
    ];

    assert.deepEqual(
      buildOrderEditPayload(order, {
        recipient: { ...order.recipient },
        lines: baseLines,
        reason: 'ไม่มีอะไรเปลี่ยน',
        contactConfirmed: false,
        contactNote: '',
      }),
      { error: 'ไม่มีการเปลี่ยนแปลง' },
    );

    assert.deepEqual(
      buildOrderEditPayload(order, {
        recipient: { ...order.recipient, fullName: 'เปลี่ยนชื่อ' },
        lines: baseLines,
        reason: '   ',
        contactConfirmed: false,
        contactNote: '',
      }),
      { error: 'กรุณาระบุเหตุผล' },
    );

    assert.deepEqual(
      buildOrderEditPayload(order, {
        recipient: { ...order.recipient, phone: '1234' },
        lines: baseLines,
        reason: 'แก้เบอร์',
        contactConfirmed: false,
        contactNote: '',
      }),
      { error: 'เบอร์โทรไม่ถูกต้อง' },
    );

    assert.deepEqual(
      buildOrderEditPayload(order, {
        recipient: { ...order.recipient, postalCode: '1011A' },
        lines: baseLines,
        reason: 'แก้รหัสไปรษณีย์',
        contactConfirmed: false,
        contactNote: '',
      }),
      { error: 'รหัสไปรษณีย์ต้องเป็นตัวเลข 5 หลัก' },
    );
  });
});

describe('isAddableProduct', () => {
  const base = {
    publishState: 'published' as const,
    saleEnabled: true,
    unavailableCodes: [] as string[],
  };
  it('accepts a published, on-sale product even when the store is closed', () => {
    assert.equal(isAddableProduct(base), true);
    assert.equal(
      isAddableProduct({ ...base, unavailableCodes: ['STORE_NOT_OPEN'] }),
      true,
    );
  });
  it('rejects drafts, products off sale and bundles with unavailable parts', () => {
    assert.equal(isAddableProduct({ ...base, publishState: 'draft' }), false);
    assert.equal(isAddableProduct({ ...base, saleEnabled: false }), false);
    assert.equal(
      isAddableProduct({
        ...base,
        unavailableCodes: ['STORE_NOT_OPEN', 'COMPONENT_UNAVAILABLE'],
      }),
      false,
    );
  });
});
