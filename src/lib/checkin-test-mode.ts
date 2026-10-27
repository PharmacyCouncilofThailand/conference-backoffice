// Scanner self-test: a QR or manual code "test" shows a simulated attendee so
// staff can rehearse the scan flow. Nothing is sent to the API or saved.

export const CHECKIN_TEST_CODE = 'TEST';
export const CHECKIN_TEST_NOTICE = 'โหมดทดสอบ: ไม่บันทึกข้อมูลจริง';

export function isCheckinTestCode(code: string): boolean {
  return code.trim().toUpperCase() === CHECKIN_TEST_CODE;
}

export function testRegistration(eventName?: string | null) {
  return {
    id: 0,
    regCode: CHECKIN_TEST_CODE,
    firstName: 'ผู้ทดสอบ',
    lastName: 'ระบบสแกน',
    email: 'test@example.invalid',
    ticketName: 'Test Ticket',
    eventName: eventName || 'ทดสอบระบบ',
    booth: null,
  };
}

export function testSessions() {
  return [
    {
      id: -1,
      sessionId: -1,
      sessionName: 'Session ทดสอบ 1',
      sessionType: 'main',
      ticketName: 'Test Ticket',
      checkedInAt: null,
    },
    {
      id: -2,
      sessionId: -2,
      sessionName: 'Session ทดสอบ 2',
      sessionType: 'workshop',
      ticketName: 'Test Ticket',
      checkedInAt: null,
    },
  ];
}
