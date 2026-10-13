import assert from 'node:assert/strict';
import test from 'node:test';
import * as XLSX from 'xlsx';
import { buildBoothExcelRows, boothExcelHeaders } from './boothExcel';
import type { BoothMemberReport } from '../types/booths';
test('Excel keeps every member, phone zeroes, text cells and separate daily sessions', () => {
  const columns = [
    {
      key: '2026-10-14:1',
      date: '2026-10-14',
      sessionId: 1,
      sessionName: 'Main',
    },
    {
      key: '2026-10-15:1',
      date: '2026-10-15',
      sessionId: 1,
      sessionName: 'Main',
    },
    {
      key: '2026-10-15:2',
      date: '2026-10-15',
      sessionId: 2,
      sessionName: 'Other',
    },
  ];
  const report = {
    columns,
    members: Array.from({ length: 1001 }, (_, id) => ({
      id,
      firstName: '=1+1',
      lastName: 'Test',
      email: 'test@example.test',
      phone: '0812345678',
      firstTicketConfirmedAt: null,
      mealCouponEligible: true,
      attendanceByDate: {
        '2026-10-14:1': 'checked_in',
        '2026-10-15:1': 'not_checked_in',
        '2026-10-15:2': 'no_access',
      },
    })),
  } as unknown as BoothMemberReport;
  const rows = buildBoothExcelRows(report);
  assert.equal(rows.length, 1001);
  assert.equal(rows[0]['เบอร์โทร'], '0812345678');
  assert.equal(Object.keys(rows[0]).length, 8);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(rows, { header: boothExcelHeaders(report) }),
    'Booth',
  );
  const parsed = XLSX.read(
    XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }),
    { type: 'buffer' },
  ).Sheets.Booth;
  assert.equal(parsed.A2.t, 's');
  assert.equal(parsed.A2.f, undefined);
  assert.equal(parsed.C2.v, '0812345678');
  report.members[0].attendanceByDate = {};
  assert.throws(() => buildBoothExcelRows(report), /ไม่ครบถ้วน/);
});
