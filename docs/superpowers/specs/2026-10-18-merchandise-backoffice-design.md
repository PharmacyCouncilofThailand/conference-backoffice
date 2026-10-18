# Merchandise Preorder — Backoffice Design (conference-backoffice)

- **วันที่:** 18 ตุลาคม 2026
- **Branch:** `feat/merchandise-preorder` (สร้างจาก `origin/main` `d7ba6ab`; ไม่แก้ `main`)
- **ขอบเขต:** หน้า Admin ของร้านของที่ระลึกใน conference-backoffice เท่านั้น
- **อ้างอิง:**
  - API spec: `conference-api/docs/superpowers/specs/2026-10-16-merchandise-api-design.md` (เงินเป็น **บาทเต็ม** หลังรอบปรับ `...Baht`)
  - DTO จริง: `conference-api/src/modules/merchandise/types.ts` บน branch `feat/merchandise-preorder`
  - Admin routes จริง: `routes.admin.catalog.ts`, `routes.admin.orders.ts`
  - หน้าเดิมที่ใช้เป็นแบบ: `src/components/booths/BoothAdmin.tsx`, `src/app/team-registrations/[id]/page.tsx`, `src/app/lucky-wheel/page.tsx`
  - เวอร์ชันเก่าบน branch `backup/merchandise-preorder-2026-10-16` ใช้เป็นข้อมูลอ้างอิงโครงหน้าเท่านั้น ไม่ยกโค้ด

---

## 1. เป้าหมาย

Admin จัดการร้าน Preorder ได้ครบตามข้อกำหนด 33 ข้อ (ข้อ 4, 7, 9–11, 17, 26–30) ผ่าน Backoffice โดย:

1. หน้าตา layout และ component เหมือนหน้าอื่นที่มีอยู่ (`AdminLayout`, `card`, `btn-*`, `input-field`, `data-table`, `badge-*`, `modal-overlay`, `Pagination`) ข้อความเป็นภาษาไทยแบบหน้า Booths
2. ใช้ API ที่ทำเสร็จแล้วโดยตรง ไม่สร้าง logic ธุรกิจซ้ำฝั่ง client (ราคา สถานะ การตรวจยอดอยู่ที่ server; client คำนวณเพื่อแสดงผลล่วงหน้าเท่านั้น)
3. ทุกการแก้ไขกันการเขียนทับกันด้วย `expectedVersion` และแจ้งผู้ใช้ชัดเจนเมื่อชนกัน

## 2. การตัดสินใจ

| เรื่อง | ข้อสรุป |
|---|---|
| โครงเมนู (Q1) | เมนูเดียว "ของที่ระลึก" ใน Sidebar → route แยกต่อ tab ใต้ `/merchandise/*` มีส่วนหัวร่วม (เลือก Event + สถานะร้าน + แถบ tab) |
| Event (Q2) | dropdown ทุก Event แบบหน้า Booths; ถ้าไม่มี `eventId` ใน URL ให้เลือก Event ที่ `eventCode = 'PRIS-2026'` ไว้ก่อน (ถ้ามี) |
| ภาพรวม (Q3) | มีหน้าภาพรวม: สถานะร้าน + ตัวเลขสรุป + ทางลัด |
| จัดส่ง Bulk (Q4) | ตารางกรอกทีละแถว + วางข้อมูลจาก Excel (เลขออเดอร์ / ขนส่ง / Tracking) |
| แก้ออเดอร์ (Q5) | เต็มตาม API: ผู้รับ + เพิ่ม/ลบรายการ + เปลี่ยนจำนวน + เลือกสินค้าและตัวเลือก |
| Preview (Q6) | Backoffice แสดงเองจาก `/preview/store` และ `/preview/products/:id` พร้อมป้าย "ตัวอย่างโดยประมาณ" |
| ไซซ์/สี (Q7) | เลือกชนิดตัวเลือกก่อน แล้วสร้างตารางทุกคู่ให้ติ๊กเปิดขายและใส่ราคาแต่ละช่อง |
| โฟลเดอร์ค้าง (Q8) | ลบ `packages/merchandise-storefront-view` (ไม่อยู่ใน git) เป็นขั้นแรกของ implementation |
| ทดสอบ (Q9) | unit test logic ล้วนด้วย `npx tsx --test` (วิธีเดียวกับ test เดิมใน `src/lib`) + checklist ทดสอบมือกับ API local |
| สิทธิ์ | เฉพาะ role `admin` (เมนูซ่อนสำหรับ role อื่น; หน้าแสดง "หน้านี้สำหรับ Admin เท่านั้น" แบบ Booths) |
| Excel | ดาวน์โหลดไฟล์ที่ server สร้าง (`/orders/export.xlsx`, `/production/export.xlsx`) ไม่สร้างฝั่ง client |
| เงิน | บาทเต็ม (integer) แสดงแบบ `1,250 บาท` ด้วย `Intl.NumberFormat('th-TH')` ช่องกรอกราคารับเฉพาะจำนวนเต็ม ≥ 0 |
| เวลา | แสดงเป็นเวลาไทย (`Asia/Bangkok`, รูปแบบ `16 ต.ค. 2569 14:30`) ช่องกรอกวันเวลาเป็นเวลาไทยและส่งเป็น ISO มี `+07:00` |

## 3. API dependency ที่ต้องเพิ่ม (conference-api)

แถวในรายการออเดอร์ (`GET /orders` → `AdminOrderRow`) **ไม่มี `version`** แต่ `POST /orders/shipments/bulk` ต้องส่ง `expectedVersion` ทุกแถว

**ข้อสรุป:** เพิ่มฟิลด์ `version: number` ใน `AdminOrderRow` ที่ conference-api (`admin-orders.ts` → `queryAdminOrders`) บน branch `feat/merchandise-preorder` เป็นการเพิ่มฟิลด์ ไม่กระทบผู้ใช้เดิม พร้อม test ว่าแถวมี `version` ตรงกับรายละเอียดออเดอร์ งานนี้เป็น Task แรกของ plan

ข้อสังเกตอื่น (ไม่ต้องแก้ API):
- `ProductDto` ใน preview ไม่มีสถานะร่าง → หน้า Preview นำไปเทียบกับ `GET /products` (มี `publishState`) เพื่อติดป้าย "ฉบับร่าง"
- conference-api มี 7 commit เรื่องบาทเต็มที่ยังไม่ push; Backoffice อิง contract แบบบาท ต้อง push ก่อน merge ทั้งคู่

## 4. เส้นทางและเมนู

Sidebar: เพิ่มรายการ `{ type: 'link', href: '/merchandise', label: 'ของที่ระลึก', icon: IconShoppingBag }` ในหมวด `EVENT MANAGEMENT` ต่อจาก Sponsor Hub; ในส่วนกรองเมนูตาม role ให้แสดงเฉพาะ `admin` (แบบเดียวกับ Sponsor Hub) และ active เมื่อ `pathname.startsWith('/merchandise')`

| Route | หน้า | Tab |
|---|---|---|
| `/merchandise` | ภาพรวม | ภาพรวม |
| `/merchandise/store` | ตั้งค่าร้าน | ตั้งค่าร้าน |
| `/merchandise/products` | รายการสินค้า | สินค้า |
| `/merchandise/products/[productId]` | แก้ไขสินค้า | สินค้า |
| `/merchandise/categories` | หมวดสินค้า | หมวดสินค้า |
| `/merchandise/banners` | แบนเนอร์ | แบนเนอร์ |
| `/merchandise/preview` | ดูตัวอย่างหน้าร้าน | ดูตัวอย่าง |
| `/merchandise/orders` | คำสั่งซื้อ | คำสั่งซื้อ |
| `/merchandise/orders/[orderId]` | รายละเอียดคำสั่งซื้อ | คำสั่งซื้อ |
| `/merchandise/shipping` | จัดส่งแบบ Bulk | จัดส่ง |
| `/merchandise/reviews` | รายการรอตรวจสอบ | รอตรวจสอบ |
| `/merchandise/production` | ยอดผลิต | ยอดผลิต |

ทุก route รับ `?eventId=<id>`; ลิงก์ภายในทุกจุดพก `eventId` ต่อไปด้วย (helper `merchHref(path, eventId)`)

## 5. โครงร่วม

### 5.1 `MerchandiseShell` (`src/components/merchandise/MerchandiseShell.tsx`)

ครอบทุกหน้าใน `src/app/merchandise/layout.tsx` (client component) ภายใน `AdminLayout title="ของที่ระลึก"`:

1. **ตรวจสิทธิ์:** ไม่ใช่ admin → `<p role="alert">หน้านี้สำหรับ Admin เท่านั้น</p>`
2. **แถวบน (card):** dropdown Event (`api.backofficeEvents.list(token, 'limit=100')` แบบ Booths) + badge สถานะร้าน + ปุ่ม "โหลดใหม่"
   - badge: `disabled` "ปิดร้าน" (badge-error), `not_open` "ยังไม่เปิดพรีออเดอร์" (badge-warning), `open` "เปิดรับพรีออเดอร์" (badge-success), `closed` "ปิดรับพรีออเดอร์แล้ว" (badge-info)
   - ข้อความเวลาเปิด–ปิดแบบย่อใต้ badge
   - เปลี่ยน Event → `router.replace` เปลี่ยน `?eventId=` และเก็บค่าล่าสุดใน `localStorage` (`merch:lastEventId`, ห่อ try/catch)
3. **แถบ tab:** แบบ Lucky Wheel (ปุ่มการ์ด `min-h-14`, active = `bg-white text-emerald-800 shadow-sm`, `aria-current="page"`) เป็น `<Link>`; จอแคบเลื่อนแนวนอนได้ภายในแถบ ไม่ทำให้ทั้งหน้าเลื่อนแนวนอน
   - tab "รอตรวจสอบ" แสดงตัวเลขจำนวนที่ยังไม่ปิดเรื่อง (badge-warning) ถ้า > 0
4. **ยังไม่เลือก Event:** แสดงกล่องว่าง "กรุณาเลือก Event" และไม่โหลดข้อมูลอื่น
5. ส่ง context ลงหน้าลูกด้วย `MerchandiseContext { eventId, eventCode, eventName, token, store: AdminStoreDto | null, reloadStore(), openReviews: number, reloadReviews() }` ผ่าน hook `useMerchandise()`

### 5.2 Data layer (`src/lib/merchandiseApi.ts`, `src/types/merchandise.ts`)

- `src/types/merchandise.ts`: คัดลอก DTO ฝั่ง admin จาก API `types.ts` (Baht, ImageAsset, StoreDto, AdminStoreDto, VariantDto, AdminVariantDto, BundleComponentDto, AdminComponentDto, ProductDto, AdminProductDto, AdminCategoryDto, AdminBannerDto, Recipient, OrderItemDto, OrderSummary, PaymentState, PaymentView, OrderDetail, AdminOrderDetail, ProductionRow, BatchRowResult, PaymentReviewDto) + `AdminOrderRow` (`OrderSummary & { buyerName; buyerEmail; itemsText; version }`) พร้อม comment บอกแหล่งที่มาและ commit ของ API ที่คัดลอก
- `merchandiseApi` ห่อ `fetchAPI` เดิม (`src/lib/api.ts`) แบบ `boothApi`: ทุก method รับ `(eventId, ..., token, signal?)` และคืน `data` ที่แกะจาก `{ success, data }` แล้ว base = `/api/backoffice/merchandise/events/${eventId}`
- ครบ 24 endpoint:
  - ร้าน: `getStore`, `updateStore`
  - รูป: `uploadImage(file)` (multipart ไฟล์เดียว; ไม่ตั้ง `Content-Type` เอง)
  - หมวด: `listCategories`, `createCategory`, `updateCategory`, `deleteCategory`, `orderCategories(ids)`
  - Banner: `listBanners`, `createBanner`, `updateBanner`, `deleteBanner`, `orderBanners(ids)`
  - สินค้า: `listProducts(query)`, `createProduct`, `getProduct`, `updateProduct`, `replaceVariants`, `replaceComponents`, `publishProduct`, `unpublishProduct`, `orderProducts(ids)`, `bulkProducts`
  - Preview: `previewStore`, `previewProduct`
  - ออเดอร์: `listOrders(filters)`, `getOrder`, `editOrder`, `checkOrderPayment`, `resendNotification(type, reason)`, `setShipment`, `bulkShipments(rows)`
  - ไฟล์: `downloadOrdersXlsx(filters)`, `downloadProductionXlsx()`
  - อื่นๆ: `production()`, `listReviews(resolved)`, `resolveReview(attemptId, note)`
- **ดาวน์โหลดไฟล์:** เพิ่ม `downloadAPIFile(endpoint, token)` ใน `src/lib/api.ts` (ใช้ `API_BASE` และ token แบบ `fetchAPI`, 401 → `dispatchUnauthorizedEvent()`, error body JSON → `ApiError`) อ่าน `res.blob()` ชื่อไฟล์จาก `Content-Disposition` (fallback `merch-orders.xlsx`) แล้วสั่งดาวน์โหลดผ่าน object URL และ `URL.revokeObjectURL` หลังคลิก

### 5.3 Error และการชนกันของข้อมูล

- ใช้ `ApiError` เดิม (`message`, `status`, `code`, `details`)
- ข้อความภาษาไทยตาม `code` ผ่าน `merchErrorMessage(error)` (`src/lib/merchandiseErrors.ts`) เช่น:
  - `MERCH_VERSION_CONFLICT` → "ข้อมูลถูกแก้ไขโดยผู้ใช้อื่น กรุณาโหลดข้อมูลล่าสุดแล้วลองอีกครั้ง" + ปุ่ม "โหลดข้อมูลล่าสุด" (โหลดใหม่ ไม่ทิ้งค่าที่กรอกไว้ในฟอร์มจนกว่าผู้ใช้จะกด)
  - `MERCH_PUBLISH_INCOMPLETE` → แสดงรายการ `details.issues` เป็นภาษาไทย (§6.4)
  - `MERCH_ORDER_HAS_ACTIVE_QR` → "แก้ไขไม่ได้ขณะมี QR ที่ยังชำระได้ หรือ QR เพิ่งหมดอายุไม่ถึง 2 นาที"
  - `MERCH_PAID_TOTAL_MUST_MATCH` → "ออเดอร์ที่ชำระแล้วต้องมียอดรวมเท่าเดิม"
  - `MERCH_CONTACT_REQUIRED` → "กรุณายืนยันว่าติดต่อผู้ซื้อแล้ว และบันทึกการติดต่อ"
  - `MERCH_ORDER_NOT_PAID`, `MERCH_REASON_REQUIRED`, `MERCH_ORDER_EMPTY`, `MERCH_ORDER_TOO_LARGE`, `MERCH_VARIANT_SHAPE_MIXED`, `MERCH_VARIANT_DUPLICATE`, `MERCH_VARIANT_IN_BUNDLE`, `MERCH_COMPONENT_INVALID`, `MERCH_IMAGE_INVALID`, `MERCH_CATEGORY_INVALID`, `MERCH_STORE_WINDOW_INVALID`, `MERCH_ORDER_INVALID`, `MERCH_NOTIFICATION_NOT_RESENDABLE`, `MERCH_REVIEW_ALREADY_RESOLVED`, `MERCH_PAYMENT_CHECK_FAILED`, `IMAGE_INVALID`, `IMAGE_TOO_LARGE`, `MERCH_RATE_LIMITED`
  - code อื่น → ใช้ `message` จาก server
- แสดง error ในกล่องแดงแบบ Booths (`rounded-xl bg-red-50 p-4 text-sm text-red-700` + "ลองใหม่") สำหรับการโหลด; การบันทึกใช้ `toast.error` และข้อความในฟอร์ม; สำเร็จใช้ `toast.success`
- ปุ่มบันทึกทุกปุ่ม disabled ระหว่างส่ง และแสดง `IconLoader2 animate-spin`

### 5.4 Utility ล้วน (มี unit test)

`src/lib/merchandiseFormat.ts`:
- `formatBaht(n: number): string` → `"1,250 บาท"`
- `parseBahtInput(raw: string): number | null | 'invalid'` (ว่าง → null, จำนวนเต็ม ≥ 0 ≤ 1,000,000 → number, อื่น → 'invalid')
- `formatBangkok(iso: string | null): string` (null → "ยังไม่กำหนด")
- `bangkokInputToIso(value: string): string` (`YYYY-MM-DDTHH:mm` เวลาไทย → `YYYY-MM-DDTHH:mm:00+07:00`)
- `isoToBangkokInput(iso: string | null): string`
- label map: สถานะร้าน, `paymentStatus` (`pending` รอชำระ, `paid` ชำระแล้ว, `expired` หมดเวลาชำระ), `shipping.status` (`not_shipped` ยังไม่จัดส่ง, `shipped` จัดส่งแล้ว), `PaymentState`, attempt status, notification status, review reason, `publishIssues` และ `unavailableCodes` เป็นภาษาไทย

## 6. หน้าจอ

ทุกหน้าใช้หัวเรื่องแบบ Booths (`h1 text-2xl font-bold` + คำอธิบาย `text-sm text-zinc-500`) อยู่ใต้ `MerchandiseShell` และมีสถานะ loading / error / ว่าง ครบ

### 6.1 ภาพรวม (`/merchandise`)

- `stat-card` 5 ใบ: รอชำระ, ชำระแล้ว, หมดเวลาชำระ, ชำระแล้วรอจัดส่ง, รอตรวจสอบ
  - ตัวเลขได้จาก `listOrders({ paymentStatus, limit: 1 })` → `pagination.total` (และ `paymentStatus=paid&shippingStatus=not_shipped`) และ `openReviews` จาก context (5 request พร้อมกัน)
  - คลิกการ์ด → หน้าคำสั่งซื้อพร้อมตัวกรองนั้น / หน้ารอตรวจสอบ
- card ข้อมูลร้าน: สถานะ, เวลาเปิด–ปิด (เวลาไทย), ค่าส่ง 50 บาทต่อคำสั่งซื้อ, ข้อความกำหนดผลิต/จัดส่ง (หรือ "ยังไม่กรอก")
- รายการ "สิ่งที่ต้องทำก่อนเปิดขาย" คำนวณจากข้อมูล: ยังไม่ตั้งเวลาเปิด–ปิด, ร้านยังปิดอยู่, ไม่มีสินค้าที่เผยแพร่, มีสินค้าร่างที่ `publishIssues` ไม่ว่าง (นับจำนวน) แต่ละข้อมีลิงก์ไปหน้าที่แก้

### 6.2 ตั้งค่าร้าน (`/merchandise/store`)

ฟอร์มใน card เดียว:
- toggle "เปิดร้าน" (`enabled`)
- `datetime-local` 2 ช่อง "เปิดพรีออเดอร์ (เวลาไทย)" / "ปิดพรีออเดอร์ (เวลาไทย)" — เคลียร์ได้ (ส่ง null)
- textarea "กำหนดผลิต" / "กำหนดจัดส่ง" (สูงสุด 5,000 ตัวอักษร, ช่องว่างล้วน → ส่ง null)
- ตรวจฝั่ง client: ถ้ามีทั้งคู่ เปิดต้องก่อนปิด
- คำอธิบาย: "ร้านรับออเดอร์ได้เมื่อเปิดร้านและอยู่ในช่วงเวลา หลังปิด QR ที่ออกไปแล้วยังชำระได้จนหมดอายุ"
- บันทึก → `updateStore({ expectedVersion: store.version, ... })` แล้ว `reloadStore()`

### 6.3 รายการสินค้า (`/merchandise/products`)

- แถวเครื่องมือ (card): ค้นหาชื่อ, ตัวกรองสถานะ (ทั้งหมด/ร่าง/เผยแพร่), ชนิด (ทั้งหมด/สินค้าเดี่ยว/Bundle), หมวด; ปุ่ม "เพิ่มสินค้าเดี่ยว" และ "เพิ่ม Bundle" (สร้างด้วยชื่อที่กรอกใน modal เล็ก แล้วเปิดหน้าแก้ไข)
- `data-table`: checkbox, รูปแรก (thumbnail 48px), ชื่อ, ชนิด, หมวด, ราคา (`price` จาก DTO: "250 บาท" หรือ "เริ่ม 250 บาท" หรือ "ยังไม่ตั้งราคา"), สถานะ (badge ร่าง/เผยแพร่ + เปิดขาย/ปิดขาย), "ซื้อได้" (✓ หรือข้อความจาก `unavailableCodes`), "สิ่งที่ยังขาด" (จำนวน `publishIssues`), ปุ่ม แก้ไข
- เลือกหลายแถว → แถบ action: "เปิดขาย", "ปิดขาย", "ย้ายหมวด…" → `bulkProducts` (สูงสุด 200) แสดงผลรายแถวที่ล้มเหลวด้วย `toast` + รายการใต้ตาราง
- โหมด "จัดลำดับ" (ใช้ได้เมื่อไม่มีตัวกรอง): ปุ่มเลื่อนขึ้น/ลง ต่อแถว แล้ว "บันทึกลำดับ" → `orderProducts(ids ทั้งหมด)` (ไม่ใช้ drag-and-drop เพื่อไม่เพิ่ม dependency และใช้งานได้บนมือถือ)

### 6.4 แก้ไขสินค้า (`/merchandise/products/[productId]`)

หัวหน้า: ชื่อสินค้า + badge สถานะ + ปุ่ม "ดูตัวอย่าง" (ไป `/merchandise/preview?productId=`) + ปุ่ม "เผยแพร่" หรือ "ยกเลิกเผยแพร่"

**กล่อง "สิ่งที่ยังขาดก่อนเผยแพร่"** (ด้านบนเมื่อ `publishIssues` ไม่ว่าง; amber): แปลง code เป็นไทย เช่น `NAME_REQUIRED` ต้องมีชื่อ, `IMAGE_REQUIRED` ต้องมีรูปอย่างน้อย 1 รูป, `ENABLED_VARIANT_REQUIRED` ต้องเปิดขายอย่างน้อย 1 ตัวเลือก, `VARIANT_PRICE_REQUIRED` ทุกตัวเลือกที่เปิดขายต้องมีราคา, `VARIANT_SHAPE_MIXED` ตัวเลือกปนแบบมี/ไม่มีไซซ์สี, `BUNDLE_PRICE_REQUIRED` ต้องตั้งราคาชุด, `COMPONENT_REQUIRED` ต้องมีส่วนประกอบ, `COMPONENT_NOT_SINGLE` ส่วนประกอบต้องเป็นสินค้าเดี่ยว, `FIXED_VARIANT_INVALID` ตัวเลือกตายตัวไม่ถูกต้อง, `ALLOWED_VARIANTS_REQUIRED` ต้องเลือกตัวเลือกที่ลูกค้าเลือกได้ — ปุ่มเผยแพร่ disabled จนกล่องว่าง

**Section (card) แยกบันทึก** — แต่ละ section มีปุ่มบันทึกของตัวเองและใช้ `version` ล่าสุดของสินค้า (หลังบันทึกแต่ละ section ให้รับ `AdminProductDto` ที่ server คืนมาแทนค่าทั้งหมดในหน้า):

1. **ข้อมูลหลัก** → `updateProduct`: ชื่อ (≤300), หมวด, รายละเอียด (textarea ≤10,000), ตารางไซซ์ (textarea ≤10,000, สินค้าเดี่ยวเท่านั้น), ราคาหลัก/ราคาชุด (`basePriceBaht`), toggle "เปิดขาย"
2. **รูปสินค้า** (§7.3) → อัปโหลดแล้วบันทึกด้วย `updateProduct({ imageIds })`
3. **ตัวเลือกไซซ์/สี** (สินค้าเดี่ยว; §7.1) → `replaceVariants`
4. **ส่วนประกอบ Bundle** (Bundle; §7.2) → `replaceComponents`

### 6.5 หมวดสินค้า (`/merchandise/categories`)

`data-table`: ชื่อ, แสดงบนหน้าร้าน (toggle → `updateCategory({ visible })`), ปุ่มเลื่อนขึ้น/ลง + "บันทึกลำดับ", แก้ไขชื่อ (inline form), ลบ (confirm: "สินค้าในหมวดนี้จะไม่มีหมวด") — ปุ่ม "เพิ่มหมวด" เปิดฟอร์ม card แบบ Booths

### 6.6 แบนเนอร์ (`/merchandise/banners`)

รายการการ์ด (รูปตัวอย่างกว้างเต็ม card, ลิงก์, toggle แสดง, เลื่อนขึ้น/ลง, เปลี่ยนรูป, ลบ) + "เพิ่มแบนเนอร์": อัปโหลดรูปก่อน (`uploadImage`) แล้ว `createBanner({ imageId, linkUrl, active })`; ลิงก์ต้องเป็น URL เต็มที่ขึ้นต้น `http://` หรือ `https://` ไม่เกิน 2,000 ตัวอักษร (ตรงกับ validator ฝั่ง API) ว่างได้

### 6.7 ดูตัวอย่าง (`/merchandise/preview`)

- ป้าย amber ด้านบน: "ตัวอย่างโดยประมาณ — หน้าร้านจริงอาจต่างเล็กน้อย สินค้าทุกตัวแสดงเหมือนร้านเปิดอยู่"
- ข้อมูลจาก `previewStore` + `listProducts({})` (หา `publishState`)
- ส่วนหัวร้าน: แบนเนอร์แรก, ข้อความกำหนดผลิต/จัดส่ง (ถ้ามี)
- แถบหมวด (ปุ่มกรอง) + grid การ์ดสินค้า (รูป, ชื่อ, ราคา, ป้าย "ฉบับร่าง" ถ้า draft, ป้าย "ซื้อไม่ได้: …" ถ้า `purchasable=false`)
- คลิกการ์ด → panel รายละเอียด (`previewProduct`): แกลเลอรีรูป, รายละเอียด, ตารางไซซ์, ตัวเลือกไซซ์/สี (เลือกแล้วเห็นราคาของตัวเลือก), ส่วนประกอบ Bundle — ปุ่ม "หยิบใส่ตะกร้า" แสดงแบบ disabled
- `?productId=` เปิด panel ของสินค้านั้นทันที
- ใช้ class เดิมของ Backoffice ทั้งหมด ไม่ import CSS หรือ component จาก Pris2026

### 6.8 คำสั่งซื้อ (`/merchandise/orders`)

- ตัวกรอง (card): ค้นหาเลขออเดอร์/ชื่อผู้ซื้อ (debounce ด้วย `useDebounce` เดิม), วันที่สร้างตั้งแต่/ถึง (`type="date"` เวลาไทย), สถานะชำระ, สถานะจัดส่ง; ค่าตัวกรองสะท้อนใน query string
- ปุ่ม "ดาวน์โหลด Excel (ตามตัวกรอง)" → `downloadOrdersXlsx(filters ไม่รวม page/limit)`
- ปุ่ม "จัดส่งแบบ Bulk" → `/merchandise/shipping`
- `data-table` (+ `table-sticky-actions`): เลขออเดอร์ (ลิงก์), วันที่สร้าง, ผู้ซื้อ (ชื่อ + อีเมล), รายการ (`itemsText`), ยอดรวม, สถานะชำระ (badge), สถานะจัดส่ง (badge + ขนส่ง/Tracking ถ้ามี), วันที่ชำระ
- `Pagination` เดิม, limit 20

### 6.9 รายละเอียดคำสั่งซื้อ (`/merchandise/orders/[orderId]`)

โครงแบบ Team registration detail:

1. **หัว (card):** เลขออเดอร์, วันที่สร้าง, badge ชำระ/จัดส่ง, ปุ่ม: "ตรวจสอบการชำระ" (`checkOrderPayment` → แทนที่ข้อมูลทั้งหน้า), "แก้ไขคำสั่งซื้อ" (modal §7.4), "บันทึกการจัดส่ง" หรือ "แก้ไขการจัดส่ง" (modal §7.5; แสดงเฉพาะเมื่อชำระแล้ว), "กลับรายการ"
2. **ผู้ซื้อ / ผู้รับ:** 2 คอลัมน์ (ชื่อ อีเมล โทร / ชื่อผู้รับ โทร ที่อยู่เต็ม บริษัท หมายเหตุ)
3. **รายการสินค้า:** ตาราง ชื่อ (+ ไซซ์/สี, ส่วนประกอบ Bundle เป็นบรรทัดย่อย "× n ต่อชุด") จำนวน ราคาต่อหน่วย รวม; สรุปค่าสินค้า ค่าส่ง ยอดรวม
4. **การชำระเงิน:** สถานะปัจจุบัน (`payment.state` เป็นไทย) + ตาราง attempts: Reference, Provider order no, Transaction ID, ยอด, สถานะ, ขอเมื่อ, หมดอายุ, ชำระเมื่อ, ตรวจล่าสุด (เวลา + ผล), review (เหตุผล + ปิดแล้ว/ยัง พร้อมลิงก์ไปหน้ารอตรวจสอบ)
5. **การจัดส่ง:** ขนส่ง, Tracking, วันที่จัดส่ง
6. **อีเมล:** ตาราง type (ชำระสำเร็จ/จัดส่งแล้ว), สถานะ, จำนวนครั้ง, error ล่าสุด, ส่งเมื่อ; ปุ่ม "ส่งอีกครั้ง" เฉพาะ `failed`/`unknown` → modal ใส่เหตุผล (บังคับ) → `resendNotification`; คำเตือนสำหรับ `unknown`: "สถานะไม่ทราบผล อาจส่งถึงผู้ซื้อแล้ว การส่งอีกครั้งอาจทำให้ได้รับซ้ำ"
7. **Audit trail:** รายการตามเวลา (การกระทำ, ผู้ทำ (id), เหตุผล, บันทึกการติดต่อ, เวลา) พร้อมปุ่ม "ดูข้อมูลก่อน/หลัง" แสดง JSON แบบอ่านง่ายใน `<details>`

### 6.10 จัดส่งแบบ Bulk (`/merchandise/shipping`)

- โหลดออเดอร์ `paymentStatus=paid&shippingStatus=not_shipped` ทุกหน้า (limit 100 วนจนครบ) เรียงตามวันที่ชำระ
- `data-table`: เลขออเดอร์ (ลิงก์ไปรายละเอียดเพื่อดูที่อยู่ผู้รับ), ผู้ซื้อ, รายการ, ช่อง "บริษัทขนส่ง", ช่อง "Tracking ID", สถานะผลล่าสุด
- **วางจาก Excel** (§7.6) เติมช่องตามเลขออเดอร์
- ช่อง "ขนส่งเดียวกันทุกแถว" (เติมเฉพาะแถวที่ยังว่าง) — **ไม่มี** การเติม Tracking ID ซ้ำให้หลายแถว (ข้อ 27)
- ปุ่ม "บันทึกการจัดส่ง (n รายการ)" ส่งเฉพาะแถวที่กรอกครบทั้ง 2 ช่อง → `bulkShipments(rows พร้อม version)` ไม่เกิน 500 แถวต่อครั้ง (แบ่งส่งถ้าเกิน)
- ผล: แถวสำเร็จหายจากรายการ (โหลดใหม่) และ toast สรุป; แถวล้มเหลวคงค่าที่กรอกไว้พร้อมข้อความไทยตาม code ในคอลัมน์ผล
- คำอธิบาย: "ผู้ซื้อจะได้รับอีเมลแจ้งจัดส่งอัตโนมัติ"

### 6.11 รายการรอตรวจสอบ (`/merchandise/reviews`)

- สลับ "ยังไม่ปิดเรื่อง" / "ปิดเรื่องแล้ว" (`resolved=false|true`)
- `data-table`: เลขออเดอร์ (ลิงก์), Reference, ยอดของ attempt, เหตุผล (ไทย: `duplicate_payment` ชำระซ้ำ, `amount_mismatch` ยอดไม่ตรงกับออเดอร์, `merchant_mismatch` merchant ไม่ตรง, `currency_mismatch` สกุลเงินไม่ตรง, `test_status_in_production` รายการทดสอบบนระบบจริง), เมื่อ, (ปิดเรื่องแล้ว: เวลา + บันทึก)
- ปุ่ม "ปิดเรื่อง" → modal บันทึก (บังคับ ≤1,000) → `resolveReview` → `reloadReviews()`
- คำอธิบาย: "ระบบไม่คืนเงินหรือยืนยันออเดอร์อัตโนมัติ ให้เจ้าหน้าที่ตรวจสอบกับ PaySolution และติดต่อผู้ซื้อ แล้วบันทึกผลที่นี่"

### 6.12 ยอดผลิต (`/merchandise/production`)

- `data-table`: สินค้า, ไซซ์, สี, ขายแยก, จาก Bundle, รวม (เรียงตามที่ API ให้) + แถวรวมท้ายตาราง
- ปุ่ม "ดาวน์โหลด Excel" → `downloadProductionXlsx`
- คำอธิบาย: "นับเฉพาะออเดอร์ที่ชำระสำเร็จ Bundle แตกเป็นส่วนประกอบตามจำนวนชุด"

## 7. รายละเอียดการโต้ตอบ

### 7.1 ตัวเลือกไซซ์/สี (`VariantMatrixEditor`)

1. เลือกชนิด: "ไม่มีตัวเลือก" / "ไซซ์" / "สี" / "ไซซ์ และ สี" (ค่าเริ่มต้นอนุมานจาก variant ปัจจุบัน)
2. กรอกค่าเป็นชิป (พิมพ์แล้ว Enter; ลบได้; เรียงลำดับได้ด้วยปุ่มซ้าย/ขวา) สำหรับไซซ์และ/หรือสี (แต่ละค่า ≤100 ตัวอักษร ไม่ซ้ำ)
3. ตาราง: แถว = ไซซ์, คอลัมน์ = สี (หรือรายการเดียวถ้ามีมิติเดียว) แต่ละช่องมี checkbox "เปิดขาย" + ช่องราคา (ว่าง = ใช้ราคาหลัก แสดง placeholder เป็นราคาหลัก)
4. "ไม่มีตัวเลือก" = variant เดียวไม่มีไซซ์/สี (ช่องเปิดขาย + ราคาเฉพาะ ถ้าต้องการ)
5. แปลงเป็น payload ด้วย `buildVariantPayload(existing, matrix)` (pure, มี test):
   - ช่องที่ตรงกับ variant เดิม (size+color เดียวกัน) ส่ง `id` เดิม
   - ช่องที่ติ๊กเปิดขายหรือเป็น variant เดิม → ส่ง `{ id?, sizeTh, colorTh, priceBaht, saleEnabled }`
   - ช่องที่ไม่ติ๊กและไม่เคยมี → ไม่ส่ง
   - variant เดิมที่ไม่อยู่ในตารางใหม่ (ค่าไซซ์/สีถูกลบ) → ไม่ส่ง (= ลบ) ถ้าลบแล้ว API ตอบ `MERCH_VARIANT_IN_BUNDLE` ให้แจ้ง "ตัวเลือกนี้ถูกใช้ใน Bundle อยู่ ให้ปิดขายแทนการลบ"
   - เปลี่ยนชนิดจาก "ไม่มี" เป็นมีไซซ์/สี → variant เริ่มต้นเดิมไม่ถูกส่ง (ถูกลบ) เพื่อไม่ให้ปน (`VARIANT_SHAPE_MIXED`)
6. ข้อความช่วย: "สินค้าที่ไม่มีตัวเลือกจะไม่แสดงช่องเลือกบนหน้าร้าน" และ "ไม่มีการตัดสต็อก"

### 7.2 ส่วนประกอบ Bundle (`BundleComponentsEditor`)

- ราคาชุดอยู่ในข้อมูลหลัก (`basePriceBaht`); ส่วนนี้แสดง "ราคาซื้อแยกรวม" เทียบให้ดู (คำนวณจากราคาต่ำสุดของแต่ละส่วนประกอบ × จำนวน) เป็นข้อมูลประกอบ ไม่บังคับให้ถูกกว่า
- แต่ละแถว: เลือกสินค้า (dropdown เฉพาะสินค้าเดี่ยวของ Event จาก `listProducts({ kind: 'single' })`), จำนวนต่อชุด (1–9999), โหมด "กำหนดตายตัว" (เลือก 1 ตัวเลือก) / "ให้ลูกค้าเลือก" (checkbox ตัวเลือกที่อนุญาต อย่างน้อย 1)
- สินค้าที่ไม่มีตัวเลือก: บังคับโหมดตายตัวและเลือก variant เดียวให้อัตโนมัติ
- ปุ่มเพิ่ม/ลบแถว, เลื่อนขึ้น/ลง; บันทึก → `replaceComponents({ expectedVersion, components })`
- เตือนเมื่อส่วนประกอบถูกปิดขาย: "Bundle นี้จะซื้อไม่ได้จนกว่าส่วนประกอบจะเปิดขาย"

### 7.3 รูป (`ImageManager`)

- เลือกไฟล์ (`accept="image/jpeg,image/png,image/webp"`, หลายไฟล์) → ตรวจขนาด ≤ 5 MB ฝั่ง client → อัปโหลดทีละไฟล์ (`uploadImage`) แสดงความคืบหน้าแต่ละไฟล์ (สำเร็จ/ล้มเหลว + ข้อความ)
- รายการรูป: thumbnail, เลื่อนซ้าย/ขวา, ลบออกจากสินค้า; รวมไม่เกิน 20 รูป (รูปแรก = รูปหลัก)
- ปุ่ม "บันทึกรูป" → `updateProduct({ expectedVersion, imageIds })`
- ใช้ component เดียวกันในแบนเนอร์ (โหมดรูปเดียว)

### 7.4 แก้ไขคำสั่งซื้อ (`OrderEditModal`)

ใช้ `modal-overlay` แบบ Team registration (`max-w-3xl`, เลื่อนได้):

1. **ผู้รับ** (เติมค่าปัจจุบัน): ชื่อ–นามสกุล, โทร, ที่อยู่, ตำบล/แขวง, อำเภอ/เขต, จังหวัด, รหัสไปรษณีย์ (5 หลัก), บริษัท, หมายเหตุ — ตรวจรูปแบบโทรแบบเดียวกับ API (ตัด `-`/ช่องว่าง, `+66`→`0`, 9–10 หลัก)
2. **รายการ:** รายการเดิม (จำนวนแก้ได้ 0–9999; 0 = นำออก; ราคาต่อหน่วยเดิมคงที่) + "เพิ่มรายการ": เลือกสินค้า (เผยแพร่แล้ว) → ตัวเลือก (single) หรือการเลือกส่วนประกอบ (Bundle แบบให้เลือก) → จำนวน; แสดงราคาจากแค็ตตาล็อกปัจจุบัน
3. **สรุปยอด:** ยอดเดิม vs ยอดใหม่ (คำนวณฝั่ง client ด้วย `computeEditedTotal` เพื่อแสดงผล; server เป็นผู้ตัดสิน)
4. **ออเดอร์ชำระแล้ว:** แถบ amber "ออเดอร์ชำระแล้ว ยอดรวมต้องเท่าเดิม ส่วนต่างให้จัดการนอกระบบ"; checkbox "ติดต่อผู้ซื้อแล้ว" (บังคับ) + "บันทึกการติดต่อ" (บังคับ: ช่องทาง วันที่ ผล); ปุ่มบันทึก disabled ถ้ายอดใหม่ ≠ ยอดเดิม
5. **ออเดอร์ยังไม่ชำระ:** ข้อความ "QR ใบถัดไปจะใช้ยอดใหม่"; ถ้า `payment.state` เป็น `qr_active` หรือ `verifying` ปุ่มเปิด modal disabled พร้อม tooltip เหตุผล
6. **เหตุผลการแก้ไข** (บังคับ ≤1,000)
7. ส่งเฉพาะส่วนที่เปลี่ยน (`recipient` ถ้าแก้, `lines` ถ้าแก้) พร้อม `expectedVersion`; ไม่มีอะไรเปลี่ยน → ปุ่มบันทึก disabled
8. สำเร็จ → แทนที่ข้อมูลหน้าด้วย `AdminOrderDetail` ที่ server คืน

### 7.5 บันทึกการจัดส่ง (`ShipmentModal`)

ช่องบริษัทขนส่ง (1–100) + Tracking ID (1–100, เก็บเป็นข้อความ คงเลข 0 นำหน้า); ถ้าจัดส่งแล้วต้องใส่เหตุผล และแสดงข้อความ "ไม่ส่งอีเมลซ้ำ"; ครั้งแรกแสดง "ผู้ซื้อจะได้รับอีเมลแจ้งจัดส่ง" → `setShipment({ expectedVersion, carrier, trackingId, reason? })`

### 7.6 วางข้อมูลจัดส่งจาก Excel (`parseShipmentPaste`)

- textarea "วางข้อมูลจาก Excel" รับหลายบรรทัด แต่ละบรรทัดแยกด้วย Tab (คัดลอกจาก Excel) หรือ comma: `เลขออเดอร์, บริษัทขนส่ง, Tracking ID`
- ข้ามบรรทัดว่างและบรรทัดหัวตาราง (คอลัมน์แรกไม่ตรงรูปแบบเลขออเดอร์ `^[A-Z0-9]+-M-\d{6}$` หลัง trim + uppercase)
- จับคู่กับแถวในตารางตามเลขออเดอร์; ผลแสดง 3 กลุ่ม: เติมแล้ว n แถว, ไม่พบเลขออเดอร์ (รายการ), ข้อมูลไม่ครบ (รายการ)
- เลขออเดอร์ซ้ำในข้อความวาง → ใช้บรรทัดสุดท้ายและแจ้งเตือน
- ไม่เขียนทับช่องที่ผู้ใช้กรอกเองแล้ว เว้นแต่ติ๊ก "เขียนทับค่าที่มีอยู่"

## 8. โครงไฟล์

```
src/app/merchandise/
  layout.tsx                      MerchandiseShell
  page.tsx                        OverviewPage
  store/page.tsx
  products/page.tsx
  products/[productId]/page.tsx
  categories/page.tsx
  banners/page.tsx
  preview/page.tsx
  orders/page.tsx
  orders/[orderId]/page.tsx
  shipping/page.tsx
  reviews/page.tsx
  production/page.tsx
src/components/merchandise/
  MerchandiseShell.tsx  MerchandiseContext.tsx
  OverviewPage.tsx  StoreSettingsForm.tsx
  ProductList.tsx  ProductEditor.tsx  VariantMatrixEditor.tsx  BundleComponentsEditor.tsx  ImageManager.tsx
  CategoryManager.tsx  BannerManager.tsx  StorePreview.tsx
  OrdersTable.tsx  OrderDetail.tsx  OrderEditModal.tsx  ShipmentModal.tsx  ResendNotificationModal.tsx
  BulkShipping.tsx  PaymentReviews.tsx  ProductionReport.tsx
src/lib/
  merchandiseApi.ts  merchandiseErrors.ts  merchandiseFormat.ts
  merchandiseVariants.ts  merchandiseShipping.ts  merchandiseOrderEdit.ts
  (+ .test.ts ของ merchandiseFormat, merchandiseVariants, merchandiseShipping, merchandiseOrderEdit, merchandiseErrors)
  api.ts                          + downloadAPIFile
src/types/merchandise.ts
src/components/layout/Sidebar.tsx  + เมนู "ของที่ระลึก" (admin เท่านั้น)
```

- `page.tsx` ทุกไฟล์บาง (render component ใน `Suspense` แบบ `src/app/booths/page.tsx`)
- component แต่ละไฟล์ทำหน้าที่เดียว; logic ที่ไม่ใช่ UI อยู่ใน `src/lib/merchandise*.ts`

## 9. การทดสอบ

**Unit (`npx tsx --test src/lib/merchandise*.test.ts` ตามแบบ `src/lib/*.test.ts` เดิม):**
- `merchandiseFormat.test.ts`: `formatBaht`, `parseBahtInput` (ว่าง/ทศนิยม/ติดลบ/เกินเพดาน/ตัวอักษร), `bangkokInputToIso` / `isoToBangkokInput` รวมขอบวัน (`2026-10-16T23:30` ↔ `2026-10-16T16:30:00Z`), `formatBangkok(null)`
- `merchandiseVariants.test.ts`: `buildVariantPayload` — คง `id` เดิม, ลบค่าที่หายไป, ไม่ส่งช่องที่ไม่ติ๊กและไม่เคยมี, ราคาว่าง → null, เปลี่ยนจาก "ไม่มีตัวเลือก" เป็นไซซ์ (variant เริ่มต้นถูกลบ), ค่าซ้ำถูกปฏิเสธก่อนส่ง
- `merchandiseShipping.test.ts`: `parseShipmentPaste` — Tab/comma, หัวตาราง, บรรทัดว่าง, เลขออเดอร์ตัวเล็ก/ช่องว่าง, ไม่พบ, ไม่ครบ, ซ้ำ, ไม่เขียนทับ, Tracking ที่ขึ้นต้นด้วย 0
- `merchandiseOrderEdit.test.ts`: `computeEditedTotal` (คงราคาเดิม, จำนวน 0 = นำออก, รายการใหม่, + ค่าส่ง 50), `buildOrderEditPayload` (ส่งเฉพาะส่วนที่เปลี่ยน, paid ต้องมี contact)
- `merchandiseErrors.test.ts`: code ที่รู้จักได้ข้อความไทย, code อื่นใช้ message เดิม

**ตรวจก่อน commit:** `npm run lint`, `npx tsc --noEmit`, `npm run build`, `npm run format:check`

**ทดสอบมือ (checklist ใน plan) กับ API local + ฐานข้อมูลทดสอบ:** ตั้งค่าร้าน → seed สินค้าร่าง → เติมข้อมูลและเผยแพร่สินค้าเดี่ยว (ไม่มีตัวเลือก / ไซซ์ / ไซซ์+สี) และ Bundle (ตายตัว / ให้เลือก) → ปิดส่วนประกอบแล้วเห็น Bundle ซื้อไม่ได้ใน Preview → สั่งซื้อจาก Pris2026 → ออเดอร์ขึ้นในรายการ → แก้ออเดอร์ที่ยังไม่จ่าย (กันเมื่อมี QR) → จ่าย (หรือจำลองด้วยการอัปเดตฐานข้อมูลทดสอบ) → แก้ออเดอร์ที่จ่ายแล้ว (ยอดต้องเท่าเดิม) → จัดส่งรายออเดอร์และ Bulk (วางจาก Excel) → ส่งอีเมลซ้ำกรณีล้มเหลว → ปิดเรื่องในรายการรอตรวจสอบ → Export ทั้ง 2 ไฟล์ → ลองที่ความกว้าง 375 px และ 1440 px ว่าไม่มีการเลื่อนแนวนอนทั้งหน้า และปุ่มหลักกดได้ ≥44 px

## 10. นอกขอบเขต

- การคืนเงิน, void, mark ว่าจ่ายแล้วด้วยมือ (API ไม่มี)
- สิทธิ์ role อื่นนอกจาก admin
- Drag-and-drop จัดลำดับ, การอัปโหลดไฟล์ Excel สำหรับจัดส่ง (ใช้การวางแทน)
- Preview แบบเปิดหน้า Pris2026 จริง
- การแก้ API นอกจาก §3
