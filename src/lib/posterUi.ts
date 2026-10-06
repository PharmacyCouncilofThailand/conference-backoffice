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
