const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown) => typeof value === 'string' && value.trim() ? value : '—';
const time = (value: unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Bangkok' }).format(new Date(value)) : '—';
const types: Record<string, string> = { poster: 'Poster', 'highlighted-poster': 'Highlighted Poster', oral: 'Oral' };
const states: Record<string, string> = { ready: 'พร้อมใช้งาน', alias_pending: 'รอรับรองรหัสเดิม', conflict: 'ข้อมูลขัดกัน', missing: 'ไม่พบในฐานข้อมูล', incomplete: 'ข้อมูลไม่ครบ', withdrawn: 'ถอนจากประกาศ' };
export const presentationProblemLabel = (value: string) => ({ NAME_MISMATCH: 'ชื่อผู้ส่งไม่ตรงกัน', TITLE_MISMATCH: 'ชื่อผลงานไม่ตรงกัน', TYPE_MISMATCH: 'ประเภทผลงานไม่ตรงกัน', OWNER_MISSING: 'ไม่พบเจ้าของผลงาน', EMAIL_INVALID: 'อีเมลผู้ส่งไม่ถูกต้อง', TRACKING_NOT_FOUND: 'ไม่พบรหัสผลงาน', TRACKING_AMBIGUOUS: 'รหัสตรงกับหลายผลงาน', SOURCE_INCOMPLETE: 'ข้อมูลประกาศไม่ครบ', SOURCE_DUPLICATE_ABSTRACT: 'หลายรายการประกาศอ้างถึงผลงานเดียวกัน', SOURCE_REMAP: 'รายการประกาศเปลี่ยนไปอ้างถึงผลงานอื่น ต้องตรวจสอบข้อมูล' }[value] ?? 'ข้อมูลต้องตรวจสอบเพิ่มเติม');

export function PresentationComparison({ value }: { value: unknown }) {
  const snapshot = record(value), announcement = record(snapshot.announcement), match = record(snapshot.match);
  const candidates = Array.isArray(snapshot.candidates) ? snapshot.candidates.map(record) : [];
  const work = (item: Record<string, unknown>, database = false) => <dl className="space-y-3 text-sm">{[
    ['Tracking ID', database ? item.canonicalTrackingId ?? item.trackingId : item.trackingId],
    ['ชื่อผลงาน', item.title], ['ผู้ส่ง', database ? item.submitterName ?? [item.firstName, item.lastName].filter(Boolean).join(' ') : item.submitterName],
    ['ประเภทผลงาน', types[String(item.presentationType)]], ['หมวดผลงาน', item.categoryName],
  ].map(([label, field]) => <div key={String(label)}><dt className="text-xs text-zinc-500">{String(label)}</dt><dd className="mt-1 whitespace-pre-wrap break-words">{text(field)}</dd></div>)}{database && Array.isArray(item.aliases) && item.aliases.length > 0 && <div><dt className="text-xs text-zinc-500">รหัสเดิมของผลงาน</dt><dd className="mt-1 break-words">{item.aliases.filter(alias => typeof alias === 'string').join(' · ')}</dd></div>}</dl>;
  return <div className="space-y-4"><div className="flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-800">{states[String(match.state)] ?? 'ผลตรวจรายชื่อ'}</span>{typeof match.via === 'string' && <span className="rounded-full bg-zinc-100 px-3 py-1 text-zinc-600">{match.via === 'alias' ? 'จับคู่ด้วยรหัสเดิม' : 'จับคู่ด้วยรหัสปัจจุบัน'}</span>}</div>{Array.isArray(match.problems) && match.problems.length > 0 && <ul className="space-y-1 text-sm text-amber-800">{match.problems.map((problem, index) => <li key={index}>{presentationProblemLabel(String(problem))}</li>)}</ul>}<div className="grid gap-4 md:grid-cols-2"><section className="rounded-lg border border-emerald-100 bg-emerald-50/40 p-4"><h3 className="mb-4 font-semibold text-emerald-900">ข้อมูลในประกาศ</h3>{work(announcement)}</section><div className="space-y-3">{candidates.length ? candidates.map((candidate, index) => <section key={index} className="max-h-96 overflow-auto rounded-lg border border-zinc-200 p-4"><h3 className="mb-4 font-semibold">ข้อมูลในฐานข้อมูล{candidates.length > 1 ? ` · ผลงานที่ ${index + 1}` : ''}</h3>{work(candidate, true)}</section>) : <p className="rounded-lg bg-zinc-50 p-4 text-sm text-zinc-500">ไม่พบผลงานในฐานข้อมูลที่ตรงกับรหัสประกาศ</p>}</div></div></div>;
}

export function PresentationEmailAttempts({ value }: { value: unknown }) {
  const attempts = Array.isArray(value) ? value.map(record) : [];
  const statuses: Record<string, string> = { sending: 'กำลังส่ง', sent: 'ผู้ให้บริการรับอีเมลแล้ว', failed: 'ส่งล้มเหลว', unknown: 'ไม่ทราบผลส่ง', suppressed: 'งดส่ง' };
  return <div className="space-y-4">{!attempts.length && <p className="text-zinc-500">ยังไม่มีความพยายามส่งอีเมล</p>}{attempts.map((attempt, index) => <article key={index} className="space-y-2 border-l-2 border-emerald-100 pl-4 text-sm"><h3 className="font-semibold">ครั้งที่ {index + 1} · {statuses[String(attempt.result ?? attempt.outcome)] ?? 'รอตรวจสอบผล'}</h3><p className="text-zinc-500">เริ่ม {time(attempt.started_at)} · จบ {time(attempt.finished_at)}</p>{typeof attempt.request_started_at === 'string' && <p>ติดต่อผู้ให้บริการ {time(attempt.request_started_at)}</p>}{typeof attempt.error_code === 'string' && <p className="text-amber-800">ผู้ให้บริการหรือระบบแจ้งข้อผิดพลาด กรุณาตรวจผลก่อนส่งซ้ำ</p>}</article>)}</div>;
}

export function PresentationDeadlineHistory({ value }: { value: unknown }) {
  const setting = record(value);
  return <p className="text-sm">กำหนดปิดรับ: {time(setting.closesAt ?? setting.closes_at)} (ไทย){typeof setting.version === 'number' ? ` · รุ่น ${setting.version}` : ''}</p>;
}
