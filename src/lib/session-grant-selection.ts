export interface SelectedRegistration {
  id: number;
  regCode: string;
  name: string;
  email: string;
}

export type SelectionAction =
  | { type: "add"; rows: SelectedRegistration[] }
  | { type: "remove"; ids: number[] }
  | { type: "clear" };

export const SESSION_GRANT_SELECTION_LIMIT = 500;

export function updateSelection(
  current: ReadonlyMap<number, SelectedRegistration>,
  action: SelectionAction,
): Map<number, SelectedRegistration> {
  if (action.type === "clear") return new Map();

  const next = new Map(current);
  if (action.type === "remove") {
    for (const id of action.ids) next.delete(id);
    return next;
  }

  for (const row of action.rows) {
    if (!next.has(row.id) && next.size >= SESSION_GRANT_SELECTION_LIMIT) break;
    next.set(row.id, row);
  }
  return next;
}
