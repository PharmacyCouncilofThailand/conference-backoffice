# Merchandise Backoffice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the merchandise admin screens in conference-backoffice (overview, store settings, catalog, preview, orders, shipping, reviews, production) on top of the finished merchandise API.

**Architecture:** One Sidebar entry "ของที่ระลึก" → Next.js routes under `src/app/merchandise/*`, wrapped by a shared `MerchandiseShell` (event selector + store status + tab bar) that provides a `MerchandiseContext`. All server calls go through `src/lib/merchandiseApi.ts` (thin wrapper over the existing `fetchAPI`); all non-UI logic lives in small tested modules under `src/lib/merchandise*.ts`. One prerequisite task adds `version` to admin order rows in conference-api.

**Tech Stack:** Next.js 16 (App Router, client components), React 19, Tailwind 4 with the existing global classes, `@tabler/icons-react`, `react-hot-toast`, TypeScript; unit tests with `node:test` run through `npx tsx --test`.

**Spec:** `docs/superpowers/specs/2026-10-18-merchandise-backoffice-design.md` (§ numbers below refer to it). API contract source of truth: `D:\confer\confer\conference\conference-api\src\modules\merchandise\types.ts` on branch `feat/merchandise-preorder`.

## Global Constraints

- Branch `feat/merchandise-preorder` in conference-backoffice (and in conference-api for Task 1). Never commit to `main`, never push.
- Reuse the existing look: `AdminLayout`, classes `card`, `btn-primary`, `btn-secondary`, `btn-danger`, `input-field`, `input-field-search`, `data-table`, `table-sticky-actions`, `badge`, `badge-success|warning|error|info`, `stat-card`, `modal-overlay`, component `Pagination`, icons from `@tabler/icons-react`, `toast` from `react-hot-toast`. No new UI libraries, no drag-and-drop.
- All user-facing copy in Thai (copy given in the spec is used verbatim).
- Admin only: non-admin sees `หน้านี้สำหรับ Admin เท่านั้น` (`useAuth().user?.role === 'admin'`).
- Money is whole baht (integer); display `formatBaht` → `"1,250 บาท"`; price inputs accept integers 0–1,000,000.
- Times display in `Asia/Bangkok`; datetime inputs are Bangkok time and are sent as ISO with `+07:00`.
- Every mutation sends the current `version` as `expectedVersion` where the API takes one; on `MERCH_VERSION_CONFLICT` keep the user's form values and offer "โหลดข้อมูลล่าสุด".
- Save buttons are disabled while a request is in flight (prevents duplicate creates).
- Excel files come from the server endpoints (`/orders/export.xlsx`, `/production/export.xlsx`) via `downloadAPIFile`; no client-side workbook building.
- Module code imports the API base only through `src/lib/api.ts`; never hard-code the API URL.
- Before every commit: `npx prettier --write <changed files>`, `npx tsc --noEmit` clean, `npm run lint` with no new errors in changed files.
- Commit trailer exactly: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Pasting from Excel on Windows** (CRLF line endings, trailing tab, extra columns, header row) → rows still parse and match by order number. Test in Task 13.
2. **Price typed with a thousands separator** (`"1,250"`, `" 250 "`) → accepted as 1250 / 250; `"12.5"`, `"-1"`, `"1,000,001"`, `"abc"` → invalid. Test in Task 2.
3. **Variant values that differ only by spaces or case** (`"M"` and `" m "`) → treated as duplicates and rejected before sending. Test in Task 7.
4. **Removing every line in an order edit** → blocked client-side with `MERCH_ORDER_EMPTY` copy, no request sent. Test in Task 12.
5. **A 401 during an Excel download** (expired session) → triggers the existing unauthorized handling (logout redirect) instead of saving an error file. Test in Task 3.

---

## File Map

```
conference-api (Task 1 only)
  src/modules/merchandise/admin-orders.ts          + version in AdminOrderRow
  src/modules/merchandise/types.ts                 (no change; AdminOrderRow lives in admin-orders.ts)
  src/modules/merchandise/admin-orders.integration.test.ts
conference-backoffice
  packages/merchandise-storefront-view/            DELETE (untracked leftover) — Task 2
  src/types/merchandise.ts                         Task 3
  src/lib/merchandiseFormat.ts (+test)             Task 2
  src/lib/merchandiseErrors.ts (+test)             Task 2
  src/lib/api.ts                                   + downloadAPIFile — Task 3
  src/lib/merchandiseApi.ts                        Task 3
  src/components/merchandise/MerchandiseContext.tsx, MerchandiseShell.tsx    Task 4
  src/app/merchandise/layout.tsx + every page.tsx  Tasks 4–14
  src/components/layout/Sidebar.tsx                Task 4
  src/components/merchandise/OverviewPage.tsx, StoreSettingsForm.tsx         Task 5
  src/components/merchandise/ImageManager.tsx, CategoryManager.tsx, BannerManager.tsx   Task 6
  src/lib/merchandiseVariants.ts (+test), src/components/merchandise/VariantMatrixEditor.tsx   Task 7
  src/components/merchandise/ProductList.tsx       Task 8
  src/components/merchandise/ProductEditor.tsx, BundleComponentsEditor.tsx   Task 9
  src/components/merchandise/StorePreview.tsx      Task 10
  src/components/merchandise/OrdersTable.tsx       Task 11
  src/components/merchandise/OrderDetail.tsx, ShipmentModal.tsx, ResendNotificationModal.tsx   Task 11
  src/lib/merchandiseOrderEdit.ts (+test), src/components/merchandise/OrderEditModal.tsx   Task 12
  src/lib/merchandiseShipping.ts (+test), src/components/merchandise/BulkShipping.tsx   Task 13
  src/components/merchandise/PaymentReviews.tsx, ProductionReport.tsx       Task 14
  docs/merchandise-backoffice-manual-test.md       Task 15
```

Every `src/app/merchandise/**/page.tsx` is a thin wrapper like `src/app/booths/page.tsx`: `<Suspense fallback={<p>กำลังโหลด</p>}><Component /></Suspense>`.

---

### Task 1: API — add `version` to admin order rows (conference-api)

**Files:**
- Modify: `D:\confer\confer\conference\conference-api\src\modules\merchandise\admin-orders.ts` (`AdminOrderRow` type and `queryAdminOrders` select/row builder)
- Test: `D:\confer\confer\conference\conference-api\src\modules\merchandise\admin-orders.integration.test.ts`

**Interfaces:**
- Produces: `type AdminOrderRow = OrderSummary & { buyerName: string; buyerEmail: string; itemsText: string; version: number }` returned by `GET /api/backoffice/merchandise/events/:eventId/orders` (and used internally by the export path, which ignores the field).

- [ ] **Step 1: Write the failing test** in `admin-orders.integration.test.ts`: `test("order list rows carry the order version", ...)` — create an order (existing helpers in the file), `GET /orders`, assert `items[0].version === 1`; edit the order once via `PATCH /orders/:id` (existing edit test setup), `GET /orders` again, assert the row's `version === 2` and equals `GET /orders/:id` → `version`.
- [ ] **Step 2: Run it to verify it fails** — `cd D:\confer\confer\conference\conference-api && PAYMENTS_ALLOW_UNMARKED_TEST_DATABASE=true npx tsx --env-file=.env --test --test-concurrency=1 src/modules/merchandise/admin-orders.integration.test.ts` → FAIL (`version` undefined). Never print `.env` values; never run anything against `.env`'s `DATABASE_URL`.
- [ ] **Step 3: Implement** — select `merchOrders.version` in `queryAdminOrders` and add it to each row.
- [ ] **Step 4: Run** the same file and `src/modules/merchandise/reports.integration.test.ts` (export shares the query) → PASS; `npx tsc --noEmit` clean.
- [ ] **Step 5: Commit** in conference-api — `feat(merchandise): include order version in admin order list rows`.

---

### Task 2: Pure helpers — formatting and error copy (+ remove leftover package)

**Files:**
- Delete: `packages/merchandise-storefront-view/` (untracked leftover; `rm -rf` — confirm first with `git ls-files packages` that nothing is tracked)
- Create: `src/lib/merchandiseFormat.ts`, `src/lib/merchandiseFormat.test.ts`, `src/lib/merchandiseErrors.ts`, `src/lib/merchandiseErrors.test.ts`

**Interfaces:**
- Produces (`merchandiseFormat.ts`):
  - `formatBaht(n: number): string`
  - `parseBahtInput(raw: string): number | null | 'invalid'` (trim; strip `,`; `''` → `null`; integer 0–1,000,000 → number; else `'invalid'`)
  - `formatBangkok(iso: string | null): string` (null → `"ยังไม่กำหนด"`; `Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Bangkok' })`)
  - `bangkokInputToIso(value: string): string` (`YYYY-MM-DDTHH:mm` → `YYYY-MM-DDTHH:mm:00+07:00`; throws on bad format)
  - `isoToBangkokInput(iso: string | null): string` (null → `''`)
  - `bangkokDateInputToday(): string` (`YYYY-MM-DD` in Bangkok, for date filters)
  - Label maps (all `Record<..., string>`): `storeStateLabel` (`disabled` ปิดร้าน, `not_open` ยังไม่เปิดพรีออเดอร์, `open` เปิดรับพรีออเดอร์, `closed` ปิดรับพรีออเดอร์แล้ว), `paymentStatusLabel` (`pending` รอชำระ, `paid` ชำระแล้ว, `expired` หมดเวลาชำระ), `shippingStatusLabel` (`not_shipped` ยังไม่จัดส่ง, `shipped` จัดส่งแล้ว), `paymentStateLabel` (8 PaymentState values → Thai), `attemptStatusLabel` (`creating` กำลังสร้าง QR, `active` QR ใช้งานได้, `create_failed` สร้าง QR ไม่สำเร็จ, `create_unknown` ไม่ทราบผลการสร้าง QR, `expired` QR หมดอายุ, `paid` ชำระแล้ว), `notificationStatusLabel` (`queued` รอส่ง, `sending` กำลังส่ง, `sent` ส่งแล้ว, `failed` ส่งไม่สำเร็จ, `unknown` ไม่ทราบผล), `notificationTypeLabel` (`paid` ชำระสำเร็จ, `shipped` จัดส่งแล้ว), `reviewReasonLabel` (spec §6.11), `publishIssueLabel` (spec §6.4 box), `unavailableLabel` (`STORE_NOT_OPEN` ร้านยังไม่เปิด, `PRODUCT_DISABLED` สินค้าปิดขาย, `VARIANT_DISABLED` ตัวเลือกปิดขาย, `COMPONENT_UNAVAILABLE` ส่วนประกอบซื้อไม่ได้), `badgeClassForStore`, `badgeClassForPayment`, `badgeClassForShipping`.
- Produces (`merchandiseErrors.ts`): `merchErrorMessage(error: unknown): string` — `ApiError` with a known `code` → Thai copy from spec §5.3 (plus `MERCH_RATE_LIMITED` "เรียกใช้งานถี่เกินไป กรุณารอสักครู่", `IMAGE_INVALID` "ไฟล์รูปไม่ถูกต้อง รองรับ JPG PNG WebP", `IMAGE_TOO_LARGE` "รูปมีขนาดเกิน 5 MB", `MERCH_ORDER_EMPTY` "คำสั่งซื้อต้องมีสินค้าอย่างน้อย 1 รายการ", `MERCH_ORDER_TOO_LARGE` "ยอดรวมเกินที่ระบบรองรับ", `MERCH_ORDER_NOT_PAID` "บันทึกการจัดส่งได้เฉพาะออเดอร์ที่ชำระแล้ว", `MERCH_REASON_REQUIRED` "กรุณาระบุเหตุผล", `MERCH_VARIANT_IN_BUNDLE` "ตัวเลือกนี้ถูกใช้ใน Bundle อยู่ ให้ปิดขายแทนการลบ", and the other codes listed in §5.3 with short Thai text); unknown code → `error.message`; non-Error → `"เกิดข้อผิดพลาด กรุณาลองอีกครั้ง"`. `publishIssuesFromError(error: unknown): string[]` → `details.issues` mapped via `publishIssueLabel` when code is `MERCH_PUBLISH_INCOMPLETE`, else `[]`. `isVersionConflict(error: unknown): boolean`.

- [ ] **Step 1: Write failing tests** `merchandiseFormat.test.ts`:
  - `formatBaht(1250) === "1,250 บาท"`, `formatBaht(0) === "0 บาท"`
  - **Review Focus 2:** `parseBahtInput("1,250") === 1250`, `parseBahtInput(" 250 ") === 250`, `parseBahtInput("") === null`, `parseBahtInput("12.5") === 'invalid'`, `"-1"`, `"1,000,001"`, `"abc"` → `'invalid'`, `"1000000"` → `1000000`
  - `bangkokInputToIso("2026-10-16T23:30") === "2026-10-16T23:30:00+07:00"`; `new Date(bangkokInputToIso("2026-10-16T23:30")).toISOString() === "2026-10-16T16:30:00.000Z"`; `isoToBangkokInput("2026-10-16T16:30:00.000Z") === "2026-10-16T23:30"`; `isoToBangkokInput(null) === ""`; `bangkokInputToIso("bad")` throws
  - `formatBangkok(null) === "ยังไม่กำหนด"`
  - every `PaymentState` key has a non-empty `paymentStateLabel`
- [ ] **Step 2: Write failing tests** `merchandiseErrors.test.ts`: `new ApiError("x", 409, "MERCH_VERSION_CONFLICT")` → message contains `"ข้อมูลถูกแก้ไขโดยผู้ใช้อื่น"` and `isVersionConflict` true; unknown code `"SOMETHING"` with message `"boom"` → `"boom"`; `publishIssuesFromError(new ApiError("x", 422, "MERCH_PUBLISH_INCOMPLETE", { issues: ["NAME_REQUIRED","IMAGE_REQUIRED"] }))` → `["ต้องมีชื่อ", "ต้องมีรูปอย่างน้อย 1 รูป"]`; `merchErrorMessage("x")` → `"เกิดข้อผิดพลาด กรุณาลองอีกครั้ง"`.
- [ ] **Step 3: Run** `npx tsx --test src/lib/merchandiseFormat.test.ts src/lib/merchandiseErrors.test.ts` → FAIL (modules missing).
- [ ] **Step 4: Implement** both modules; delete the leftover package directory.
- [ ] **Step 5: Run** the same command → PASS; `npx tsc --noEmit`; `npm run lint`.
- [ ] **Step 6: Commit** — `feat(merchandise): add formatting and error copy helpers`.

---

### Task 3: Types, API client and file download

**Files:**
- Create: `src/types/merchandise.ts`, `src/lib/merchandiseApi.ts`, `src/lib/merchandiseApi.test.ts`
- Modify: `src/lib/api.ts` (add `downloadAPIFile`)

**Interfaces:**
- Consumes: `fetchAPI`, `ApiError` (existing, `src/lib/api.ts`).
- Produces:
  - `src/types/merchandise.ts`: copy of the API admin DTOs listed in spec §5.2 (from conference-api `types.ts`, header comment with the API commit SHA) plus `AdminOrderRow` (with `version`), `OrderFilters = { search?: string; createdFrom?: string; createdTo?: string; paymentStatus?: 'pending'|'paid'|'expired'; shippingStatus?: 'not_shipped'|'shipped'; page?: number; limit?: number }`, `ProductQuery = { status?: 'draft'|'published'; kind?: 'single'|'bundle'; categoryId?: string; search?: string }`, `Page<T> = { items: T[]; pagination: { page: number; limit: number; total: number; totalPages: number } }`, input types `StoreInput`, `ProductInput` (`{ nameTh?; descriptionTh?; sizeChartTh?; imageIds?; categoryId?; saleEnabled?; basePriceBaht? }`), `VariantInput` (`{ id?; sizeTh: string|null; colorTh: string|null; priceBaht: number|null; saleEnabled: boolean }`), `ComponentInput` (`{ id?; componentProductId; quantityPerBundle; mode; fixedVariantId: string|null; allowedVariantIds: string[] }`), `OrderEditInput` (spec §7.4 / API `orderEditInput`), `ShipmentInput`, `BulkShipmentRow`.
  - `src/lib/api.ts`: `export async function downloadAPIFile(endpoint: string, token: string, fallbackName: string): Promise<void>` — uses `API_BASE`, `Authorization: Bearer`, on 401 calls `dispatchUnauthorizedEvent()` and throws `ApiError`; non-2xx JSON body → `ApiError(message, status, code, details)`; success → `res.blob()`, filename from `Content-Disposition` (`filename="..."`, else `fallbackName`), anchor click with `URL.createObjectURL`, then `URL.revokeObjectURL`. Accept an optional 4th param `deps = { fetch: globalThis.fetch, saveBlob }` for testing.
  - `src/lib/merchandiseApi.ts`: `export const merchandiseApi = { ... }` — every method `(eventId: number, ...args, token: string, signal?: AbortSignal)` returning the unwrapped `data`; method names exactly as spec §5.2 list; query strings built with `URLSearchParams` skipping undefined/empty values. Download methods: `downloadOrdersXlsx(eventId, filters, token)` (drops `page`/`limit`), `downloadProductionXlsx(eventId, token)`. `uploadImage(eventId, file: File, token)` sends `FormData` with field `file` (no manual `Content-Type`).
  - Helper `export function orderFilterQuery(filters: OrderFilters, opts?: { paging: boolean }): string`.

- [ ] **Step 1: Write failing tests** `merchandiseApi.test.ts`:
  - `orderFilterQuery({ search: " PRIS ", paymentStatus: "paid", page: 2, limit: 20 }, { paging: false }) === "search=PRIS&paymentStatus=paid"`; with `{ paging: true }` includes `page=2&limit=20`; empty values omitted
  - **Review Focus 5:** `downloadAPIFile("/x", "t", "f.xlsx", { fetch: async () => new Response(JSON.stringify({ success:false, code:"MERCH_AUTH_REQUIRED", error:"no" }), { status: 401 }), saveBlob: () => assert.fail("must not save") })` rejects with `ApiError` status 401 and the unauthorized event is dispatched — in the test set `globalThis.window = new EventTarget()` (restore afterwards) and listen for `'accp-backoffice-auth:unauthorized'` (the existing `AUTH_UNAUTHORIZED_EVENT` value in `src/lib/api.ts:69`); assert exactly one event fired
  - success path: response with `Content-Disposition: attachment; filename="merch-orders-PRIS2026.xlsx"` → `saveBlob` called with that name
- [ ] **Step 2: Run** `npx tsx --test src/lib/merchandiseApi.test.ts` → FAIL.
- [ ] **Step 3: Implement** types, `downloadAPIFile`, `merchandiseApi`, `orderFilterQuery`.
- [ ] **Step 4: Run** → PASS; `npx tsc --noEmit`; `npm run lint`.
- [ ] **Step 5: Commit** — `feat(merchandise): add admin API client, types and file download`.

---

### Task 4: Shell, context, Sidebar entry

**Files:**
- Create: `src/components/merchandise/MerchandiseContext.tsx`, `src/components/merchandise/MerchandiseShell.tsx`, `src/app/merchandise/layout.tsx`, `src/app/merchandise/page.tsx` (temporary placeholder text "ภาพรวม" replaced in Task 5)
- Modify: `src/components/layout/Sidebar.tsx`

**Interfaces:**
- Consumes: `merchandiseApi.getStore`, `merchandiseApi.listReviews`, `api.backofficeEvents.list`, label/badge helpers (Task 2), `merchErrorMessage`.
- Produces:
  - `MerchandiseContext` value `{ eventId: number; eventCode: string; eventName: string; token: string; store: AdminStoreDto | null; reloadStore(): Promise<void>; openReviews: number; reloadReviews(): Promise<void> }` and hook `useMerchandise()` (throws outside the shell).
  - `merchHref(path: string, eventId: number, extra?: Record<string, string>): string` exported from `MerchandiseContext.tsx`.
  - `MERCH_TABS` constant: `[['/merchandise','ภาพรวม'],['/merchandise/store','ตั้งค่าร้าน'],['/merchandise/products','สินค้า'],['/merchandise/categories','หมวดสินค้า'],['/merchandise/banners','แบนเนอร์'],['/merchandise/preview','ดูตัวอย่าง'],['/merchandise/orders','คำสั่งซื้อ'],['/merchandise/shipping','จัดส่ง'],['/merchandise/reviews','รอตรวจสอบ'],['/merchandise/production','ยอดผลิต']]`; active rule: exact match for `/merchandise`, `startsWith` for others.

- [ ] **Step 1: Implement** per spec §4 and §5.1:
  - Sidebar: entry `{ type: 'link', href: '/merchandise', label: 'ของที่ระลึก', icon: IconShoppingBag }` after Sponsor Hub; hidden for every role except `admin` (follow the Sponsor Hub filter); active on `pathname.startsWith('/merchandise')`.
  - Shell: admin gate; event `<select>` (events from `api.backofficeEvents.list(token, 'limit=100')`, cast to `{ id: number; eventName: string; eventCode: string }`); initial event = `?eventId` → else `localStorage['merch:lastEventId']` (try/catch) → else event with `eventCode === 'PRIS-2026'`; changing the event `router.replace` with the new `eventId` and stores it; store status badge + open/close times; "โหลดใหม่" button; tab bar styled like `src/app/lucky-wheel/page.tsx:610-616` using `<Link>` with `aria-current`; tab "รอตรวจสอบ" shows `openReviews` badge when > 0; tab bar scrolls horizontally inside its own container (`overflow-x-auto`) on narrow screens; no event selected → card "กรุณาเลือก Event" and children not rendered; load errors in the red Booths box with "ลองใหม่".
- [ ] **Step 2: Verify** `npx tsc --noEmit`, `npm run lint`, `npm run build` (build must succeed; the route compiles).
- [ ] **Step 3: Commit** — `feat(merchandise): add merchandise shell, context and sidebar entry`.

---

### Task 5: Overview and store settings

**Files:**
- Create: `src/components/merchandise/OverviewPage.tsx`, `src/components/merchandise/StoreSettingsForm.tsx`, `src/app/merchandise/store/page.tsx`
- Modify: `src/app/merchandise/page.tsx` (render `OverviewPage`)

**Interfaces:**
- Consumes: `useMerchandise()`, `merchandiseApi.listOrders`, `merchandiseApi.listProducts`, `merchandiseApi.updateStore`, `bangkokInputToIso`, `isoToBangkokInput`, `formatBangkok`, `merchErrorMessage`, `isVersionConflict`, `merchHref`.

- [ ] **Step 1: Implement** spec §6.1 and §6.2 exactly:
  - Overview: five `stat-card`s (counts from `listOrders(..., { paymentStatus, limit: 1 })` → `pagination.total`, plus `paymentStatus=paid&shippingStatus=not_shipped`, plus `openReviews`) fetched in parallel, each a link to the filtered orders page / reviews; store info card; "สิ่งที่ต้องทำก่อนเปิดขาย" checklist computed from store + `listProducts({})` (no window set; store disabled; no published product; N drafts with non-empty `publishIssues`) each with a link.
  - Store settings: form fields, client validation (open < close when both set), blank textarea → `null`, submit `updateStore({ expectedVersion: store.version, enabled, opensAt, closesAt, productionInfoTh, shippingInfoTh })`, success → `toast.success('บันทึกการตั้งค่าร้านแล้ว')` + `reloadStore()`; conflict → keep values, show "โหลดข้อมูลล่าสุด" which calls `reloadStore()` and refills the form; helper text from spec §6.2 verbatim.
- [ ] **Step 2: Verify** `npx tsc --noEmit`, `npm run lint`.
- [ ] **Step 3: Commit** — `feat(merchandise): add overview and store settings pages`.

---

### Task 6: Images, categories and banners

**Files:**
- Create: `src/components/merchandise/ImageManager.tsx`, `src/components/merchandise/CategoryManager.tsx`, `src/components/merchandise/BannerManager.tsx`, `src/app/merchandise/categories/page.tsx`, `src/app/merchandise/banners/page.tsx`

**Interfaces:**
- Produces: `ImageManager` props `{ eventId: number; token: string; images: ImageAsset[]; max: number; onChange(images: ImageAsset[]): void; single?: boolean }` — uploads files via `merchandiseApi.uploadImage` one at a time, rejects files > 5 MB or not JPEG/PNG/WebP client-side with `"รูปมีขนาดเกิน 5 MB"` / `"ไฟล์รูปไม่ถูกต้อง รองรับ JPG PNG WebP"`, shows per-file status, supports move left/right and remove, caps at `max`; it never calls the product/banner save itself (parent saves).
- Consumes: category/banner methods of `merchandiseApi`.

- [ ] **Step 1: Implement** spec §6.5 (categories: table, visible toggle, inline rename, delete with `confirm("ลบหมวดนี้? สินค้าในหมวดนี้จะไม่มีหมวด")`, up/down + "บันทึกลำดับ" → `orderCategories(allIds)`, "เพิ่มหมวด" form card) and §6.6 + §7.3 (banners as cards with image, link, active toggle, up/down + save order, change image, delete; link validated `^https?://` ≤ 2,000 or empty).
- [ ] **Step 2: Verify** `npx tsc --noEmit`, `npm run lint`.
- [ ] **Step 3: Commit** — `feat(merchandise): add image manager, categories and banners`.

---

### Task 7: Variant matrix logic and editor

**Files:**
- Create: `src/lib/merchandiseVariants.ts`, `src/lib/merchandiseVariants.test.ts`, `src/components/merchandise/VariantMatrixEditor.tsx`

**Interfaces:**
- Produces (`merchandiseVariants.ts`):
  - `type OptionKind = 'none' | 'size' | 'color' | 'size_color'`
  - `type MatrixCell = { sizeTh: string | null; colorTh: string | null; enabled: boolean; price: string }` (price is the raw input)
  - `type VariantMatrix = { kind: OptionKind; sizes: string[]; colors: string[]; cells: MatrixCell[] }`
  - `inferMatrix(variants: AdminVariantDto[]): VariantMatrix` (kind from presence of size/color; cells from existing variants; price `''` when `priceBaht` null)
  - `normalizeOptionValue(raw: string): string` (trim, collapse inner spaces)
  - `addOptionValue(values: string[], raw: string): { values: string[] } | { error: string }` — empty → error `"กรุณากรอกค่า"`, > 100 chars → `"ยาวเกิน 100 ตัวอักษร"`, duplicate (case-insensitive after normalize) → `"ค่านี้มีอยู่แล้ว"`
  - `syncCells(matrix: VariantMatrix): VariantMatrix` (one cell per size×color combination for the kind; keeps existing cell state; `none` → single cell with nulls)
  - `buildVariantPayload(existing: AdminVariantDto[], matrix: VariantMatrix): { variants: VariantInput[] } | { error: string }` — rules spec §7.1 step 5; price via `parseBahtInput` (invalid → error `"ราคาไม่ถูกต้อง"`); zero cells to send → error `"ต้องมีตัวเลือกอย่างน้อย 1 รายการ"`.
- Produces: `VariantMatrixEditor` props `{ product: AdminProductDto; onSaved(p: AdminProductDto): void }` (calls `merchandiseApi.replaceVariants` with `expectedVersion: product.version`).

- [ ] **Step 1: Write failing tests** `merchandiseVariants.test.ts`:
  - `inferMatrix` of one default variant → kind `none`; of S/M variants → kind `size`, sizes `["S","M"]`
  - **Review Focus 3:** `addOptionValue(["M"], " m ")` → `{ error: "ค่านี้มีอยู่แล้ว" }`; `addOptionValue([], "  Extra   Large ")` → values `["Extra Large"]`
  - `syncCells` for sizes `["S","M"]` × colors `["แดง","ดำ"]` kind `size_color` → 4 cells, existing cell state preserved
  - `buildVariantPayload`: existing S(id a) and M(id b), matrix keeps S enabled price `"250"`, M disabled, adds L enabled price `""` → `[{ id:"a", sizeTh:"S", colorTh:null, priceBaht:250, saleEnabled:true }, { id:"b", ..., saleEnabled:false }, { sizeTh:"L", colorTh:null, priceBaht:null, saleEnabled:true }]`
  - unticked never-existing cell is not sent; existing variant whose size value was removed is not sent
  - switching from `none` (default variant id d) to `size` with S → payload has no `id: "d"`
  - price `"12.5"` → `{ error: "ราคาไม่ถูกต้อง" }`
- [ ] **Step 2: Run** `npx tsx --test src/lib/merchandiseVariants.test.ts` → FAIL.
- [ ] **Step 3: Implement** the module, then `VariantMatrixEditor` per spec §7.1 (kind radio, chip inputs with move left/right, grid table with checkbox + price input showing base price placeholder, helper texts verbatim; `MERCH_VARIANT_IN_BUNDLE` shows its Thai copy).
- [ ] **Step 4: Run** tests → PASS; `npx tsc --noEmit`; `npm run lint`.
- [ ] **Step 5: Commit** — `feat(merchandise): add variant matrix logic and editor`.

---

### Task 8: Product list

**Files:**
- Create: `src/components/merchandise/ProductList.tsx`, `src/app/merchandise/products/page.tsx`

**Interfaces:**
- Consumes: `merchandiseApi.listProducts`, `listCategories`, `createProduct`, `bulkProducts`, `orderProducts`, label helpers, `formatBaht`, `merchHref`.

- [ ] **Step 1: Implement** spec §6.3: filters (search debounced with `useDebounce` 300 ms, status, kind, category) reflected in the URL query; create modal (kind + name, required ≤ 300) → `createProduct` → navigate to editor; table columns as spec; price text: `exact` → `formatBaht`, `from` → `"เริ่ม " + formatBaht`, null → `"ยังไม่ตั้งราคา"`; row checkboxes + action bar (เปิดขาย / ปิดขาย / ย้ายหมวด…) → `bulkProducts` in chunks of 200, failed rows listed with their Thai error; reorder mode only when no filter: up/down per row, "บันทึกลำดับ" → `orderProducts(all ids in displayed order)`, "ยกเลิก".
- [ ] **Step 2: Verify** `npx tsc --noEmit`, `npm run lint`.
- [ ] **Step 3: Commit** — `feat(merchandise): add product list with bulk actions and ordering`.

---

### Task 9: Product editor and bundle components

**Files:**
- Create: `src/components/merchandise/ProductEditor.tsx`, `src/components/merchandise/BundleComponentsEditor.tsx`, `src/app/merchandise/products/[productId]/page.tsx`

**Interfaces:**
- Consumes: `merchandiseApi.getProduct`, `updateProduct`, `publishProduct`, `unpublishProduct`, `replaceComponents`, `listProducts({ kind: 'single' })`, `listCategories`; `ImageManager` (Task 6); `VariantMatrixEditor` (Task 7); `publishIssueLabel`, `publishIssuesFromError`, `parseBahtInput`.
- Produces: `BundleComponentsEditor` props `{ product: AdminProductDto; singles: AdminProductDto[]; onSaved(p: AdminProductDto): void }`.

- [ ] **Step 1: Implement** spec §6.4 and §7.2:
  - Header (name, badges, "ดูตัวอย่าง" → `merchHref('/merchandise/preview', eventId, { productId })`, publish/unpublish; publish disabled while `publishIssues` non-empty; on `MERCH_PUBLISH_INCOMPLETE` show `publishIssuesFromError`).
  - Amber issues box listing `publishIssues` in Thai.
  - Sections each with own save button and the latest `version`: ข้อมูลหลัก (`updateProduct`; size chart only for single), รูปสินค้า (`ImageManager` max 20 → save `updateProduct({ expectedVersion, imageIds })`), ตัวเลือกไซซ์/สี (single → `VariantMatrixEditor`), ส่วนประกอบ Bundle (bundle → `BundleComponentsEditor`). After any save replace the whole page state with the returned `AdminProductDto`.
  - Bundle editor: rows (product select of singles, quantity 1–9999, mode fixed/selectable; product without options → mode forced fixed with its single variant), add/remove/move rows, "ราคาซื้อแยกรวม" info (sum of each component's lowest enabled price × quantity, shown with `formatBaht`, or "—" if any price missing), warning when a component product is not `saleEnabled` or not published, save → `replaceComponents({ expectedVersion, components })`.
- [ ] **Step 2: Verify** `npx tsc --noEmit`, `npm run lint`.
- [ ] **Step 3: Commit** — `feat(merchandise): add product editor with images, variants and bundle components`.

---

### Task 10: Store preview

**Files:**
- Create: `src/components/merchandise/StorePreview.tsx`, `src/app/merchandise/preview/page.tsx`

**Interfaces:**
- Consumes: `merchandiseApi.previewStore`, `previewProduct`, `listProducts({})`, `formatBaht`, `unavailableLabel`.

- [ ] **Step 1: Implement** spec §6.7: amber banner text verbatim; first banner image + production/shipping info; category filter buttons; responsive card grid (image, name, price, `ฉบับร่าง` badge when the product's `publishState` is `draft` from `listProducts`, `ซื้อไม่ได้: <reasons>` when `purchasable` false); click → detail panel (modal-overlay) loaded with `previewProduct`: image gallery with thumbnails, description, size chart (pre-wrap), variant pickers only when `hasOptions` (selected variant shows its own price, else product price), bundle components list (fixed shows its variant; selectable lists allowed options), disabled "หยิบใส่ตะกร้า" button; `?productId=` opens the panel on load. Only existing Backoffice classes.
- [ ] **Step 2: Verify** `npx tsc --noEmit`, `npm run lint`.
- [ ] **Step 3: Commit** — `feat(merchandise): add storefront preview`.

---

### Task 11: Orders list and order detail (view, payment check, resend, shipment)

**Files:**
- Create: `src/components/merchandise/OrdersTable.tsx`, `src/components/merchandise/OrderDetail.tsx`, `src/components/merchandise/ShipmentModal.tsx`, `src/components/merchandise/ResendNotificationModal.tsx`, `src/app/merchandise/orders/page.tsx`, `src/app/merchandise/orders/[orderId]/page.tsx`

**Interfaces:**
- Consumes: `merchandiseApi.listOrders`, `downloadOrdersXlsx`, `getOrder`, `checkOrderPayment`, `resendNotification`, `setShipment`; `orderFilterQuery`; label helpers.
- Produces: `OrderDetail` exposes an "แก้ไขคำสั่งซื้อ" button that renders `OrderEditModal` (Task 12) — until Task 12 lands, the button is rendered disabled with title `"เร็วๆ นี้"`. `ShipmentModal` props `{ order: AdminOrderDetail; onSaved(summary: OrderSummary): void; onClose(): void }`.

- [ ] **Step 1: Implement** spec §6.8 (filters in URL query, debounce search, date inputs, Excel button with spinner, table, `Pagination` limit 20, "จัดส่งแบบ Bulk" link) and §6.9 sections 1–7 + §7.5:
  - "ตรวจสอบการชำระ" → `checkOrderPayment` replaces page state, toast with the resulting `paymentStateLabel`.
  - Resend modal: reason required ≤ 1,000; `unknown` warning text verbatim; only for `failed`/`unknown`.
  - Shipment modal: carrier/tracking 1–100 each; reason required when already shipped; texts verbatim; tracking kept as typed (string).
  - Audit entries with `<details>` showing `JSON.stringify(before/after, null, 2)` in a `<pre>`.
- [ ] **Step 2: Verify** `npx tsc --noEmit`, `npm run lint`.
- [ ] **Step 3: Commit** — `feat(merchandise): add orders list and order detail`.

---

### Task 12: Order edit logic and modal

**Files:**
- Create: `src/lib/merchandiseOrderEdit.ts`, `src/lib/merchandiseOrderEdit.test.ts`, `src/components/merchandise/OrderEditModal.tsx`
- Modify: `src/components/merchandise/OrderDetail.tsx` (enable the edit button)

**Interfaces:**
- Produces (`merchandiseOrderEdit.ts`):
  - `type EditLine = { kind: 'source'; sourceItemId: string; quantity: number; unitPriceBaht: number } | { kind: 'new'; productId: string; variantId: string | null; bundleSelections: { componentId: string; variantId: string }[]; quantity: number; unitPriceBaht: number | null }`
  - `computeEditedTotal(lines: EditLine[]): { subtotalBaht: number; totalBaht: number } | null` (null when any new line price is null; shipping 50)
  - `normalizePhone(raw: string): string | null` (same rules as API: strip spaces/dashes/parentheses, `+66` → `0`, 9–10 digits starting with 0)
  - `buildOrderEditPayload(order: AdminOrderDetail, draft: { recipient: Recipient; lines: EditLine[]; reason: string; contactConfirmed: boolean; contactNote: string }): { payload: OrderEditInput } | { error: string }` — sends `recipient` only if changed, `lines` only if changed (source lines with quantity 0 dropped); errors: no change → `"ไม่มีการเปลี่ยนแปลง"`; empty reason → `"กรุณาระบุเหตุผล"`; all lines removed → `"คำสั่งซื้อต้องมีสินค้าอย่างน้อย 1 รายการ"`; paid and (not contactConfirmed or empty note) → `"กรุณายืนยันว่าติดต่อผู้ซื้อแล้ว และบันทึกการติดต่อ"`; paid and new total ≠ `order.amounts.totalBaht` → `"ออเดอร์ที่ชำระแล้วต้องมียอดรวมเท่าเดิม"`; invalid phone → `"เบอร์โทรไม่ถูกต้อง"`; postal code not 5 digits → `"รหัสไปรษณีย์ต้องเป็นตัวเลข 5 หลัก"`.
- Consumes: `merchandiseApi.editOrder`, `listProducts({ status: 'published' })`.

- [ ] **Step 1: Write failing tests** `merchandiseOrderEdit.test.ts` (build a minimal `AdminOrderDetail` fixture in the test):
  - `computeEditedTotal` keeps source unit price; quantity 0 removes; new line adds; +50 shipping; null new price → null
  - `normalizePhone("081-234-5678") === "0812345678"`, `"+66 81 234 5678"` → `"0812345678"`, `"12345"` → null
  - recipient-only change → payload has `recipient`, no `lines`
  - **Review Focus 4:** all source lines set to 0 and no new lines → `{ error: "คำสั่งซื้อต้องมีสินค้าอย่างน้อย 1 รายการ" }`
  - paid order, contact missing → contact error; paid, total changed → total error; paid, same total with contact → payload includes `contactConfirmed: true` and `contactNote`
  - nothing changed → `"ไม่มีการเปลี่ยนแปลง"`
- [ ] **Step 2: Run** `npx tsx --test src/lib/merchandiseOrderEdit.test.ts` → FAIL.
- [ ] **Step 3: Implement** the module and `OrderEditModal` per spec §7.4 (sections 1–8; button disabled when `payment.state` is `qr_active` or `verifying` with tooltip from spec; add-line picker uses published products, variant select for singles, selectable components for bundles; price shown from catalog: variant `priceBaht ?? basePriceBaht`, bundle `basePriceBaht`; totals old vs new; paid warning and contact fields; save disabled when payload builder returns an error, showing that error; success replaces the detail page state).
- [ ] **Step 4: Run** tests → PASS; `npx tsc --noEmit`; `npm run lint`.
- [ ] **Step 5: Commit** — `feat(merchandise): add audited order edit modal`.

---

### Task 13: Bulk shipping

**Files:**
- Create: `src/lib/merchandiseShipping.ts`, `src/lib/merchandiseShipping.test.ts`, `src/components/merchandise/BulkShipping.tsx`, `src/app/merchandise/shipping/page.tsx`

**Interfaces:**
- Produces (`merchandiseShipping.ts`):
  - `type ShipmentDraft = { orderNumber: string; carrier: string; trackingId: string }`
  - `parseShipmentPaste(text: string, known: Set<string>): { rows: ShipmentDraft[]; unknownOrders: string[]; incomplete: string[]; duplicates: string[] }` — split lines on `\r?\n`; split columns on `\t` if present else `,`; trim cells; first column uppercased; skip blank lines and lines whose first cell does not match `^[A-Z0-9]+-M-\d{6}$`; rows need non-empty carrier and tracking else go to `incomplete` (by order number); order not in `known` → `unknownOrders`; repeated order → last wins and number listed in `duplicates`; tracking kept as text (leading zeros).
  - `applyShipmentDrafts(current: Record<string, { carrier: string; trackingId: string }>, drafts: ShipmentDraft[], overwrite: boolean): Record<string, { carrier: string; trackingId: string }>` — fills only empty fields unless `overwrite`.
  - `fillCarrierForEmpty(current, carrier: string)` — sets carrier only where empty; never touches tracking.
- Consumes: `merchandiseApi.listOrders` (paid + not_shipped, limit 100, loop pages), `bulkShipments`.

- [ ] **Step 1: Write failing tests** `merchandiseShipping.test.ts`:
  - **Review Focus 1:** `"เลขออเดอร์\tขนส่ง\tTracking\r\nPRIS2026-M-000001\tKerry\t00123\t\r\n\r\npris2026-m-000002 , Flash , TH999\r\n"` with known `{PRIS2026-M-000001, PRIS2026-M-000002}` → rows `[{ PRIS2026-M-000001, Kerry, "00123" }, { PRIS2026-M-000002, Flash, "TH999" }]`, header skipped
  - extra columns ignored; missing tracking → `incomplete`; unknown order → `unknownOrders`; duplicate order → last wins + `duplicates`
  - `applyShipmentDrafts` doesn't overwrite a filled field unless `overwrite` true
  - `fillCarrierForEmpty` never changes `trackingId`
- [ ] **Step 2: Run** `npx tsx --test src/lib/merchandiseShipping.test.ts` → FAIL.
- [ ] **Step 3: Implement** the module and `BulkShipping` per spec §6.10 (load all pages; table with inputs; paste textarea + "เติมจากข้อความที่วาง" + overwrite checkbox + result summary; "ขนส่งเดียวกันทุกแถว" input + apply; submit only complete rows in chunks of 500 with each row's `version`; success rows removed after reload + toast `บันทึกการจัดส่งแล้ว n รายการ`; failed rows keep values and show Thai error; helper text verbatim).
- [ ] **Step 4: Run** tests → PASS; `npx tsc --noEmit`; `npm run lint`.
- [ ] **Step 5: Commit** — `feat(merchandise): add bulk shipping with paste from Excel`.

---

### Task 14: Payment reviews and production report

**Files:**
- Create: `src/components/merchandise/PaymentReviews.tsx`, `src/components/merchandise/ProductionReport.tsx`, `src/app/merchandise/reviews/page.tsx`, `src/app/merchandise/production/page.tsx`

**Interfaces:**
- Consumes: `merchandiseApi.listReviews`, `resolveReview`, `production`, `downloadProductionXlsx`; `useMerchandise().reloadReviews`; `reviewReasonLabel`.

- [ ] **Step 1: Implement** spec §6.11 (unresolved/resolved toggle, table, resolve modal with required note ≤ 1,000, after resolve `reloadReviews()` and refresh list, helper text verbatim) and §6.12 (table + totals row + Excel button + helper text verbatim).
- [ ] **Step 2: Verify** `npx tsc --noEmit`, `npm run lint`.
- [ ] **Step 3: Commit** — `feat(merchandise): add payment reviews and production report`.

---

### Task 15: Full verification and manual test checklist

**Files:**
- Create: `docs/merchandise-backoffice-manual-test.md`

- [ ] **Step 1: Write the checklist** (Thai) from spec §9 "ทดสอบมือ", one checkbox per step, plus: how to run (`npm run dev` on port 3001 with `NEXT_PUBLIC_API_URL` pointing at the local API on 3002), the screen widths to check (375 px, 1440 px), and Review Focus checks that are UI-only: version conflict keeps form values (open the same product in two tabs, save both), double-click on save creates one record.
- [ ] **Step 2: Run everything**
  - `npx tsx --test "src/lib/merchandise*.test.ts"` → all pass
  - `npx tsc --noEmit` → clean
  - `npm run lint` → no errors in `src/**/merchandise*`, `src/app/merchandise/**`, `src/components/merchandise/**`, `Sidebar.tsx`, `api.ts`
  - `npm run format:check` → clean for changed files
  - `npm run build` → success, routes `/merchandise/**` listed
- [ ] **Step 3: Commit** — `docs(merchandise): add backoffice manual test checklist`.
