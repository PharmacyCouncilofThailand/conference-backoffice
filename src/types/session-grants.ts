export type SessionGrantSkipCode =
  | "REGISTRATION_NOT_FOUND"
  | "EVENT_MISMATCH"
  | "REGISTRATION_NOT_CONFIRMED"
  | "ALREADY_REGISTERED";

export type SessionGrantEmailStatus =
  | "not_applicable"
  | "pending"
  | "sending"
  | "sent"
  | "failed"
  | "unknown"
  | "suppressed";

export interface SessionGrantPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface SessionGrantItemDto {
  id: string;
  registrationId: number;
  regCode: string | null;
  name: string | null;
  outcome: "added" | "skipped";
  reasonCode: SessionGrantSkipCode | null;
  registrationSessionId: number | null;
  emailStatus: SessionGrantEmailStatus;
  attemptCount: number;
  lastErrorCode: string | null;
}

export interface GrantBatchDto {
  batchId: string;
  sessionId: number;
  eventId: number;
  requestedCount: number;
  addedCount: number;
  skippedCount: number;
  currentEnrollmentCount: number;
  createdAt: string;
  results: SessionGrantItemDto[];
  emailCounts: Record<SessionGrantEmailStatus, number>;
  pagination: SessionGrantPagination;
}

export interface SessionGrantHistoryItemDto {
  batchId: string;
  eventId: number;
  sessionId: number;
  sessionName: string;
  actorName: string;
  createdAt: string;
  outcome: "added" | "skipped";
  reasonCode: SessionGrantSkipCode | null;
  emailStatus: SessionGrantEmailStatus;
  attemptCount: number;
}

export interface SessionGrantHistoryDto {
  batches: SessionGrantHistoryItemDto[];
  pagination: SessionGrantPagination;
}

export interface SessionGrantEmailAttemptDto {
  id: string;
  attemptNo: number;
  trigger: "system" | "admin";
  triggeredBy: number | null;
  recipientEmail: string;
  templateVersion: string;
  subject: string;
  result: "sending" | "sent" | "failed" | "unknown" | "suppressed";
  startedAt: string;
  requestStartedAt: string | null;
  finishedAt: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  providerMessageId: string | null;
}

export interface SessionGrantEmailAttemptsDto {
  attempts: SessionGrantEmailAttemptDto[];
  pagination: SessionGrantPagination;
}

export interface SessionGrantRetryDto {
  queued: string[];
  skipped: Array<{ itemId: string; reasonCode: string }>;
}

export interface SessionGrantCreateInput {
  sessionId: number;
  registrationIds: number[];
}

export interface GrantSessionChoiceDto {
  id: number;
  eventId: number;
  sessionCode: string;
  sessionName: string;
  sessionType: string | null;
  startTime: string;
  endTime: string;
  room: string | null;
  maxCapacity: number | null;
  isActive: boolean;
  enrollmentCount: number;
  grantEligible: boolean;
  disabledReason: "SESSION_INACTIVE" | "SESSION_ENDED" | null;
}
