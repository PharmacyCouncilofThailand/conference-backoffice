import type { BoothMemberReport, DailyAttendanceValue } from '../types/booths';
export const boothEligibilityLabel = (x: boolean | null) =>
  x === true
    ? 'มีสิทธิ์รับคูปองอาหาร'
    : x === false
      ? 'ไม่ได้รับสิทธิ์คูปองอาหาร (ครบโควตา)'
      : 'ยังไม่ได้รับตั๋วตามเงื่อนไขคูปอง';
export const dailyAttendanceLabel: Record<DailyAttendanceValue, string> = {
  checked_in: 'เช็กอินแล้ว',
  not_checked_in: 'ยังไม่เช็กอิน',
  no_ticket: 'ยังไม่มีตั๋ว',
  no_access: 'ไม่มีสิทธิ์ Session',
};
export const boothTicketDate = (x: string | null) =>
  x === null
    ? ''
    : new Intl.DateTimeFormat('th-TH', {
        timeZone: 'Asia/Bangkok',
        dateStyle: 'short',
        timeStyle: 'medium',
      }).format(new Date(x));
export function boothExcelHeaders(report: BoothMemberReport): string[] {
  const multiple = new Set(report.columns.map((x) => x.sessionId)).size > 1;
  return [
    'ชื่อ-นามสกุล',
    'อีเมล',
    'เบอร์โทร',
    'วันที่รับตั๋ว',
    'สิทธิ์คูปองอาหาร',
    ...report.columns.map((x) =>
      multiple
        ? `Check-in ${x.date} · ${x.sessionName} #${x.sessionId}`
        : `Check-in ${x.date}`,
    ),
  ];
}
export function buildBoothExcelRows(
  report: BoothMemberReport,
): Record<string, string>[] {
  const headers = boothExcelHeaders(report);
  return report.members.map((m) => {
    const values = [
      `${m.firstName} ${m.lastName}`.trim(),
      m.email,
      m.phone ?? '',
      boothTicketDate(m.firstTicketConfirmedAt),
      boothEligibilityLabel(m.mealCouponEligible),
      ...report.columns.map((c) => {
        const state = m.attendanceByDate[c.key];
        if (!Object.hasOwn(dailyAttendanceLabel, state))
          throw new Error('ข้อมูลเช็กอินรายวันไม่ครบถ้วน');
        return dailyAttendanceLabel[state];
      }),
    ];
    return Object.fromEntries(headers.map((h, i) => [h, values[i]]));
  });
}
