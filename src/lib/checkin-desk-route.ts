// Which scanner a selected session opens: the PRIS desk serves only the
// PRIS 2026 main session; every other session keeps the regular scanner.

export const PRIS_EVENT_CODE = 'PRIS-2026';

export function usesPrisDesk(
  summary: { eventCode: string; mainSession: { id: number } } | null,
  sessionId: number,
): boolean {
  return (
    summary?.eventCode === PRIS_EVENT_CODE &&
    summary.mainSession.id === sessionId
  );
}
