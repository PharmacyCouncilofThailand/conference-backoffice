type EventStatus = "draft" | "published" | "cancelled" | "completed";

type SessionLike = {
  isMainSession?: boolean;
};

type TicketLike = {
  category: "primary" | "addon";
  price?: string | number | null;
  currency?: string | null;
  allowedRoles?: string[] | string | null;
};

export interface EventReadinessWarning {
  code: string;
  message: string;
}

export interface EventReadinessResult {
  enabled: boolean;
  ready: boolean;
  warnings: EventReadinessWarning[];
}

function normalizeAllowedRoles(raw: TicketLike["allowedRoles"]): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;

  const trimmed = raw.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }

  return trimmed
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function isZeroPrice(raw: TicketLike["price"]): boolean {
  const parsed = typeof raw === "number" ? raw : Number(raw ?? NaN);
  return Number.isFinite(parsed) && parsed === 0;
}

export function getExternalEventReadiness(input: {
  websiteUrl?: string | null;
  status: EventStatus;
  sessions: SessionLike[];
  tickets: TicketLike[];
}): EventReadinessResult {
  const websiteUrl = input.websiteUrl?.trim() || "";

  if (!websiteUrl) {
    return {
      enabled: false,
      ready: false,
      warnings: [],
    };
  }

  const warnings: EventReadinessWarning[] = [];

  if (input.status !== "published") {
    warnings.push({
      code: "EVENT_NOT_PUBLISHED",
      message: "Publish this event before sending users from an external event website.",
    });
  }

  const primaryTickets = input.tickets.filter((ticket) => ticket.category === "primary");
  const freePrimaryTickets = primaryTickets.filter(
    (ticket) => (ticket.currency || "THB").toUpperCase() === "THB" && isZeroPrice(ticket.price)
  );

  if (freePrimaryTickets.length === 0) {
    warnings.push({
      code: "NO_FREE_PRIMARY_TICKET",
      message: "Create at least one free THB primary ticket for the external event handoff flow.",
    });
  }

  const hasPharmacistReadyPrimary = freePrimaryTickets.some((ticket) =>
    normalizeAllowedRoles(ticket.allowedRoles).includes("pharmacist")
  );

  if (!hasPharmacistReadyPrimary) {
    warnings.push({
      code: "PRIMARY_TICKET_MISSING_PHARMACIST",
      message: "At least one free primary ticket must allow the pharmacist role.",
    });
  }

  const hasMainSession = input.sessions.some((session) => session.isMainSession);
  if (!hasMainSession) {
    warnings.push({
      code: "NO_MAIN_SESSION",
      message: "Add at least one Main Session so free registrations can link to a default session.",
    });
  }

  return {
    enabled: true,
    ready: warnings.length === 0,
    warnings,
  };
}
