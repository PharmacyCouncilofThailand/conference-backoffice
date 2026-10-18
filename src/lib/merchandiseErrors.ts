import { ApiError } from './api';
import { publishIssueLabel } from './merchandiseFormat';

const ERROR_MESSAGES: Record<string, string> = {
  MERCH_VERSION_CONFLICT:
    'ข้อมูลถูกแก้ไขโดยผู้ใช้อื่น กรุณาโหลดข้อมูลล่าสุดแล้วลองอีกครั้ง',
  MERCH_PUBLISH_INCOMPLETE: 'ข้อมูลสินค้ายังไม่ครบสำหรับการเผยแพร่',
  MERCH_ORDER_HAS_ACTIVE_QR:
    'แก้ไขไม่ได้ขณะมี QR ที่ยังชำระได้ หรือ QR เพิ่งหมดอายุไม่ถึง 2 นาที',
  MERCH_PAID_TOTAL_MUST_MATCH: 'ออเดอร์ที่ชำระแล้วต้องมียอดรวมเท่าเดิม',
  MERCH_CONTACT_REQUIRED: 'กรุณายืนยันว่าติดต่อผู้ซื้อแล้ว และบันทึกการติดต่อ',
  MERCH_ORDER_NOT_PAID: 'บันทึกการจัดส่งได้เฉพาะออเดอร์ที่ชำระแล้ว',
  MERCH_REASON_REQUIRED: 'กรุณาระบุเหตุผล',
  MERCH_ORDER_EMPTY: 'คำสั่งซื้อต้องมีสินค้าอย่างน้อย 1 รายการ',
  MERCH_ORDER_TOO_LARGE: 'ยอดรวมเกินที่ระบบรองรับ',
  MERCH_VARIANT_SHAPE_MIXED:
    'ตัวเลือกต้องเป็นแบบไม่มีไซซ์/สีทั้งหมด หรือมีไซซ์/สีทุกตัวเลือก',
  MERCH_VARIANT_DUPLICATE: 'มีตัวเลือกไซซ์หรือสีซ้ำกัน',
  MERCH_VARIANT_IN_BUNDLE: 'ตัวเลือกนี้ถูกใช้ใน Bundle อยู่ ให้ปิดขายแทนการลบ',
  MERCH_COMPONENT_INVALID: 'ข้อมูลส่วนประกอบ Bundle ไม่ถูกต้อง',
  MERCH_IMAGE_INVALID: 'รูปภาพไม่ถูกต้องหรือไม่ได้อยู่ในงานนี้',
  MERCH_CATEGORY_INVALID: 'หมวดสินค้าไม่ถูกต้อง',
  MERCH_STORE_WINDOW_INVALID: 'เวลาเปิดพรีออเดอร์ต้องอยู่ก่อนเวลาปิด',
  MERCH_ORDER_INVALID: 'ลำดับรายการไม่ถูกต้อง กรุณาโหลดข้อมูลใหม่',
  MERCH_NOTIFICATION_NOT_RESENDABLE:
    'ส่งอีเมลซ้ำได้เฉพาะรายการที่ส่งไม่สำเร็จหรือไม่ทราบผล',
  MERCH_REVIEW_ALREADY_RESOLVED: 'รายการนี้ถูกปิดเรื่องไปแล้ว',
  MERCH_PAYMENT_CHECK_FAILED: 'เชื่อมต่อระบบชำระเงินไม่สำเร็จ กรุณาลองอีกครั้ง',
  IMAGE_INVALID: 'ไฟล์รูปไม่ถูกต้อง รองรับ JPG PNG WebP',
  IMAGE_TOO_LARGE: 'รูปมีขนาดเกิน 5 MB',
  MERCH_RATE_LIMITED: 'เรียกใช้งานถี่เกินไป กรุณารอสักครู่',
};

export function merchErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code && ERROR_MESSAGES[error.code]) {
      return ERROR_MESSAGES[error.code];
    }
    return error.message || 'เกิดข้อผิดพลาด กรุณาลองอีกครั้ง';
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return 'เกิดข้อผิดพลาด กรุณาลองอีกครั้ง';
}

export function publishIssuesFromError(error: unknown): string[] {
  if (
    !(error instanceof ApiError) ||
    error.code !== 'MERCH_PUBLISH_INCOMPLETE'
  ) {
    return [];
  }
  const details = error.details as { issues?: unknown } | undefined;
  if (!details || !Array.isArray(details.issues)) {
    return [];
  }
  return details.issues
    .filter((issue): issue is string => typeof issue === 'string')
    .map((issue) => publishIssueLabel[issue] ?? issue);
}

export function isVersionConflict(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'MERCH_VERSION_CONFLICT';
}
