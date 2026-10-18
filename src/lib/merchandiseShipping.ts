export type ShipmentDraft = {
  orderNumber: string;
  carrier: string;
  trackingId: string;
};

const ORDER_NUMBER_REGEX = /^[A-Z0-9]+-M-\d{6}$/;

export function parseShipmentPaste(
  text: string,
  known: Set<string>,
): {
  rows: ShipmentDraft[];
  unknownOrders: string[];
  incomplete: string[];
  duplicates: string[];
} {
  const byOrder = new Map<string, ShipmentDraft>();
  const unknownOrders: string[] = [];
  const incomplete: string[] = [];
  const duplicates: string[] = [];

  const lines = text.split(/\r?\n/);
  for (const rawLine of lines) {
    if (!rawLine.trim()) continue;
    const separator = rawLine.includes('\t') ? '\t' : ',';
    const cells = rawLine.split(separator).map((c) => c.trim());
    const orderNumber = (cells[0] ?? '').toUpperCase();

    if (!ORDER_NUMBER_REGEX.test(orderNumber)) {
      continue;
    }

    const carrier = cells[1] ?? '';
    const trackingId = cells[2] ?? '';

    if (!carrier || !trackingId) {
      if (!incomplete.includes(orderNumber)) {
        incomplete.push(orderNumber);
      }
      continue;
    }

    if (!known.has(orderNumber)) {
      if (!unknownOrders.includes(orderNumber)) {
        unknownOrders.push(orderNumber);
      }
      continue;
    }

    if (byOrder.has(orderNumber) && !duplicates.includes(orderNumber)) {
      duplicates.push(orderNumber);
    }

    byOrder.set(orderNumber, {
      orderNumber,
      carrier,
      trackingId,
    });
  }

  return {
    rows: Array.from(byOrder.values()),
    unknownOrders,
    incomplete,
    duplicates,
  };
}

export function applyShipmentDrafts(
  current: Record<string, { carrier: string; trackingId: string }>,
  drafts: ShipmentDraft[],
  overwrite: boolean,
): Record<string, { carrier: string; trackingId: string }> {
  const next: Record<string, { carrier: string; trackingId: string }> = {};
  for (const [k, v] of Object.entries(current)) {
    next[k] = { carrier: v.carrier, trackingId: v.trackingId };
  }

  for (const draft of drafts) {
    const prev = next[draft.orderNumber] ?? { carrier: '', trackingId: '' };
    if (overwrite) {
      next[draft.orderNumber] = {
        carrier: draft.carrier,
        trackingId: draft.trackingId,
      };
    } else {
      next[draft.orderNumber] = {
        carrier: prev.carrier.trim() ? prev.carrier : draft.carrier,
        trackingId: prev.trackingId.trim() ? prev.trackingId : draft.trackingId,
      };
    }
  }

  return next;
}

export function fillCarrierForEmpty(
  current: Record<string, { carrier: string; trackingId: string }>,
  carrier: string,
): Record<string, { carrier: string; trackingId: string }> {
  const trimmed = carrier.trim();
  const next: Record<string, { carrier: string; trackingId: string }> = {};

  for (const [k, v] of Object.entries(current)) {
    next[k] = {
      carrier: v.carrier.trim() ? v.carrier : trimmed,
      trackingId: v.trackingId,
    };
  }

  return next;
}
