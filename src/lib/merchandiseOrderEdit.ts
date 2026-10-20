import type {
  AdminOrderDetail,
  OrderEditInput,
  Recipient,
} from '@/types/merchandise';

export type EditLine =
  | {
      kind: 'source';
      sourceItemId: string;
      quantity: number;
      unitPriceBaht: number;
    }
  | {
      kind: 'new';
      productId: string;
      variantId: string | null;
      bundleSelections: { componentId: string; variantId: string }[];
      quantity: number;
      unitPriceBaht: number | null;
    };

export const SHIPPING_FEE_BAHT = 50;

/**
 * Products an admin can add to an existing order: published, on sale and
 * otherwise purchasable. A closed store does not block admin edits, so
 * STORE_NOT_OPEN is the only unavailable reason ignored (as the API does).
 */
export function isAddableProduct(product: {
  publishState: 'draft' | 'published';
  saleEnabled: boolean;
  unavailableCodes: string[];
}): boolean {
  return (
    product.publishState === 'published' &&
    product.saleEnabled &&
    product.unavailableCodes.every((code) => code === 'STORE_NOT_OPEN')
  );
}

export function computeEditedTotal(
  lines: EditLine[],
): { subtotalBaht: number; totalBaht: number } | null {
  let subtotalBaht = 0;
  for (const line of lines) {
    if (line.quantity <= 0) continue;
    if (line.kind === 'new') {
      if (line.unitPriceBaht === null) return null;
      subtotalBaht += line.unitPriceBaht * line.quantity;
    } else {
      subtotalBaht += line.unitPriceBaht * line.quantity;
    }
  }
  return {
    subtotalBaht,
    totalBaht: subtotalBaht + SHIPPING_FEE_BAHT,
  };
}

/**
 * Strips spaces, dashes and parentheses, maps `+66` to `0`;
 * a Thai phone number is then 9–10 digits starting with 0.
 */
export function normalizePhone(raw: string): string | null {
  let value = raw.replace(/[\s\-()]/g, '');
  if (value.startsWith('+66')) {
    value = `0${value.slice(3)}`;
  }
  return /^0\d{8,9}$/.test(value) ? value : null;
}

function normalizeOptional(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeRecipient(
  r: Recipient,
): { recipient: Recipient } | { error: string } {
  const fullName = r.fullName.trim();
  const addressLine = r.addressLine.trim();
  const subdistrict = r.subdistrict.trim();
  const district = r.district.trim();
  const province = r.province.trim();
  const postalCode = r.postalCode.trim();
  const company = normalizeOptional(r.company);
  const deliveryNote = normalizeOptional(r.deliveryNote);

  if (!fullName || fullName.length > 200) {
    return { error: 'กรุณาระบุชื่อ–นามสกุลผู้รับ (1–200 ตัวอักษร)' };
  }
  const phone = normalizePhone(r.phone);
  if (!phone) {
    return { error: 'เบอร์โทรไม่ถูกต้อง' };
  }
  if (!addressLine || addressLine.length > 500) {
    return { error: 'กรุณาระบุที่อยู่ผู้รับ (1–500 ตัวอักษร)' };
  }
  if (!subdistrict || subdistrict.length > 100) {
    return { error: 'กรุณาระบุตำบล/แขวง (1–100 ตัวอักษร)' };
  }
  if (!district || district.length > 100) {
    return { error: 'กรุณาระบุอำเภอ/เขต (1–100 ตัวอักษร)' };
  }
  if (!province || province.length > 100) {
    return { error: 'กรุณาระบุจังหวัด (1–100 ตัวอักษร)' };
  }
  if (!/^\d{5}$/.test(postalCode)) {
    return { error: 'รหัสไปรษณีย์ต้องเป็นตัวเลข 5 หลัก' };
  }
  if (company && company.length > 200) {
    return { error: 'ชื่อบริษัทต้องไม่เกิน 200 ตัวอักษร' };
  }
  if (deliveryNote && deliveryNote.length > 500) {
    return { error: 'หมายเหตุจัดส่งต้องไม่เกิน 500 ตัวอักษร' };
  }

  return {
    recipient: {
      fullName,
      phone,
      addressLine,
      subdistrict,
      district,
      province,
      postalCode,
      company,
      deliveryNote,
    },
  };
}

function isSameRecipient(a: Recipient, b: Recipient): boolean {
  const aPhone = normalizePhone(a.phone) ?? a.phone.trim();
  const bPhone = normalizePhone(b.phone) ?? b.phone.trim();
  return (
    a.fullName.trim() === b.fullName.trim() &&
    aPhone === bPhone &&
    a.addressLine.trim() === b.addressLine.trim() &&
    a.subdistrict.trim() === b.subdistrict.trim() &&
    a.district.trim() === b.district.trim() &&
    a.province.trim() === b.province.trim() &&
    a.postalCode.trim() === b.postalCode.trim() &&
    normalizeOptional(a.company) === normalizeOptional(b.company) &&
    normalizeOptional(a.deliveryNote) === normalizeOptional(b.deliveryNote)
  );
}

export function buildOrderEditPayload(
  order: AdminOrderDetail,
  draft: {
    recipient: Recipient;
    lines: EditLine[];
    reason: string;
    contactConfirmed: boolean;
    contactNote: string;
  },
): { payload: OrderEditInput } | { error: string } {
  const normalizedRec = normalizeRecipient(draft.recipient);
  if ('error' in normalizedRec) {
    return normalizedRec;
  }

  for (const line of draft.lines) {
    if (
      !Number.isInteger(line.quantity) ||
      line.quantity < 0 ||
      line.quantity > 9999
    ) {
      return { error: 'จำนวนสินค้าไม่ถูกต้อง (0–9999)' };
    }
  }

  const activeLines = draft.lines.filter((l) => l.quantity > 0);
  if (activeLines.length === 0) {
    return { error: 'คำสั่งซื้อต้องมีสินค้าอย่างน้อย 1 รายการ' };
  }

  for (const line of activeLines) {
    if (line.kind === 'new') {
      if (!line.productId || line.unitPriceBaht === null) {
        return { error: 'กรุณาเลือกตัวเลือกสินค้าให้ครบถ้วน' };
      }
    }
  }

  const recipientChanged = !isSameRecipient(
    order.recipient,
    normalizedRec.recipient,
  );

  const linesChanged =
    activeLines.length !== order.items.length ||
    activeLines.some((line, index) => {
      if (line.kind === 'new') return true;
      const orig = order.items[index];
      return (
        !orig ||
        line.sourceItemId !== orig.id ||
        line.quantity !== orig.quantity
      );
    });

  if (!recipientChanged && !linesChanged) {
    return { error: 'ไม่มีการเปลี่ยนแปลง' };
  }

  const reason = draft.reason.trim();
  if (!reason) {
    return { error: 'กรุณาระบุเหตุผล' };
  }
  if (reason.length > 1000) {
    return { error: 'เหตุผลต้องไม่เกิน 1,000 ตัวอักษร' };
  }

  const isPaid =
    order.paymentStatus === 'paid' || order.payment.state === 'paid';
  if (isPaid) {
    const totals = computeEditedTotal(draft.lines);
    if (!totals || totals.totalBaht !== order.amounts.totalBaht) {
      return { error: 'ออเดอร์ที่ชำระแล้วต้องมียอดรวมเท่าเดิม' };
    }
    const contactNote = draft.contactNote.trim();
    if (!draft.contactConfirmed || !contactNote) {
      return { error: 'กรุณายืนยันว่าติดต่อผู้ซื้อแล้ว และบันทึกการติดต่อ' };
    }
    if (contactNote.length > 1000) {
      return { error: 'บันทึกการติดต่อต้องไม่เกิน 1,000 ตัวอักษร' };
    }
  }

  const payload: OrderEditInput = {
    expectedVersion: order.version,
    reason,
  };

  if (isPaid) {
    payload.contactConfirmed = true;
    payload.contactNote = draft.contactNote.trim();
  }

  if (recipientChanged) {
    payload.recipient = normalizedRec.recipient;
  }

  if (linesChanged) {
    payload.lines = activeLines.map((line) => {
      if (line.kind === 'source') {
        return {
          sourceItemId: line.sourceItemId,
          quantity: line.quantity,
        };
      }
      return {
        productId: line.productId,
        variantId: line.variantId,
        bundleSelections: line.bundleSelections,
        quantity: line.quantity,
      };
    });
  }

  return { payload };
}
