import type {
  GrantTrackingItemDto,
  ResendInput,
} from '../types/session-grants';

export const attemptPurposeLabels = {
  initial: 'ส่งครั้งแรก',
  retry: 'ลองส่งใหม่หลังล้มเหลว',
  resend: 'ส่งคำเชิญซ้ำ',
};
export function resendDisabledReason(
  item: GrantTrackingItemDto,
  enabled: boolean,
  supported: boolean,
): string | null {
  if (!enabled || !supported) return 'ระบบยังไม่เปิดส่งคำเชิญซ้ำ';
  if (item.outcome !== 'invited' || !item.invitation)
    return 'ไม่ใช่รายการคำเชิญต้นฉบับ';
  if (item.invitation.invitationStatus !== 'pending')
    return 'คำเชิญไม่ได้รอตอบรับ';
  if (item.emailStatus === 'failed' || item.emailStatus === 'unknown')
    return 'ใช้ปุ่มลองส่งใหม่หลังล้มเหลว';
  if (item.emailStatus !== 'sent') return 'อีเมลยังไม่พร้อมส่งคำเชิญซ้ำ';
  if (item.resendEligible !== true)
    return item.resendDisabledReason || 'ข้อมูลสิทธิ์ส่งซ้ำยังไม่พร้อม';
  return null;
}
export interface ResendSelection {
  scope: string;
  rows: Map<string, GrantTrackingItemDto>;
}
export function selectResends(
  current: ResendSelection,
  scope: string,
  rows: GrantTrackingItemDto[],
  selected: boolean,
): ResendSelection {
  const next = new Map(current.scope === scope ? current.rows : []);
  for (const row of rows) {
    const id = row.invitation?.invitationId;
    if (!id) continue;
    if (!selected) next.delete(id);
    else if (next.size < 500 || next.has(id)) next.set(id, row);
  }
  return { scope, rows: next };
}
export interface PendingResend {
  key: string;
  input: ResendInput;
  requestId?: string;
}
export const resendStorageKey = (actorId: number, sessionId: number) =>
  `session-invitation-resend:${actorId}:${sessionId}`;
export function readPendingResend(
  storage: Pick<Storage, 'getItem'>,
  actorId: number,
  sessionId: number,
): PendingResend | null {
  const raw = storage.getItem(resendStorageKey(actorId, sessionId));
  if (!raw) return null;
  const value = JSON.parse(raw) as PendingResend;
  if (
    typeof value.key !== 'string' ||
    !value.key ||
    value.input?.sessionId !== sessionId ||
    !Array.isArray(value.input.invitationIds) ||
    !value.input.invitationIds.length ||
    value.input.invitationIds.length > 500 ||
    !value.input.invitationIds.every((id) => typeof id === 'string') ||
    (value.requestId !== undefined && typeof value.requestId !== 'string')
  )
    throw new Error('ข้อมูลคำขอที่บันทึกไว้ไม่ถูกต้อง');
  return value;
}
export function persistPendingResend(
  storage: Pick<Storage, 'setItem'>,
  actorId: number,
  pending: PendingResend,
): void {
  storage.setItem(
    resendStorageKey(actorId, pending.input.sessionId),
    JSON.stringify(pending),
  );
}
