export const PRIS_2026_EVENT_CODE = "PRIS-2026" as const;

export type Pris2026AbstractRoundFilter = "" | "round1" | "round2";

export const PRIS_2026_ABSTRACT_ROUND_OPTIONS = [
  {
    id: "round1",
    label: "Round 1",
    detail: "Submitted through 31 Aug 2026, 23:59",
  },
  {
    id: "round2",
    label: "Round 2",
    detail: "Submitted 1–20 Sep 2026",
  },
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
