import assert from "node:assert/strict";
import test from "node:test";
import {
  SESSION_GRANT_SELECTION_LIMIT,
  updateSelection,
  type SelectedRegistration,
} from "./session-grant-selection.js";

function row(id: number): SelectedRegistration {
  return {
    id,
    regCode: `REG-${id}`,
    name: `Person ${id}`,
    email: `person-${id}@example.invalid`,
  };
}

test("selection persists across page/search/filter changes because only explicit actions mutate it", () => {
  const pageOne = updateSelection(new Map(), { type: "add", rows: [row(1), row(2)] });
  const afterOtherPage = updateSelection(pageOne, { type: "add", rows: [row(101)] });

  assert.deepEqual([...pageOne.keys()], [1, 2]);
  assert.deepEqual([...afterOtherPage.keys()], [1, 2, 101]);
  assert.notEqual(afterOtherPage, pageOne);
});

test("select-all style add preserves prior-page rows and deduplicates by registration id", () => {
  const existing = new Map([[1, row(1)], [2, row(2)]]);
  const next = updateSelection(existing, { type: "add", rows: [row(2), row(3), row(4)] });

  assert.deepEqual([...next.keys()], [1, 2, 3, 4]);
  assert.equal(next.get(2)?.email, row(2).email);
  assert.deepEqual([...existing.keys()], [1, 2]);
});

test("remove and clear are immutable and affect only explicitly requested rows", () => {
  const current = new Map([[1, row(1)], [2, row(2)], [3, row(3)]]);
  const removed = updateSelection(current, { type: "remove", ids: [2, 999] });
  const cleared = updateSelection(removed, { type: "clear" });

  assert.deepEqual([...removed.keys()], [1, 3]);
  assert.equal(cleared.size, 0);
  assert.deepEqual([...current.keys()], [1, 2, 3]);
});

test("selection never silently grows beyond the 500 registration hard limit", () => {
  const first = Array.from({ length: SESSION_GRANT_SELECTION_LIMIT - 1 }, (_, index) => row(index + 1));
  const current = updateSelection(new Map(), { type: "add", rows: first });
  const next = updateSelection(current, { type: "add", rows: [row(500), row(501), row(502)] });

  assert.equal(next.size, SESSION_GRANT_SELECTION_LIMIT);
  assert.equal(next.has(500), true);
  assert.equal(next.has(501), false);
  assert.equal(next.has(502), false);
});
