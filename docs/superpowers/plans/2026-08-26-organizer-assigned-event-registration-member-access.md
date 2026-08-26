# Organizer Assigned-Event Registration & Member Access Implementation Plan

**Goal:** Allow backoffice users with role `organizer` to view Registrations and Members only for events assigned to them, while preserving full Admin behavior and preventing cross-event data leakage or write escalation.

**Architecture:** Reuse the existing `staffEventAssignments` authorization model. The frontend exposes only read-oriented navigation/actions for organizers and derives event choices from the already assignment-scoped Events API. The API remains authoritative: list/detail/stats reads are constrained to assigned event IDs, explicit `eventId` values outside scope are not accessible, and destructive/management endpoints remain Admin-only for this feature.

**API design principles applied:** least privilege, resource-scoped authorization, server-side enforcement, consistent non-disclosure for out-of-scope exact lookups, backward-compatible response shapes, and no new persistence model or migration.

## Brainstorming decision

### Option A — Frontend-only visibility
Add `/registrations` to the organizer menu/route allowlist and rely on event dropdown filtering.

**Rejected:** UI hiding is not authorization. Direct API calls or crafted IDs could expose registration/member detail or global member statistics.

### Option B — Add a new role/permission table
Create explicit registration/member permissions per organizer/event.

**Rejected:** `staffEventAssignments` already models the exact event scope. A second permission source would duplicate state and create drift.

### Option C — Reuse assignment-scoped RBAC end-to-end
Use the existing organizer assignments in frontend navigation and enforce the same event scope in API reads. Keep organizer access read-only for Registration/Member management operations.

**Selected:** smallest coherent change, no migration, least privilege, and consistent with existing Events/Registrations list filtering.

## Permission matrix

| Capability | Admin | Organizer |
| --- | --- | --- |
| Open `/registrations` | Yes | Yes |
| List registrations | All events | Assigned events only |
| Registration detail | Any event | Assigned events only |
| Add/update registration | Existing Admin capability | No |
| Open `/members` | Yes | Yes |
| List members | All users / optional event filter | Members registered in assigned events only |
| Member stats | Global | Assigned-event member population only |
| Member detail API | Any member | Only members registered in assigned events |
| Delete member | Yes | No |
| Event dropdown | All events | Assigned events only (existing Events API behavior) |

## Task 1: Backoffice navigation and read-only UI

**Files:**
- Modify `src/contexts/AuthContext.tsx`
- Modify `src/components/layout/Sidebar.tsx`
- Modify `src/app/registrations/page.tsx`
- Modify `src/app/members/page.tsx`

Steps:
1. Add `/registrations` to organizer page access so AuthGuard permits list and detail routes through prefix matching.
2. Include `All Registrations` in the organizer Registrations submenu alongside existing Verification.
3. On Registrations page, read the authenticated user role and hide `Add Registration` for organizer while retaining list/detail/export read behavior.
4. On Members page, hide delete controls/modal for organizer and make the organizer view event-scoped.
5. Keep Admin UI behavior unchanged.

## Task 2: Secure Registration API reads and writes

**File:** `conference-api/src/routes/backoffice/registrations.ts`

Steps:
1. Reuse `staffEventAssignments` for non-admin registration scope.
2. Keep the existing list filter and ensure explicit event filters can never broaden scope.
3. Scope `GET /registrations/:id` to assigned events for non-admin users. Return 404 for missing and out-of-scope registrations to avoid resource enumeration.
4. Make registration mutation endpoints used by management UI Admin-only for this feature (`PATCH /:id`, manual add, batch add, add sessions, registered-users helper used by add flow), returning 403 for organizer.
5. Preserve existing success response shapes and Admin behavior.

## Task 3: Secure Members API by assigned-event population

**File:** `conference-api/src/routes/backoffice/members.ts`

Steps:
1. Import `staffEventAssignments` and obtain assigned event IDs for non-admin users.
2. For organizer list requests, constrain users to those having a confirmed registration in any assigned event. If `eventId` is supplied, it must also be assigned.
3. For organizer with no assignments, return an empty list with normal pagination shape.
4. Scope member detail to users with confirmed registrations in assigned events; return 404 when outside scope.
5. Scope stats to the same member population so global counts are not leaked.
6. Restrict member deletion to Admin only and return 403 for organizer/non-admin.
7. Preserve Admin behavior and existing response schemas.

## Task 4: Verification

1. Run API TypeScript build and tests.
2. Run backoffice lint and build.
3. Review Git diff for accidental permission expansion.
4. Confirm organizer assigned Event A can see A registrations/members but cannot fetch Event B detail, global member stats, or management actions.
5. Confirm Admin retains global access and mutations.

## No migration required

This change uses the existing `staffEventAssignments` relation. No database schema or migration is required.
