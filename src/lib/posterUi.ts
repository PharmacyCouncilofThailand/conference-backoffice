import type { PosterDetailDto, PosterListRow, RevisionDto } from '../types/posters';

export const canManagePosters = (role: string): boolean => role === 'admin';

// Inputs show the last permitted Thai second; the API stores an exclusive close.
export function thaiDeadlineInput(close: string): string {
  const date = new Date(Date.parse(close) - 1000);
  if (!Number.isFinite(date.getTime())) throw new Error('Invalid deadline');
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const get = (key: string) => parts.find(part => part.type === key)!.value;
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}`;
}

export function deadlineInputToClose(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(value)) throw new Error('Use Thai time with seconds');
  const date = new Date(value + '+07:00');
  if (!Number.isFinite(date.getTime())) throw new Error('Invalid deadline');
  const close = new Date(date.getTime() + 1000).toISOString();
  if (thaiDeadlineInput(close) !== value) throw new Error('Invalid calendar date');
  return close;
}

export const selectablePosterIds = (rows: PosterListRow[]): number[] =>
  [...new Set(rows.filter(row => row.canNotify && row.abstractId !== null).map(row => row.abstractId!))];

export function posterRouteId(value: string | string[] | null | undefined): number | null {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id <= 2147483647 ? id : null;
}

// Request statuses already reflect the server clock; never expire rights with the browser clock.
export const activePosterRequest = (requests: RevisionDto[]): RevisionDto | null =>
  requests.find(request => request.status === 'open') ?? null;

export function canResendPosterJob(job: PosterDetailDto['emailJobs'][number], detail: PosterDetailDto): boolean {
  if (job.state === 'pending' || job.state === 'sending') return false;
  if (job.kind === 'revision') return detail.requests.some(request => request.id === job.requestId && request.status === 'open');
  if (job.kind === 'initial' || job.kind === 'reminder') return detail.row.canNotify;
  return job.kind === 'receipt' && detail.uploads.some(upload => upload.id === job.uploadId);
}

export function isPosterActionAudit(value: unknown): boolean {
  return !!value && typeof value === 'object' && 'action' in value
    && ['revision_created', 'revision_cancelled'].includes(String(value.action));
}

export function posterAuditSummary(value: unknown) {
  const object = (item: unknown): Record<string, unknown> => item && typeof item === 'object' && !Array.isArray(item) ? item as Record<string, unknown> : {};
  const text = (item: unknown) => typeof item === 'string' && item.trim() ? item : null;
  const audit = object(value), before = object(audit.before_state), after = object(audit.after_state);
  const actions: Record<string, string> = { match_changed: 'ตรวจข้อมูลประกาศ', source_withdrawn: 'ถอนจากรายชื่อประกาศ', alias_verified: 'รับรองรหัสเดิม', revision_created: 'สร้างคำขอแก้ไข', revision_cancelled: 'ยกเลิกคำขอแก้ไข' };
  const statuses: Record<string, string> = { ready: 'ข้อมูลตรงกัน', alias_pending: 'รอรับรองรหัสเดิม', conflict: 'ข้อมูลไม่ตรงกัน', missing: 'ไม่พบผลงาน', incomplete: 'ข้อมูลไม่ครบ', open: 'เปิดรับฉบับแก้ไข', submitted: 'รับฉบับแก้ไขแล้ว', cancelled: 'ยกเลิกแล้ว', expired: 'หมดเวลา' };
  const state = (snapshot: Record<string, unknown>) => text(object(snapshot.match).state) ?? text(snapshot.status) ?? text(object(snapshot.request).status);
  const oldState = state(before), newState = state(after);
  const problemLabels: Record<string, string> = { NAME_MISMATCH: 'ชื่อผู้ส่งไม่ตรงกัน', TITLE_MISMATCH: 'ชื่อผลงานไม่ตรงกัน', TYPE_MISMATCH: 'ประเภทผลงานไม่ตรงกัน', OWNER_MISSING: 'ไม่พบเจ้าของผลงาน', EMAIL_INVALID: 'อีเมลไม่ถูกต้อง', TRACKING_NOT_FOUND: 'ไม่พบรหัสผลงาน', TRACKING_AMBIGUOUS: 'รหัสตรงกับหลายผลงาน', SOURCE_INCOMPLETE: 'ข้อมูลประกาศไม่ครบ' };
  const fields = (snapshot: Record<string, unknown>) => {
    const announcement = object(snapshot.announcement), candidate = object(Array.isArray(snapshot.candidates) ? snapshot.candidates[0] : null);
    const request = snapshot.request ? object(snapshot.request) : snapshot;
    const type = (value: unknown) => ({ poster: 'Poster', 'highlighted-poster': 'Highlighted Poster', oral: 'Oral' }[text(value) ?? ''] ?? null);
    const problems = object(snapshot.match).problems;
    return {
      'รหัสในประกาศ': text(announcement.trackingId), 'ชื่อผลงานในประกาศ': text(announcement.title), 'ผู้ส่งในประกาศ': text(announcement.submitterName), 'ประเภทในประกาศ': type(announcement.presentationType),
      'รหัสในฐานข้อมูล': text(candidate.canonicalTrackingId), 'ชื่อผลงานในฐานข้อมูล': text(candidate.title), 'ผู้ส่งในฐานข้อมูล': [text(candidate.firstName), text(candidate.lastName)].filter(Boolean).join(' ') || null, 'ประเภทในฐานข้อมูล': type(candidate.presentationType),
      'ผลตรวจ / สถานะคำขอ': statuses[state(snapshot) ?? ''] ?? null,
      'ปัญหาที่พบ': Array.isArray(problems) ? problems.map(problem => problemLabels[String(problem)] ?? 'ข้อมูลต้องตรวจสอบเพิ่มเติม').join(' · ') || 'ไม่พบปัญหา' : null,
      'รายละเอียดที่ให้แก้ไข': text(request.details), 'ปิดรับฉบับแก้ไข': text(request.closesAt) ?? text(request.closes_at), 'เหตุผลที่ยกเลิก': text(request.cancellationReason) ?? text(request.cancellation_reason),
      'อยู่ในรายชื่อประกาศ': typeof snapshot.present === 'boolean' ? snapshot.present ? 'อยู่ในรายชื่อ' : 'ถอนจากรายชื่อแล้ว' : null,
    };
  };
  const oldFields = fields(before), newFields = fields(after);
  const changes = (Object.keys(newFields) as Array<keyof typeof newFields>).filter(label => oldFields[label] !== newFields[label]).map(label => ({ label, before: oldFields[label], after: newFields[label], date: label === 'ปิดรับฉบับแก้ไข' }));
  const createdAt = text(audit.created_at);
  return {
    action: actions[text(audit.action) ?? ''] ?? 'อัปเดตข้อมูล Poster',
    createdAt: createdAt && Number.isFinite(Date.parse(createdAt)) ? createdAt : null,
    actor: typeof audit.actor_id === 'number' ? `ผู้ดูแล #${audit.actor_id}` : 'ระบบ',
    reason: text(audit.reason),
    change: newState && newState !== oldState ? `${oldState ? `${statuses[oldState] ?? oldState} → ` : ''}${statuses[newState] ?? newState}` : null,
    closesAt: text(object(after.request).closesAt) ?? text(object(after.request).closes_at),
    changes,
  };
}
