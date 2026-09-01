# Abstract Category Filter Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Abstracts category dropdown filter by the selected abstract category instead of returning all categories.

**Architecture:** Keep filtering server-side using the existing `categoryId` query supported by `conference-api`. Change only the backoffice dropdown value to use category IDs, then simplify both list and export query construction to send `categoryId` consistently. No API or database changes are required.

**Tech Stack:** Next.js, React, TypeScript, existing `api.abstracts.list` client.

## Global Constraints

- Keep current UI labels and category display names unchanged.
- Do not add new API parameters or backend behavior.
- Use existing `categoryId` contract already supported by conference-api.
- Preserve current event, round, presentation type, status, search, and export filters.

---

### Task 1: Align category dropdown with the backend `categoryId` contract

**Files:**
- Modify: `src/app/abstracts/page.tsx`
- Test: no frontend test suite exists; verify through TypeScript/build checks and source inspection.

**Interfaces:**
- Consumes: `eventCategoryList: { id: number; name: string }[]` and `api.abstracts.list(token, query)`.
- Produces: category dropdown values as category ID strings and requests containing `categoryId=<id>`.

- [ ] **Step 1: Confirm the current failure path**

Current dropdown uses category name as value:

```tsx
<option key={cat.id} value={cat.name}>
  {cat.name}
</option>
```

Current request code only sends `categoryId` when the value is numeric, so a Thai category name falls through to unsupported `category=<name>`.

- [ ] **Step 2: Change dropdown values to category IDs**

Use:

```tsx
<option key={cat.id} value={String(cat.id)}>
  {cat.name}
</option>
```

- [ ] **Step 3: Send `categoryId` consistently for list and export**

Replace the numeric/name branching in both request builders with:

```ts
if (categoryFilter) params.categoryId = categoryFilter;
```

This matches the existing API query schema and route condition.

- [ ] **Step 4: Run verification**

Run project typecheck/build using the repository's existing scripts. Expected: no TypeScript or build errors caused by the change.

- [ ] **Step 5: Inspect final diff**

Expected diff is limited to `src/app/abstracts/page.tsx` plus this plan file, with no backend changes.
