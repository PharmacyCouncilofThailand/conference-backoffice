# Lucky Wheel admin layout implementation plan

**Goal:** Make the existing Lucky Wheel administration screen coherent and usable on mobile and desktop without changing business behavior.

**Architecture:** Refine the existing page and focused Lucky Wheel components. Reuse ConferenceHub styles, API hooks, and state management. Add presentational classes only where needed.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS 4, Tabler icons.

## Constraints

- Scope: `conference-backoffice` only.
- Keep existing API calls, validation, confirmations, idempotency keys, and permissions.
- No database migration, server change, or new dependency.
- Verify each task with scoped ESLint and TypeScript; run production build after all tasks.

### Task 1: Operational page shell and first setup

- [x] Refine `src/app/lucky-wheel/page.tsx` top hierarchy: event picker, wheel status, pause action, tab navigation, and first-time setup state.
- [x] Check loading, missing wheel, and API error states remain distinct.
- [x] Run `npx eslint src/app/lucky-wheel/page.tsx` and `npx tsc --noEmit`.

### Task 2: Configuration and QR workflow

- [x] Refine `src/components/lucky-wheel/WheelConfiguration.tsx` into ordered segment cards and a distinct collection section.
- [x] Refine `src/components/lucky-wheel/QrRights.tsx` to show the date → time → QR → recipients sequence, with readable responsive cards and controls.
- [x] Run scoped ESLint and `npx tsc --noEmit`.

### Task 3: Stock, results, and collection

- [x] In `src/app/lucky-wheel/page.tsx`, add narrow-screen stock and result cards while retaining large-screen tabular views and pagination.
- [x] Refine `src/components/lucky-wheel/RewardCollection.tsx` and `StockAdjustmentDialog.tsx` for task hierarchy and mobile controls.
- [x] Run scoped ESLint and `npx tsc --noEmit`.

### Task 4: Final verification

- [x] Check responsive overflow and keyboard focus in the resulting markup.
- [x] Run `npm run build` and `git diff --check`.
- [x] Review that no API, permission, or data behavior changed.

Visual browser verification after login remains pending: the local sign-in page displayed a development account, but the server rejected it. No authentication bypass or data mutation was attempted.
