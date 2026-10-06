export type LocalizedText = { th: string; en: string };

export type WheelDayWindow = {
  id: string;
  date: string;
  startAt: string;
  endAt: string;
  version: number;
};

export type WheelDayChange = {
  id: number;
  actorId: number;
  operation: "day_window_create" | "day_window_edit";
  reason: string | null;
  before: WheelDayWindow | null;
  after: WheelDayWindow;
  createdAt: string;
};

export type WheelQrCode = {
  id: string;
  eventId: number;
  date: string;
  name: string;
  status: "closed" | "open";
  createdBy: number;
  createdAt: string;
  openedBy: number | null;
  openedAt: string | null;
  openedReason: string | null;
  closedBy: number | null;
  closedAt: string | null;
  closedReason: string | null;
};

export type WheelQrListItem = WheelQrCode & {
  currentDeadline: string;
  claimCount: number;
  spentCount: number;
  revokedCount: number;
};

export type WheelQrDownload = WheelQrCode & {
  currentDeadline: string;
  claimUrl: string;
  qrDataUrl: string;
};

export type WheelCreditClaim = {
  id: string;
  userId: number;
  recipient: { firstName: string; lastName: string; email: string };
  attendanceId: string;
  claimedAt: string;
  displayedDeadlineAt: string;
  revokedAt: string | null;
  revokedBy: number | null;
  revocationReason: string | null;
  spentAt: string | null;
};

export type WheelCreditRevocation = {
  claimId: string;
  revokedAt: string;
  revokedBy: number;
  reason: string;
  replayed: boolean;
  requestId: string;
};

export type WheelPage<T> = {
  items: T[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};

export type WheelConfigurationSegment = {
  id: string;
  kind: "prize" | "no_prize";
  name: LocalizedText;
  imageId: string | null;
  enabled: boolean;
  position: number;
  initialQuantity?: number;
};

export type WheelConfiguration = {
  segments: WheelConfigurationSegment[];
  collectionInstructions?: LocalizedText;
  collectionDeadline?: string | null;
};

export type WheelSegmentState = {
  id: string;
  kind: "prize" | "no_prize";
  name: LocalizedText;
  imageId: string | null;
  imageKey: string | null;
  imageUrl: string | null;
  enabled: boolean;
  position: number;
  remaining: number | null;
  allocated: number;
  collected: number;
};

export type WheelAuditEntry = {
  id: string;
  operation: string;
  reason: string | null;
  actorId: number;
  actorEmail: string | null;
  before: unknown;
  after: unknown;
  createdAt: string;
};

export type AdminWheelState = {
  eventId: number;
  actorId: number;
  attendanceReadiness: AttendanceReadiness;
  wheel: {
    id: string;
    mainSessionId: number;
    enabled: boolean;
    paused: boolean;
    version: number;
    poolRevision: number;
    configuration: WheelConfiguration | null;
    collectionInstructions: LocalizedText | null;
    collectionDeadline: string | null;
  };
  segments: WheelSegmentState[];
  audit: WheelAuditEntry[];
  requestId: string;
};

export type AttendanceSetupBlocker = "SCHEMA_REQUIRED" | "INVALID_MAIN_SESSION" | "MISSING_ENTITLEMENTS" |
  "UNLINKED_ACCOUNTS" | "LEGACY_SCANNER_MISSING" | "LEGACY_TIME_INVALID" | "LEGACY_DAILY_CONFLICT" | "CANCELLATION_CONFLICT";
export type AttendanceReadiness = {
  eventId: number; mainSessionId: number; serverDate: string; policyEnabled: boolean; runtimeReady: boolean;
  setupComplete: boolean; revision: string;
  counts: { confirmedRegistrations: number; confirmedEntitlements: number; missingEntitlements: number;
    unlinkedAccounts: number; legacySources: number; pendingLegacyImports: number; alreadyImported: number; alreadyCovered: number; conflicts: number };
  blockers: Array<{ code: AttendanceSetupBlocker; count: number }>;
};
export type AttendanceSetupInput = { mainSessionId: number; expectedReadinessRevision: string; reason: string; idempotencyKey: string };
export type AttendanceSetupResult = { eventId: number; mainSessionId: number; policyEnabled: true; importedCount: number;
  alreadyImportedCount: number; alreadyCoveredCount: number; auditId: string; replayed: boolean };

export type AdminWheelSpin = {
  id: string;
  eventId: number;
  userId: number;
  playDate: string;
  attendanceId: string;
  attendanceCheckedInAt: string;
  segmentId: string;
  outcomeKind: "prize" | "no_prize";
  awardedName: LocalizedText;
  awardedImageKey: string | null;
  configurationVersion: number;
  poolRevision: number;
  createdAt: string;
  configurationSnapshot: unknown;
  outcomeSnapshot: unknown;
  claim: null | {
    generation: number;
    status: "open" | "redeemed";
    redeemedAt: string | null;
    redeemedBy: number | null;
    collectionPoint: string | null;
    deliveredDetails: string | null;
  };
};

export type AdminWheelSpinsResponse = {
  eventId: number;
  actorId: number;
  spins: AdminWheelSpin[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  requestId: string;
};

export type WheelImageUpload = {
  imageId: string;
  imageKey: string;
  url: string;
  width: number;
  height: number;
  requestId: string;
};

export type RewardLookup = {
  eventId: number;
  spinId: string;
  owner: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
  };
  prize: {
    name: LocalizedText;
    imageKey: string | null;
    awardedAt: string;
  };
  claimGeneration: number;
  status: "open" | "redeemed";
  redeemedAt: string | null;
  redeemedBy: number | null;
  redeemedByName: string | null;
  collectionPoint: string | null;
  deliveredDetails: string | null;
  collectionInstructions: LocalizedText | null;
  collectionDeadline: string | null;
  lookedUpBy: "token" | "code";
  actorId: number;
  requestId: string;
};

export type StockAdjustmentInput = {
  segmentId: string;
  delta: number;
  reason: string;
  idempotencyKey: string;
};

export type RedemptionInput = {
  eventId: number;
  spinId: string;
  claimGeneration: number;
  idempotencyKey: string;
  identityChecked: true;
  collectionPoint?: string | null;
  deliveredDetails?: string | null;
};

export type RedemptionCorrectionInput = {
  eventId: number;
  spinId: string;
  claimGeneration: number;
  reason: string;
  reopen: boolean;
  idempotencyKey: string;
};
