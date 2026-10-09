import type { GrantOutcome, GrantTrackingItemDto, InvitationStatus, SessionGrantEmailStatus } from '../types/session-grants';

export const outcomeLabels: Record<GrantOutcome, string> = { added: 'เพิ่มสิทธิ์แล้ว', invited: 'สร้างคำเชิญแล้ว', skipped: 'ข้าม' };
export const invitationLabels: Record<InvitationStatus, string> = {
  pending: 'รอตอบรับ', accepted: 'ยืนยันเข้าร่วม', declined: 'ปฏิเสธ', expired: 'หมดเวลา', revoked: 'ใช้คำเชิญไม่ได้',
};
export const emailLabels: Record<SessionGrantEmailStatus, string> = {
  not_applicable: 'ไม่เกี่ยวข้อง', pending: 'รอส่ง', sending: 'กำลังส่ง', sent: 'ส่งแล้ว',
  failed: 'ส่งไม่สำเร็จ', unknown: 'ไม่ทราบผล', suppressed: 'ระงับการส่ง',
};

export function sessionGrantRetryDisabledReason(item: GrantTrackingItemDto, enabled: boolean): string | null {
  if (!enabled) return 'ระบบปิดการส่งอีเมลซ้ำ';
  if (item.outcome === 'skipped') return 'รายการนี้ถูกข้าม';
  if (item.emailStatus !== 'failed' && item.emailStatus !== 'unknown') return 'ส่งซ้ำได้เฉพาะเมลที่ส่งไม่สำเร็จหรือไม่ทราบผล';
  if (item.outcome === 'invited' && !item.invitation) return 'ไม่มีข้อมูลคำเชิญ';
  if (item.outcome === 'invited' && item.invitation?.invitationStatus !== 'pending') return 'คำเชิญไม่ได้อยู่ระหว่างรอตอบรับ';
  return null;
}
