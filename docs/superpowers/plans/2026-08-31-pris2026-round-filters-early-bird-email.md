# PRIS 2026 Abstract Round Filters and Early Bird Manual Email Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update `conference-backoffice` so staff can filter/export PRIS 2026 abstracts by Round 1/2 and send the new API-provided PRIS Early Bird reminder template to the correct eligible audience without duplicating business logic in the frontend.

**Architecture:** Keep all pricing/recipient eligibility inside `conference-api`. Backoffice only maps the selected PRIS round to generic API date parameters (`submittedFrom`, `submittedBefore`) and renders the new `pris-early-bird-reminder` template returned by `/api/backoffice/email-manual/templates`. The UI must never calculate account/abstract eligibility or purchase status itself.

**Tech Stack:** Next.js 16.1, React 19.2, TypeScript 5, Tailwind CSS 4, existing fetch/API client, `xlsx`, ESLint. No new dependency or test framework.

## Global Constraints

- Depend on API plan `conference-api/docs/superpowers/plans/2026-08-31-pris2026-round2-pricing-abstract-policy.md`.
- Round 1 API range: no lower bound required for PRIS UI; `submittedBefore=2026-08-31T17:00:00.000Z`.
- Round 2 API range: `submittedFrom=2026-08-31T17:00:00.000Z` and `submittedBefore=2026-09-20T17:00:00.000Z`.
- Use `abstracts.created_at` through API filters. Do not create/use a DB `round` field.
- Show PRIS Round filter only when selected Event code is `PRIS-2026`; do not apply PRIS dates to other events.
- Round filter must apply identically to on-screen list and Excel export.
- Do not alter reviewer/organizer event/category/presentation access rules.
- Manual email UI must not calculate Early Bird eligibility. API recipients are authoritative.
- Result emails from Approve/Reject are sent by API automatically; this repo does not add purchase checks to action modals.
- New manual template ID is exactly `pris-early-bird-reminder`.
- Manual recipient list from API contains only eligible, unpaid users. Backoffice may search/select/preview/validate/send only within that set.
- Preserve current Manual Email preview, dry-run validation, actual send, skipped/failed result display.
- No Round 2 result date is known; do not display one.
- No new npm dependencies.

---

## Cross-Repo Contracts Consumed

### Abstract list query

```http
GET /api/backoffice/abstracts?eventId=<id>&submittedFrom=<ISO>&submittedBefore=<ISO>
Authorization: Bearer <backoffice-token>
```

`submittedFrom` is inclusive. `submittedBefore` is exclusive.

### Manual email template

```text
Template ID: pris-early-bird-reminder
Recipient type: user
```

Existing endpoints stay unchanged:

```http
GET  /api/backoffice/email-manual/templates
GET  /api/backoffice/email-manual/recipients?eventId=<id>&template=pris-early-bird-reminder&q=<optional>
GET  /api/backoffice/email-manual/render?eventId=<id>&template=pris-early-bird-reminder&id=<userId>
POST /api/backoffice/email-manual
```

Do not send cutoff dates or eligibility flags from frontend.

---

## File Map

**Create:**
- `src/lib/pris2026AbstractRounds.ts` — UI-only mapping from PRIS round IDs to the generic API date query contract.

**Modify:**
- `src/types/api.ts` — add reusable event option code support only if needed by abstract page types; no API eligibility types.
- `src/app/abstracts/page.tsx` — PRIS round selector, query mapping, export mapping, round reset behavior.
- `src/app/email-manual/page.tsx` — expose new manual template in template group and improve recipient context copy for this template.

**Verify only:**
- `src/lib/api.ts` — existing `api.abstracts.list(token, query)` already supports arbitrary query string and requires no contract rewrite unless TypeScript types are tightened during implementation.

---

### Task 1: Add One PRIS Abstract Round Mapping Helper

**Files:**
- Create: `src/lib/pris2026AbstractRounds.ts`

**Interfaces:**
- Consumes UI round ID.
- Produces generic query parameters; no pricing logic.

```ts
export const PRIS_2026_EVENT_CODE = "PRIS-2026" as const;

export type Pris2026AbstractRoundFilter = "" | "round1" | "round2";

export const PRIS_2026_ABSTRACT_ROUND_OPTIONS = [
  { id: "round1", label: "Round 1", detail: "Submitted through 31 Aug 2026, 23:59" },
  { id: "round2", label: "Round 2", detail: "Submitted 1–20 Sep 2026" },
] as const;

export function getPris2026RoundQuery(round: Pris2026AbstractRoundFilter): {
  submittedFrom?: string;
  submittedBefore?: string;
} {
  if (round === "round1") {
    return { submittedBefore: "2026-08-31T17:00:00.000Z" };
  }
  if (round === "round2") {
    return {
      submittedFrom: "2026-08-31T17:00:00.000Z",
      submittedBefore: "2026-09-20T17:00:00.000Z",
    };
  }
  return {};
}
```

- [ ] **Step 1: Create helper exactly once**

Do not duplicate cutoff constants inside `page.tsx` and export handler.

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

Expected: no new ESLint errors.

- [ ] **Step 3: Run build**

```bash
npm run build
```

Expected: Next.js production build PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/pris2026AbstractRounds.ts
git commit -m "feat: define PRIS abstract round filters"
```

---

### Task 2: Preserve Event Code in Abstract Filter Options

**Files:**
- Modify: `src/app/abstracts/page.tsx:148-190`
- Modify: `src/types/api.ts:15-31` only if a shared option type is preferred.

**Interfaces:**
- Consumes admin event API rows (`eventCode`, `eventName`) and non-admin `AssignedEvent.code`.
- Produces local options with `{ id, code, name }` so PRIS-specific round controls are not shown for unrelated events.

- [ ] **Step 1: Change local option shape**

From:

```ts
const [eventOptions, setEventOptions] = useState<{ id: number; name: string }[]>([]);
```

To:

```ts
const [eventOptions, setEventOptions] = useState<{
  id: number;
  code: string;
  name: string;
}[]>([]);
```

- [ ] **Step 2: Map admin event code**

```ts
setEventOptions(
  (res.events as any[]).map((e) => ({
    id: e.id as number,
    code: String(e.eventCode || ""),
    name: e.eventName as string,
  })),
);
```

- [ ] **Step 3: Map assigned-event code for non-admin**

```ts
setEventOptions(
  user.assignedEvents.map((e) => ({
    id: e.id,
    code: e.code,
    name: e.name,
  })),
);
```

- [ ] **Step 4: Derive selected event**

```ts
const selectedEvent = useMemo(
  () => eventOptions.find((event) => String(event.id) === eventFilter) ?? null,
  [eventOptions, eventFilter],
);
const isPris2026Event = selectedEvent?.code === PRIS_2026_EVENT_CODE;
```

Do not infer PRIS from display name.

- [ ] **Step 5: Verify auto-select still works**

One assigned event must still auto-select exactly as current behavior.

- [ ] **Step 6: Run lint/build**

```bash
npm run lint
npm run build
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/app/abstracts/page.tsx src/types/api.ts
git commit -m "refactor: preserve event code in abstract filters"
```

---

### Task 3: Add PRIS Round Filter to Abstract List

**Files:**
- Modify: `src/app/abstracts/page.tsx:148-330`
- Modify: `src/app/abstracts/page.tsx:520-590`
- Consume: `src/lib/pris2026AbstractRounds.ts`

**Interfaces:**
- Consumes `getPris2026RoundQuery(roundFilter)`.
- Produces list query with generic API date parameters.

- [ ] **Step 1: Add round state**

```ts
const [roundFilter, setRoundFilter] = useState<Pris2026AbstractRoundFilter>("");
```

- [ ] **Step 2: Reset round when event changes away from PRIS**

Add effect:

```ts
useEffect(() => {
  if (!isPris2026Event && roundFilter) {
    setRoundFilter("");
    setPage(1);
  }
}, [isPris2026Event, roundFilter]);
```

This prevents PRIS date filters leaking into another event after dropdown change.

- [ ] **Step 3: Add round dependency to fetch effect**

Current fetch effect must include `roundFilter`.

- [ ] **Step 4: Append generic date query in `fetchAbstracts()`**

```ts
if (isPris2026Event && roundFilter) {
  const roundQuery = getPris2026RoundQuery(roundFilter);
  if (roundQuery.submittedFrom) params.submittedFrom = roundQuery.submittedFrom;
  if (roundQuery.submittedBefore) params.submittedBefore = roundQuery.submittedBefore;
}
```

Keep status/category/presentation/event/search filters unchanged and additive.

- [ ] **Step 5: Render selector only for PRIS**

Place next to current category/presentation/status filters:

```tsx
{isPris2026Event && (
  <select
    value={roundFilter}
    onChange={(e) => {
      setRoundFilter(e.target.value as Pris2026AbstractRoundFilter);
      setPage(1);
    }}
    className="input-field w-full"
  >
    <option value="">All Rounds</option>
    <option value="round1">Round 1 — through 31 Aug 2026</option>
    <option value="round2">Round 2 — 1–20 Sep 2026</option>
  </select>
)}
```

Do not show a Round 2 result/announcement date.

- [ ] **Step 6: Verify filter interactions manually**

Required cases:

```text
PRIS + Round1 + Pending -> only pending Round1
PRIS + Round2 + Accepted -> only accepted Round2
PRIS + All Rounds -> no submitted date params
Other event -> round selector hidden and no submitted date params
```

- [ ] **Step 7: Run lint/build**

```bash
npm run lint
npm run build
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/app/abstracts/page.tsx src/lib/pris2026AbstractRounds.ts
git commit -m "feat: filter PRIS abstracts by round"
```

---

### Task 4: Make Excel Export Honor Round Filter Exactly

**Files:**
- Modify: `src/app/abstracts/page.tsx:240-315`

**Interfaces:**
- Consumes same `getPris2026RoundQuery()` as list fetch.
- Produces export API query matching visible filters.

- [ ] **Step 1: Add date params to `handleExport()`**

Use same helper, not duplicated dates:

```ts
if (isPris2026Event && roundFilter) {
  const roundQuery = getPris2026RoundQuery(roundFilter);
  if (roundQuery.submittedFrom) params.submittedFrom = roundQuery.submittedFrom;
  if (roundQuery.submittedBefore) params.submittedBefore = roundQuery.submittedBefore;
}
```

- [ ] **Step 2: Add round to filename when selected**

Recommended filename:

```ts
const roundSuffix = roundFilter ? `_${roundFilter}` : "";
exportToExcel(
  rows,
  `abstracts_${eventName.replace(/\s+/g, "_")}${roundSuffix}`,
);
```

Do not change exported column content unless needed for existing behavior.

- [ ] **Step 3: Compare screen count vs export count**

Manual contract check with seeded data:
- select Round 1;
- note `totalCount`;
- export;
- rows must equal all API results for same filter (up to existing 1000 export cap).

If PRIS round has >1000 records, treat existing export cap as separate issue; do not change pagination architecture in this scope without evidence.

- [ ] **Step 4: Run lint/build**

```bash
npm run lint
npm run build
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/abstracts/page.tsx
git commit -m "fix: apply PRIS round filter to abstract export"
```

---

### Task 5: Expose New Manual Early Bird Template in UI

**Files:**
- Modify: `src/app/email-manual/page.tsx:45-70`

**Interfaces:**
- Consumes API template entry with ID `pris-early-bird-reminder`.
- Produces selectable button in current Manual Email page.

- [ ] **Step 1: Add template ID to Registration group**

Change group to:

```ts
{
  category: "Registration",
  templates: [
    "pris-early-bird-reminder",
    "manual-registration",
    "event-reminder",
  ],
},
```

The button renders only when API `/templates` actually returns the template, because current UI resolves each configured ID against server-provided list. This makes deployment backward-safe: old API means no button.

- [ ] **Step 2: Do not add local eligibility calculations**

No cutoff comparison, abstract fetch, registration fetch, or ticket lookup in backoffice. `recipients` endpoint remains authoritative.

- [ ] **Step 3: Run lint/build against API-compatible types**

```bash
npm run lint
npm run build
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/email-manual/page.tsx
git commit -m "feat: expose PRIS Early Bird manual email"
```

---

### Task 6: Improve Manual Reminder Recipient Context Without Changing Eligibility

**Files:**
- Modify: `src/app/email-manual/page.tsx:350-530`

**Interfaces:**
- Consumes API recipient `detail`/`tag` and selected template metadata.
- Produces clearer operator messaging before mass send.

- [ ] **Step 1: Add template-specific explanatory callout**

When `selectedTemplateId === "pris-early-bird-reminder"`, show:

```tsx
<div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
  รายชื่อด้านล่างถูกคัดจาก API แล้ว: บัญชีสร้างก่อน cutoff, มี PRIS 2026 abstract ก่อน cutoff และยังไม่มี confirmed primary registration. ระบบจะตรวจสิทธิ์ซ้ำตอน Preview / Validate / Send.
</div>
```

This is operator explanation only. No frontend filtering.

- [ ] **Step 2: Add deadline warning to same callout**

State fixed deadline `15 Sep 2026 23:59 Bangkok`. Do not derive from browser local date.

- [ ] **Step 3: Preserve skipped-result visibility**

Current result table already shows `skipped` reason. Verify API skip such as `User already has a confirmed primary registration` remains visible after actual send/validate.

- [ ] **Step 4: Preserve Select All semantics**

`Select All` still means all API-returned visible recipients. Do not label it as “all eligible users in DB” because API currently caps recipient list at 500.

- [ ] **Step 5: Run lint/build**

```bash
npm run lint
npm run build
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/email-manual/page.tsx
git commit -m "chore: clarify PRIS reminder audience"
```

---

### Task 7: Cross-Repo Contract Smoke Test

**Files:**
- No code change expected.

**Interfaces:**
- Consumes deployed API from API plan Tasks 7 and 10.
- Produces verified backoffice behavior.

- [ ] **Step 1: Test Round 1 network request**

Select PRIS 2026 + Round 1. Browser network query must contain:

```text
eventId=<pris-event-id>
submittedBefore=2026-08-31T17:00:00.000Z
```

and no `submittedFrom`.

- [ ] **Step 2: Test Round 2 network request**

Must contain:

```text
submittedFrom=2026-08-31T17:00:00.000Z
submittedBefore=2026-09-20T17:00:00.000Z
```

- [ ] **Step 3: Test non-PRIS event**

Round selector hidden. Request contains neither submitted date parameter.

- [ ] **Step 4: Test Excel export**

Repeat Round1/2 and confirm export network request uses identical date filters.

- [ ] **Step 5: Test Manual Email lifecycle**

For `PRIS Early Bird Reminder`:
1. select event;
2. recipients load from API;
3. search narrows list;
4. preview one recipient;
5. Validate selected recipients;
6. actual send only after explicit browser confirm;
7. skipped rows remain visible with reason.

- [ ] **Step 6: Verify no purchase check was added to Approve/Reject UI**

Approve/Reject action still calls existing `api.abstracts.updateStatus` once. API owns result email notice/purchase behavior.

- [ ] **Step 7: Final repository verification**

```bash
npm run lint
npm run build
git status --short
```

Expected: lint/build PASS; clean after commits.

---

## Final Acceptance Checklist

- [ ] PRIS event options preserve `eventCode` and identify `PRIS-2026` exactly.
- [ ] Round selector appears only for PRIS 2026.
- [ ] Round 1 maps to exclusive Sep1 Bangkok cutoff.
- [ ] Round 2 maps to Sep1 inclusive / Sep21 Bangkok exclusive API range.
- [ ] Changing to another event clears PRIS round filter.
- [ ] Existing status/category/presentation/search/event filters still combine with round.
- [ ] Excel export sends same round filters as list.
- [ ] No Round 2 result date displayed.
- [ ] `pris-early-bird-reminder` appears only when API advertises it.
- [ ] Backoffice performs no Early Bird eligibility calculation.
- [ ] Manual Preview/Validate/Send still use API and expose skipped reasons.
- [ ] Approve/Reject UI does not add purchase-status lookup.
- [ ] No new dependencies.
- [ ] `npm run lint` and `npm run build` pass.
