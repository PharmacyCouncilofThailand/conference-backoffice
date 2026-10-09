export type InvitationStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "expired"
  | "revoked";

export type GrantOutcome = "added" | "invited" | "skipped";

export interface InvitationMetadata {
  invitationId: string;
  invitationStatus: InvitationStatus;
  expiresAt: string;
  effectiveDeadline: string;
  respondedAt: string | null;
}

export interface InvitationCapacity {
  currentEnrollmentCount: number;
  reservedCount: number;
  occupiedCount: number;
  seatsRemaining: number;
}

export type SessionGrantSkipCode =
  | "REGISTRATION_NOT_FOUND"
  | "EVENT_MISMATCH"
  | "REGISTRATION_NOT_CONFIRMED"
  | "ALREADY_REGISTERED"
  | "ALREADY_INVITED"
  | "DUPLICATE_PARTICIPANT";

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
  outcome: GrantOutcome;
  reasonCode: SessionGrantSkipCode | null;
  registrationSessionId: number | null;
  emailStatus: SessionGrantEmailStatus;
  attemptCount: number;
  lastErrorCode: string | null;
  invitation: InvitationMetadata | null;
}

export interface GrantBatchDto {
  batchId: string;
  sessionId: number;
  eventId: number;
  requestedCount: number;
  addedCount: number;
  invitedCount: number;
  skippedCount: number;
  currentEnrollmentCount: number;
  reservedCount: number;
  occupiedCount: number;
  seatsRemaining: number | null;
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
  outcome: GrantOutcome;
  reasonCode: SessionGrantSkipCode | null;
  emailStatus: SessionGrantEmailStatus;
  attemptCount: number;
  invitation: InvitationMetadata | null;
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
  adminGrantRequiresConfirmation: boolean;
  enrollmentCount: number;
  reservedCount: number;
  occupiedCount: number;
  seatsRemaining: number | null;
  effectiveDeadline: string | null;
  grantEligible: boolean;
  disabledReason:
    | "SESSION_INACTIVE"
    | "SESSION_ENDED"
    | "SESSION_RESPONSE_CLOSED"
    | null;
}

export interface GrantTrackingItemDto extends Omit<SessionGrantItemDto, 'registrationSessionId'> {
  batchId: string;
  eventId: number;
  sessionId: number;
  sessionName: string;
  actorName: string;
  createdAt: string;
  recipientEmail: string | null;
  sentAt: string | null;
  lastAttemptAt: string | null;
}

export interface GrantTrackingDto {
  items: GrantTrackingItemDto[];
  pagination: SessionGrantPagination;
  summary: {
    total: number;
    outcomeCounts: Record<GrantOutcome, number>;
    invitationCounts: Record<InvitationStatus, number>;
    emailCounts: Record<SessionGrantEmailStatus, number>;
  };
}
