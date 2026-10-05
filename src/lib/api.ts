import type {
  LoginCredentials,
  LoginResponse,
  User,
  Event,
  EventCreateInput,
  EventUpdateInput,
  Session,
  Ticket,
  VerificationRequest,
  Payment,
  Pagination,
  StudentEligibilityRequest,
  SponsorApplication,
  SponsorBenefit,
  SponsorMediaAsset,
  SponsorPackage,
  SponsorPage,
  SponsorStat,
  SponsorTimelineItem,
  TeamRegistrationConfig,
  TeamRegistrationDetail,
  TeamRegistrationListItem,
  PromoCodeAbstractReportRow,
} from "@/types/api";
import type {
  GrantBatchDto,
  GrantSessionChoiceDto,
  InvitationCapacity,
  SessionGrantCreateInput,
  SessionGrantEmailAttemptsDto,
  SessionGrantHistoryDto,
  SessionGrantRetryDto,
} from "@/types/session-grants";
import type {
  AdminWheelSpinsResponse,
  AdminWheelState,
  AttendanceSetupInput,
  AttendanceSetupResult,
  RedemptionCorrectionInput,
  RedemptionInput,
  RewardLookup,
  StockAdjustmentInput,
  WheelConfiguration,
  WheelImageUpload,
  WheelDayWindow,
  WheelDayChange,
  WheelQrListItem,
  WheelQrDownload,
  WheelQrCode,
  WheelCreditClaim,
  WheelCreditRevocation,
  WheelPage,
} from "@/types/lucky-wheel";

const API_BASE = process.env.NEXT_PUBLIC_API_URL;
const AUTH_UNAUTHORIZED_EVENT = "accp-backoffice-auth:unauthorized";

interface FetchOptions extends RequestInit {
  token?: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly details?: unknown,
    public readonly capacity?: InvitationCapacity,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface BackofficeCheckinRegistration {
  id: number;
  regCode: string;
  firstName: string;
  lastName: string;
  email: string;
  ticketName: string;
  eventName: string;
}

interface BackofficeCheckinSession {
  id: number;
  sessionId: number;
  sessionName: string;
  sessionType?: string;
  ticketName: string | null;
  source?: string;
  attendanceMode?: "daily" | "single";
  attendanceId?: string | null;
  attendanceDate?: string | null;
  checkedInAt: string | null;
}

interface BackofficeCheckinResponse {
  success?: boolean;
  registration: BackofficeCheckinRegistration;
  sessions?: BackofficeCheckinSession[];
  checkedInSession?: BackofficeCheckinSession;
  checkedInCount?: number;
  message?: string;
}

interface BackofficeCheckinRow {
  kind?: "daily" | "single";
  id: number | string;
  attendanceId?: string | null;
  registrationSessionId: number;
  attendanceDate?: string | null;
  scannedAt: string;
  cancelledAt?: string | null;
  cancelledBy?: number | null;
  cancellationReason?: string | null;
  regCode: string;
  firstName: string;
  lastName: string;
  email: string;
  attendeeType: string | null;
  university: string | null;
  institution: string | null;
  ticketName: string | null;
  source: string;
  addedAt: string;
  sessionName: string | null;
  eventName: string | null;
  scannedBy: { firstName: string | null; lastName: string | null } | null;
}

function getStoredBackofficeToken(): string {
  if (typeof window === "undefined") return "";

  return (
    localStorage.getItem("backoffice_token") ||
    sessionStorage.getItem("backoffice_token") ||
    ""
  );
}

function dispatchUnauthorizedEvent() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(AUTH_UNAUTHORIZED_EVENT));
  }
}

export async function fetchAPI<T>(
  endpoint: string,
  options: FetchOptions = {},
): Promise<T> {
  const { token, ...fetchOptions } = options;
  const resolvedToken =
    token ||
    (endpoint === "/backoffice/login" ? "" : getStoredBackofficeToken());

  const headers: Record<string, string> = {};

  if (fetchOptions.body && typeof fetchOptions.body === "string") {
    headers["Content-Type"] = "application/json";
  }

  // Copy existing headers if any
  if (fetchOptions.headers) {
    const existingHeaders = fetchOptions.headers as Record<string, string>;
    Object.assign(headers, existingHeaders);
  }

  if (resolvedToken) {
    headers["Authorization"] = `Bearer ${resolvedToken}`;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...fetchOptions,
    headers,
  });

  if (!res.ok) {
    if (res.status === 401 && endpoint !== "/backoffice/login") {
      dispatchUnauthorizedEvent();
    }

    const error = await res.json().catch(() => ({ error: "Request failed" }));
    const detailsText = error.details ? ` — ${JSON.stringify(error.details)}` : "";
    const message =
      typeof error.error === "object" ? error.error?.message : error.error;
    const capacity = error.capacity ?? error.details?.capacity;
    throw new ApiError(
      (message || `API Error: ${res.status}`) + detailsText,
      res.status,
      typeof error.code === "string" ? error.code : undefined,
      error.details,
      capacity && typeof capacity === "object" ? capacity as InvitationCapacity : undefined,
    );
  }

  return res.json();
}

// API Functions with Proper Types
export const api = {
  auth: {
    login: (credentials: LoginCredentials) =>
      fetchAPI<LoginResponse>("/backoffice/login", {
        method: "POST",
        body: JSON.stringify(credentials),
      }),
  },

  upload: {
    venueImage: (token: string, formData: FormData) =>
      fetchAPI<{ success: boolean; url: string }>("/api/upload/venue-image", {
        method: "POST",
        body: formData as unknown as BodyInit,
        token,
      }),
  },

  // Public Events (ReadOnly or Public usage)
  events: {
    list: () => fetchAPI<{ events: Event[] }>("/api/events"),
    get: (id: string) => fetchAPI<{ event: Event }>(`/api/events/${id}`),
  },

  // Backoffice Resources
  users: {
    list: (token: string, query?: string) =>
      fetchAPI<{ users: Record<string, unknown>[]; pagination: Pagination }>(
        `/api/backoffice/users${query ? `?${query}` : ""}`,
        { token },
      ),
    create: (token: string, data: Record<string, unknown>) =>
      fetchAPI<{ user: Record<string, unknown> }>("/api/backoffice/users", {
        method: "POST",
        body: JSON.stringify(data),
        token,
      }),
    update: (token: string, id: number, data: Record<string, unknown>) =>
      fetchAPI<{ user: Record<string, unknown> }>(
        `/api/backoffice/users/${id}`,
        { method: "PATCH", body: JSON.stringify(data), token },
      ),
    delete: (token: string, id: number) =>
      fetchAPI<{ success: boolean }>(`/api/backoffice/users/${id}`, {
        method: "DELETE",
        token,
      }),
    assignEvents: (token: string, id: number, eventIds: number[]) =>
      fetchAPI<{ success: boolean; count: number }>(
        `/api/backoffice/users/${id}/assignments`,
        { method: "POST", body: JSON.stringify({ eventIds }), token },
      ),
    assignEventsAndSessions: (
      token: string,
      id: number,
      assignments: { eventId: number; sessionIds?: number[] }[],
    ) =>
      fetchAPI<{ success: boolean }>(
        `/api/backoffice/users/${id}/assignments`,
        { method: "PUT", body: JSON.stringify({ assignments }), token },
      ),
  },

  verifications: {
    list: (token: string, query?: string) =>
      fetchAPI<{
        verifications: VerificationRequest[];
        pagination: Pagination;
      }>(`/api/backoffice/verifications${query ? `?${query}` : ""}`, { token }),
    approve: (token: string, id: string, comment?: string) =>
      fetchAPI<{ success: boolean; user: User }>(
        `/api/backoffice/verifications/${id}/approve`,
        { method: "POST", body: JSON.stringify({ comment }), token },
      ),
    reject: (token: string, id: string, reason: string) =>
      fetchAPI<{ success: boolean; user: User }>(
        `/api/backoffice/verifications/${id}/reject`,
        { method: "POST", body: JSON.stringify({ reason }), token },
      ),
    getRejectionHistory: (token: string, id: string) =>
      fetchAPI<{
        history: {
          id: number;
          reason: string;
          rejectedAt: string;
          rejectedBy: number | null;
          rejectedByName: string | null;
        }[];
      }>(`/api/backoffice/verifications/${id}/rejection-history`, { token }),
  },

  studentEligibilityRequests: {
    list: (token: string, query?: string) =>
      fetchAPI<{
        success: boolean;
        requests: StudentEligibilityRequest[];
        pagination: Pagination;
      }>(
        `/api/backoffice/student-eligibility-requests${query ? `?${query}` : ""}`,
        { token },
      ),
    get: (token: string, id: number) =>
      fetchAPI<{ success: boolean; request: StudentEligibilityRequest }>(
        `/api/backoffice/student-eligibility-requests/${id}`,
        { token },
      ),
    review: (
      token: string,
      id: number,
      data:
        | { status: "approved"; reviewNote?: string }
        | { status: "rejected"; rejectionReason: string; reviewNote?: string },
    ) =>
      fetchAPI<{ success: boolean; request: StudentEligibilityRequest }>(
        `/api/backoffice/student-eligibility-requests/${id}`,
        { method: "PATCH", body: JSON.stringify(data), token },
      ),
  },

  backofficeEvents: {
    list: (token: string, query?: string) =>
      fetchAPI<{ events: Record<string, unknown>[]; pagination: Pagination }>(
        `/api/backoffice/events${query ? `?${query}` : ""}`,
        { token },
      ),
    get: (token: string, id: number) =>
      fetchAPI<{
        event: Event;
        sessions: Record<string, unknown>[];
        tickets: Record<string, unknown>[];
        venueImages: {
          id: number;
          url: string;
          imageUrl?: string;
          caption?: string;
        }[];
      }>(`/api/backoffice/events/${id}`, { token }),
    create: (token: string, data: EventCreateInput) =>
      fetchAPI<{ event: Event }>("/api/backoffice/events", {
        method: "POST",
        body: JSON.stringify(data),
        token,
      }),
    update: (token: string, id: number, data: EventUpdateInput) =>
      fetchAPI<{ event: Event }>(`/api/backoffice/events/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
        token,
      }),
    delete: (token: string, id: number) =>
      fetchAPI<void>(`/api/backoffice/events/${id}`, {
        method: "DELETE",
        token,
      }),

    // Sessions nested routes (using Record for page compatibility)
    getSessions: (token: string, eventId: number, forGrant = false) =>
      fetchAPI<{
        sessions: (Record<string, unknown> | GrantSessionChoiceDto)[];
        serverNow?: string;
      }>(
        `/api/backoffice/events/${eventId}/sessions${forGrant ? "?forGrant=true" : ""}`,
        { token },
      ),
    createSession: (
      token: string,
      eventId: number,
      data: Record<string, unknown>,
    ) =>
      fetchAPI<{ session: Record<string, unknown> }>(
        `/api/backoffice/events/${eventId}/sessions`,
        { method: "POST", body: JSON.stringify(data), token },
      ),
    updateSession: (
      token: string,
      eventId: number,
      sessionId: number,
      data: Record<string, unknown>,
    ) =>
      fetchAPI<{ session: Record<string, unknown> }>(
        `/api/backoffice/events/${eventId}/sessions/${sessionId}`,
        { method: "PATCH", body: JSON.stringify(data), token },
      ),
    deleteSession: (token: string, eventId: number, sessionId: number) =>
      fetchAPI<void>(
        `/api/backoffice/events/${eventId}/sessions/${sessionId}`,
        { method: "DELETE", token },
      ),
    getSessionEnrollments: (
      token: string,
      eventId: number,
      sessionId: number,
    ) =>
      fetchAPI<{
        enrollments: {
          id: number;
          regCode: string;
          email: string;
          firstName: string;
          lastName: string;
          status: string;
          createdAt: string;
          ticketName: string | null;
          source: string;
          addedAt: string;
        }[];
        count: number;
      }>(
        `/api/backoffice/events/${eventId}/sessions/${sessionId}/enrollments`,
        { token },
      ),

    // Tickets nested routes (using Record for page compatibility)
    getTickets: (token: string, eventId: number) =>
      fetchAPI<{ tickets: Record<string, unknown>[] }>(
        `/api/backoffice/events/${eventId}/tickets`,
        { token },
      ),
    createTicket: (
      token: string,
      eventId: number,
      data: Record<string, unknown>,
    ) =>
      fetchAPI<{ ticket: Record<string, unknown> }>(
        `/api/backoffice/events/${eventId}/tickets`,
        { method: "POST", body: JSON.stringify(data), token },
      ),
    updateTicket: (
      token: string,
      eventId: number,
      ticketId: number,
      data: Record<string, unknown>,
    ) =>
      fetchAPI<{ ticket: Record<string, unknown> }>(
        `/api/backoffice/events/${eventId}/tickets/${ticketId}`,
        { method: "PATCH", body: JSON.stringify(data), token },
      ),
    deleteTicket: (token: string, eventId: number, ticketId: number) =>
      fetchAPI<void>(`/api/backoffice/events/${eventId}/tickets/${ticketId}`, {
        method: "DELETE",
        token,
      }),

    // Images nested routes
    addImage: (
      token: string,
      eventId: number,
      data: { imageUrl: string; caption?: string },
    ) =>
      fetchAPI<{ image: { id: number; imageUrl: string } }>(
        `/api/backoffice/events/${eventId}/images`,
        { method: "POST", body: JSON.stringify(data), token },
      ),
    deleteImage: (token: string, eventId: number, imageId: number) =>
      fetchAPI<void>(`/api/backoffice/events/${eventId}/images/${imageId}`, {
        method: "DELETE",
        token,
      }),
  },

  teamRegistrations: {
    list: (token: string, query: URLSearchParams) =>
      fetchAPI<{
        success: boolean;
        data: {
          items: TeamRegistrationListItem[];
          paidTeamCount: number;
          pagination: {
            total: number;
            page: number;
            pageSize: number;
            pages: number;
          };
        };
      }>(`/api/backoffice/team-registrations?${query.toString()}`, { token }),
    get: (token: string, registrationId: string) =>
      fetchAPI<{ success: boolean; data: TeamRegistrationDetail }>(
        `/api/backoffice/team-registrations/${registrationId}`,
        { token },
      ),
    correct: (
      token: string,
      registrationId: string,
      data: Record<string, unknown>,
    ) =>
      fetchAPI<{ success: boolean; data: { id: string } }>(
        `/api/backoffice/team-registrations/${registrationId}`,
        { method: "PATCH", body: JSON.stringify(data), token },
      ),
    resendConfirmation: (token: string, registrationId: string) =>
      fetchAPI<{
        success: boolean;
        data: { deliveryKey: string; recipients: number };
      }>(
        `/api/backoffice/team-registrations/${registrationId}/resend-confirmation`,
        { method: "POST", token },
      ),
    getConfig: (token: string, eventId: number) =>
      fetchAPI<{
        success: boolean;
        data: { config: TeamRegistrationConfig | null };
      }>(`/api/backoffice/events/${eventId}/team-registration-config`, {
        token,
      }),
    saveConfig: (
      token: string,
      eventId: number,
      config: TeamRegistrationConfig,
    ) =>
      fetchAPI<{ success: boolean; data: { config: TeamRegistrationConfig } }>(
        `/api/backoffice/events/${eventId}/team-registration-config`,
        { method: "PUT", body: JSON.stringify(config), token },
      ),
  },

  speakers: {
    list: (token: string, query?: string) =>
      fetchAPI<{
        speakers: Record<string, unknown>[];
        eventSpeakers?: {
          speakerId: number;
          eventId: number;
          sessionId: number | null;
        }[];
      }>(`/api/backoffice/speakers${query ? `?${query}` : ""}`, { token }),
    create: (token: string, data: Record<string, unknown>) =>
      fetchAPI<{ speaker: Record<string, unknown> }>(
        "/api/backoffice/speakers",
        { method: "POST", body: JSON.stringify(data), token },
      ),
    update: (token: string, id: number, data: Record<string, unknown>) =>
      fetchAPI<{ speaker: Record<string, unknown> }>(
        `/api/backoffice/speakers/${id}`,
        { method: "PATCH", body: JSON.stringify(data), token },
      ),
    delete: (token: string, id: number) =>
      fetchAPI<void>(`/api/backoffice/speakers/${id}`, {
        method: "DELETE",
        token,
      }),
    assignEvents: (
      token: string,
      speakerId: number,
      assignments: { eventId: number; sessionId: number | null }[],
    ) =>
      fetchAPI<{ success: boolean }>(
        `/api/backoffice/speakers/${speakerId}/events`,
        {
          method: "POST",
          body: JSON.stringify({ assignments }),
          token,
        },
      ),
  },

  registrations: {
    list: (token: string, query?: string) =>
      fetchAPI<{
        registrations: Record<string, unknown>[];
        pagination: Pagination;
      }>(`/api/backoffice/registrations${query ? `?${query}` : ""}`, { token }),
    get: (token: string, id: number, date?: string) =>
      fetchAPI<{ registration: Record<string, unknown>; attendance?: { serverNow: string; serverDate: string; selectedDate: string } }>(
        `/api/backoffice/registrations/${id}${date ? `?date=${encodeURIComponent(date)}` : ""}`,
        { token },
      ),
    update: (token: string, id: number, data: Record<string, unknown>) =>
      fetchAPI<{ registration: Record<string, unknown> }>(
        `/api/backoffice/registrations/${id}`,
        { method: "PATCH", body: JSON.stringify(data), token },
      ),
    manualAdd: (
      token: string,
      data: {
        userId: number;
        eventId: number;
        ticketTypeId: number;
        sessionIds?: number[];
        note?: string;
      },
    ) =>
      fetchAPI<{ success: boolean; registration: Record<string, unknown> }>(
        "/api/backoffice/registrations/manual",
        { method: "POST", body: JSON.stringify(data), token },
      ),
    batchManualAdd: (
      token: string,
      data: {
        userIds: number[];
        eventId: number;
        ticketTypeId: number;
        sessionIds?: number[];
        note?: string;
      },
    ) =>
      fetchAPI<{
        success: boolean;
        addedCount: number;
        successList: Record<string, unknown>[];
        skippedList: { userId: number; reason: string }[];
      }>("/api/backoffice/registrations/manual/batch", {
        method: "POST",
        body: JSON.stringify(data),
        token,
      }),
    getRegisteredUsers: (
      token: string,
      eventId: number,
      ticketTypeId?: number,
    ) =>
      fetchAPI<{ registeredUserIds: number[]; ticketCategory?: string }>(
        `/api/backoffice/registrations/registered-users?eventId=${eventId}${ticketTypeId ? `&ticketTypeId=${ticketTypeId}` : ""}`,
        { token },
      ),
    addSessions: (
      token: string,
      id: number,
      data: { sessionIds: number[]; ticketTypeId: number; note?: string },
    ) =>
      fetchAPI<{ success: boolean; addedCount: number }>(
        `/api/backoffice/registrations/${id}/sessions`,
        { method: "POST", body: JSON.stringify(data), token },
      ),
  },

  sessionGrants: {
    status: (token: string) =>
      fetchAPI<{ enabled: boolean }>("/api/backoffice/session-grants/status", { token }),
    create: (
      token: string,
      idempotencyKey: string,
      body: SessionGrantCreateInput,
    ) =>
      fetchAPI<GrantBatchDto>("/api/backoffice/session-grants", {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "Idempotency-Key": idempotencyKey },
        token,
      }),
    get: (token: string, batchId: string, page = 1, limit = 50) =>
      fetchAPI<GrantBatchDto>(
        `/api/backoffice/session-grants/${encodeURIComponent(batchId)}?page=${page}&limit=${limit}`,
        { token },
      ),
    list: (token: string, query: string) =>
      fetchAPI<SessionGrantHistoryDto>(
        `/api/backoffice/session-grants${query ? `?${query}` : ""}`,
        { token },
      ),
    retry: (
      token: string,
      batchId: string,
      itemIds: string[],
      acknowledgeUnknown = false,
    ) =>
      fetchAPI<SessionGrantRetryDto>(
        `/api/backoffice/session-grants/${encodeURIComponent(batchId)}/retry`,
        {
          method: "POST",
          body: JSON.stringify({ itemIds, acknowledgeUnknown }),
          token,
        },
      ),
    emailAttempts: (
      token: string,
      batchId: string,
      itemId: string,
      page = 1,
      limit = 50,
    ) =>
      fetchAPI<SessionGrantEmailAttemptsDto>(
        `/api/backoffice/session-grants/${encodeURIComponent(batchId)}/items/${encodeURIComponent(itemId)}/email-attempts?page=${page}&limit=${limit}`,
        { token },
      ),
  },

  abstracts: {
    list: (token: string, query?: string) =>
      fetchAPI<{
        abstracts: Record<string, unknown>[];
        pagination: Pagination;
      }>(`/api/backoffice/abstracts${query ? `?${query}` : ""}`, { token }),
    get: (token: string, id: number) =>
      fetchAPI<{ abstract: Record<string, unknown> }>(
        `/api/backoffice/abstracts/${id}`,
        { token },
      ),
    updateStatus: (
      token: string,
      id: number,
      status: string,
      comment?: string,
    ) =>
      fetchAPI<{ abstract: Record<string, unknown> }>(
        `/api/backoffice/abstracts/${id}/status`,
        { method: "PATCH", body: JSON.stringify({ status, comment }), token },
      ),
    requestRevision: (
      token: string,
      id: number,
      data: { topic: string; comment: string; file?: File | null },
    ) => {
      const formData = new FormData();
      formData.append("topic", data.topic);
      formData.append("comment", data.comment);
      if (data.file) formData.append("revisionFile", data.file);

      return fetchAPI<{
        success: boolean;
        abstract: Record<string, unknown>;
        revisionRequest: Record<string, unknown>;
      }>(`/api/backoffice/abstracts/${id}/revision`, {
        method: "POST",
        body: formData as unknown as BodyInit,
        token,
      });
    },
    resendConfirmation: (token: string, id: number) =>
      fetchAPI<{ success: boolean; deadline: string; deadlineDays: number }>(
        `/api/backoffice/abstracts/${id}/resend-confirmation`,
        { method: "POST", token },
      ),
    manualConfirm: (token: string, id: number) =>
      fetchAPI<{
        success: boolean;
        abstractId: number;
        confirmedAt: string;
        alreadyConfirmed?: boolean;
      }>(`/api/backoffice/abstracts/${id}/manual-confirm`, {
        method: "POST",
        token,
      }),
  },

  checkins: {
    list: (token: string, query?: string) =>
      fetchAPI<{ checkins: BackofficeCheckinRow[]; pagination: Pagination; serverNow?: string; serverDate?: string; selectedDate?: string | null }>(
        `/api/backoffice/checkins${query ? `?${query}` : ""}`,
        { token },
      ),
    create: (
      token: string,
      data: {
        regCode: string;
        sessionId?: number;
        checkInAll?: boolean;
        assignedSessionId?: number;
      },
    ) =>
      fetchAPI<BackofficeCheckinResponse>(`/api/backoffice/checkins`, {
        method: "POST",
        body: JSON.stringify(data),
        token,
      }),
    stats: (token: string, query?: string) =>
      fetchAPI<{
        total: number;
        checkedIn: number;
        remaining: number;
        percentage: number;
        serverNow?: string;
        serverDate?: string;
        selectedDate?: string;
        attendanceMode?: "daily" | "single";
        eligibleRegistrations?: number;
        checkedInPeopleOnDate?: number;
        uniquePeople?: number;
        attendanceOccurrences?: number;
        unlinkedRegistrationCount?: number;
        sessionBreakdown?: {
          sessionId: number;
          sessionName: string;
          sessionType?: string;
          room?: string;
          total: number;
          checkedIn: number;
          remaining: number;
          percentage: number;
        }[];
      }>(`/api/backoffice/checkins/stats${query ? `?${query}` : ""}`, {
        token,
      }),
    universities: (token: string, eventId: number) =>
      fetchAPI<{ universities: string[] }>(
        `/api/backoffice/checkins/universities?eventId=${eventId}`,
        { token },
      ),
    undo: (token: string, registrationSessionId: number) =>
      fetchAPI<{ success: boolean; undone: Record<string, unknown> }>(
        `/api/backoffice/checkins/undo`,
        {
          method: "POST",
          body: JSON.stringify({ registrationSessionId }),
          token,
        },
      ),
    undoDaily: (token: string, attendanceId: string, reason: string) =>
      fetchAPI<{ success: boolean; undone: Record<string, unknown> }>(
        `/api/backoffice/checkins/undo`,
        {
          method: "POST",
          body: JSON.stringify({ attendanceId, reason }),
          token,
        },
      ),
  },

  tickets: {
    list: (token: string, query?: string) =>
      fetchAPI<{ tickets: Ticket[]; pagination: Pagination }>(
        `/api/backoffice/tickets${query ? `?${query}` : ""}`,
        { token },
      ),
  },

  sessions: {
    list: (token: string, query?: string) =>
      fetchAPI<{ sessions: Session[]; pagination: Pagination }>(
        `/api/backoffice/sessions${query ? `?${query}` : ""}`,
        { token },
      ),
  },

  payments: {
    list: (token: string) =>
      fetchAPI<{ payments: Payment[] }>("/api/payments", { token }),
  },

  promoCodes: {
    list: (token: string, query?: string) =>
      fetchAPI<{
        promoCodes: Record<string, unknown>[];
        pagination: Pagination;
      }>(`/api/backoffice/promo-codes${query ? `?${query}` : ""}`, { token }),
    get: (token: string, id: number) =>
      fetchAPI<{ promoCode: Record<string, unknown> }>(
        `/api/backoffice/promo-codes/${id}`,
        { token },
      ),
    create: (token: string, data: Record<string, unknown>) =>
      fetchAPI<{ promoCode: Record<string, unknown> }>(
        "/api/backoffice/promo-codes",
        { method: "POST", body: JSON.stringify(data), token },
      ),
    update: (token: string, id: number, data: Record<string, unknown>) =>
      fetchAPI<{ promoCode: Record<string, unknown> }>(
        `/api/backoffice/promo-codes/${id}`,
        { method: "PUT", body: JSON.stringify(data), token },
      ),
    delete: (token: string, id: number) =>
      fetchAPI<{ success: boolean }>(`/api/backoffice/promo-codes/${id}`, {
        method: "DELETE",
        token,
      }),
    toggle: (token: string, id: number) =>
      fetchAPI<{ promoCode: Record<string, unknown> }>(
        `/api/backoffice/promo-codes/${id}/toggle`,
        { method: "PATCH", token },
      ),
  },

  promoCodeAbstracts: {
    list: (token: string, query: string) =>
      fetchAPI<{
        rows: PromoCodeAbstractReportRow[];
        pagination: Pagination;
      }>(`/api/backoffice/reports/promo-code-abstracts?${query}`, { token }),
  },

  abstractCategories: {
    list: (token: string, query?: string) =>
      fetchAPI<{ categories: Record<string, unknown>[] }>(
        `/api/backoffice/abstract-categories${query ? `?${query}` : ""}`,
        { token },
      ),
    create: (token: string, data: Record<string, unknown>) =>
      fetchAPI<{ category: Record<string, unknown> }>(
        "/api/backoffice/abstract-categories",
        { method: "POST", body: JSON.stringify(data), token },
      ),
    update: (token: string, id: number, data: Record<string, unknown>) =>
      fetchAPI<{ category: Record<string, unknown> }>(
        `/api/backoffice/abstract-categories/${id}`,
        { method: "PATCH", body: JSON.stringify(data), token },
      ),
    delete: (token: string, id: number) =>
      fetchAPI<{ success: boolean }>(
        `/api/backoffice/abstract-categories/${id}`,
        { method: "DELETE", token },
      ),
    toggle: (token: string, id: number) =>
      fetchAPI<{ category: Record<string, unknown> }>(
        `/api/backoffice/abstract-categories/${id}/toggle`,
        { method: "PATCH", token },
      ),
  },

  sponsors: {
    getPage: (token: string, eventId: number) =>
      fetchAPI<{ sponsor: SponsorPage | null }>(
        `/api/backoffice/events/${eventId}/sponsor`,
        { token },
      ),
    updateProfile: (
      token: string,
      eventId: number,
      data: Record<string, unknown>,
    ) =>
      fetchAPI<{ profile: Record<string, unknown> }>(
        `/api/backoffice/events/${eventId}/sponsor`,
        { method: "PATCH", body: JSON.stringify(data), token },
      ),
    uploadOrganizerLogo: (token: string, eventId: number, formData: FormData) =>
      fetchAPI<{ profile: Record<string, unknown>; organizerLogoUrl: string }>(
        `/api/backoffice/events/${eventId}/sponsor/organizer-logo/upload`,
        { method: "POST", body: formData as unknown as BodyInit, token },
      ),

    createStat: (
      token: string,
      eventId: number,
      data: Record<string, unknown>,
    ) =>
      fetchAPI<{ stat: SponsorStat }>(
        `/api/backoffice/events/${eventId}/sponsor/stats`,
        { method: "POST", body: JSON.stringify(data), token },
      ),
    updateStat: (token: string, id: number, data: Record<string, unknown>) =>
      fetchAPI<{ stat: SponsorStat }>(`/api/backoffice/sponsor-stats/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
        token,
      }),
    deleteStat: (token: string, id: number) =>
      fetchAPI<{ success: boolean }>(`/api/backoffice/sponsor-stats/${id}`, {
        method: "DELETE",
        token,
      }),

    createPackage: (
      token: string,
      eventId: number,
      data: Record<string, unknown>,
    ) =>
      fetchAPI<{ package: SponsorPackage }>(
        `/api/backoffice/events/${eventId}/sponsor/packages`,
        { method: "POST", body: JSON.stringify(data), token },
      ),
    updatePackage: (token: string, id: number, data: Record<string, unknown>) =>
      fetchAPI<{ package: SponsorPackage }>(
        `/api/backoffice/sponsor-packages/${id}`,
        { method: "PATCH", body: JSON.stringify(data), token },
      ),
    deletePackage: (token: string, id: number) =>
      fetchAPI<{ success: boolean }>(`/api/backoffice/sponsor-packages/${id}`, {
        method: "DELETE",
        token,
      }),
    updatePackageFeatures: (
      token: string,
      id: number,
      features: { featureText: string; sortOrder: number }[],
    ) =>
      fetchAPI<{ features: Record<string, unknown>[] }>(
        `/api/backoffice/sponsor-packages/${id}/features`,
        { method: "PUT", body: JSON.stringify({ features }), token },
      ),
    updatePackageComponents: (
      token: string,
      id: number,
      components: { componentPackageId: number; componentRole?: string }[],
    ) =>
      fetchAPI<{ components: Record<string, unknown>[] }>(
        `/api/backoffice/sponsor-packages/${id}/components`,
        { method: "PUT", body: JSON.stringify({ components }), token },
      ),

    createBenefit: (
      token: string,
      eventId: number,
      data: Record<string, unknown>,
    ) =>
      fetchAPI<{ benefit: SponsorBenefit }>(
        `/api/backoffice/events/${eventId}/sponsor/benefits`,
        { method: "POST", body: JSON.stringify(data), token },
      ),
    updateBenefit: (token: string, id: number, data: Record<string, unknown>) =>
      fetchAPI<{ benefit: SponsorBenefit }>(
        `/api/backoffice/sponsor-benefits/${id}`,
        { method: "PATCH", body: JSON.stringify(data), token },
      ),
    deleteBenefit: (token: string, id: number) =>
      fetchAPI<{ success: boolean }>(`/api/backoffice/sponsor-benefits/${id}`, {
        method: "DELETE",
        token,
      }),

    createTimelineItem: (
      token: string,
      eventId: number,
      data: Record<string, unknown>,
    ) =>
      fetchAPI<{ timelineItem: SponsorTimelineItem }>(
        `/api/backoffice/events/${eventId}/sponsor/timeline`,
        { method: "POST", body: JSON.stringify(data), token },
      ),
    updateTimelineItem: (
      token: string,
      id: number,
      data: Record<string, unknown>,
    ) =>
      fetchAPI<{ timelineItem: SponsorTimelineItem }>(
        `/api/backoffice/sponsor-timeline/${id}`,
        { method: "PATCH", body: JSON.stringify(data), token },
      ),
    deleteTimelineItem: (token: string, id: number) =>
      fetchAPI<{ success: boolean }>(`/api/backoffice/sponsor-timeline/${id}`, {
        method: "DELETE",
        token,
      }),

    uploadMedia: (token: string, eventId: number, formData: FormData) =>
      fetchAPI<{ media: SponsorMediaAsset }>(
        `/api/backoffice/events/${eventId}/sponsor/media/upload`,
        { method: "POST", body: formData as unknown as BodyInit, token },
      ),
    createMedia: (
      token: string,
      eventId: number,
      data: Record<string, unknown>,
    ) =>
      fetchAPI<{ media: SponsorMediaAsset }>(
        `/api/backoffice/events/${eventId}/sponsor/media`,
        { method: "POST", body: JSON.stringify(data), token },
      ),
    updateMedia: (token: string, id: number, data: Record<string, unknown>) =>
      fetchAPI<{ media: SponsorMediaAsset }>(
        `/api/backoffice/sponsor-media/${id}`,
        { method: "PATCH", body: JSON.stringify(data), token },
      ),
    deleteMedia: (token: string, id: number) =>
      fetchAPI<{ success: boolean }>(`/api/backoffice/sponsor-media/${id}`, {
        method: "DELETE",
        token,
      }),

    listApplications: (token: string, query?: string) =>
      fetchAPI<{ applications: SponsorApplication[]; pagination: Pagination }>(
        `/api/backoffice/sponsor-applications${query ? `?${query}` : ""}`,
        { token },
      ),
    getApplication: (token: string, id: number) =>
      fetchAPI<{ application: SponsorApplication }>(
        `/api/backoffice/sponsor-applications/${id}`,
        { token },
      ),
    updateApplication: (
      token: string,
      id: number,
      data: Record<string, unknown>,
    ) =>
      fetchAPI<{ application: SponsorApplication }>(
        `/api/backoffice/sponsor-applications/${id}`,
        { method: "PATCH", body: JSON.stringify(data), token },
      ),
    updateApplicationStatus: (
      token: string,
      id: number,
      data: Record<string, unknown>,
    ) =>
      fetchAPI<{ application: SponsorApplication }>(
        `/api/backoffice/sponsor-applications/${id}/status`,
        { method: "PATCH", body: JSON.stringify(data), token },
      ),
    updatePaymentStatus: (
      token: string,
      id: number,
      data: Record<string, unknown>,
    ) =>
      fetchAPI<{ application: SponsorApplication }>(
        `/api/backoffice/sponsor-applications/${id}/payment-status`,
        { method: "PATCH", body: JSON.stringify(data), token },
      ),
  },

  luckyWheel: {
    listDays: (token: string, eventId: number) =>
      fetchAPI<{ eventId: number; days: WheelDayWindow[]; requestId: string }>(
        `/api/backoffice/lucky-wheel/events/${eventId}/days`, { token },
      ),
    getDay: (token: string, eventId: number, date: string) =>
      fetchAPI<{ eventId: number; day: WheelDayWindow | null; requestId: string }>(
        `/api/backoffice/lucky-wheel/events/${eventId}/days/${date}`, { token },
      ),
    saveDay: (token: string, eventId: number, date: string, data: {
      startAt: string; endAt: string; expectedVersion: number | null; reason: string | null;
    }) => fetchAPI<{ eventId: number; day: WheelDayWindow; requestId: string }>(
      `/api/backoffice/lucky-wheel/events/${eventId}/days/${date}`,
      { method: "PUT", body: JSON.stringify(data), token },
    ),
    listDayChanges: (token: string, eventId: number, date: string, page = 1) =>
      fetchAPI<WheelPage<WheelDayChange> & { eventId: number; date: string; requestId: string }>(
        `/api/backoffice/lucky-wheel/events/${eventId}/days/${date}/changes?page=${page}&pageSize=20`, { token },
      ),
    createQrBatch: (token: string, eventId: number, data: {
      date: string; names: string[]; idempotencyKey: string;
    }) => fetchAPI<{ eventId: number; date: string; qrCodes: WheelQrCode[]; replayed: boolean; requestId: string }>(
      `/api/backoffice/lucky-wheel/events/${eventId}/qr-codes`,
      { method: "POST", body: JSON.stringify(data), token },
    ),
    listQrCodes: (token: string, eventId: number, date: string, page = 1) =>
      fetchAPI<WheelPage<WheelQrListItem> & { eventId: number; date: string; requestId: string }>(
        `/api/backoffice/lucky-wheel/events/${eventId}/qr-codes?date=${date}&page=${page}&pageSize=20`, { token },
      ),
    setQrStatus: (token: string, eventId: number, qrId: string, data: {
      status: "open" | "closed"; reason?: string; idempotencyKey: string;
    }) => fetchAPI<WheelQrCode & { replayed: boolean; requestId: string }>(
      `/api/backoffice/lucky-wheel/events/${eventId}/qr-codes/${qrId}`,
      { method: "PATCH", body: JSON.stringify(data), token },
    ),
    getQrDownload: (token: string, eventId: number, qrId: string) =>
      fetchAPI<WheelQrDownload & { requestId: string }>(
        `/api/backoffice/lucky-wheel/events/${eventId}/qr-codes/${qrId}`, { token },
      ),
    listQrClaims: (token: string, eventId: number, qrId: string, page = 1) =>
      fetchAPI<WheelPage<WheelCreditClaim> & { eventId: number; qrId: string; requestId: string }>(
        `/api/backoffice/lucky-wheel/events/${eventId}/qr-codes/${qrId}/claims?page=${page}&pageSize=20`, { token },
      ),
    revokeCreditClaim: (token: string, eventId: number, claimId: string, data: {
      reason: string; idempotencyKey: string;
    }) => fetchAPI<WheelCreditRevocation>(
      `/api/backoffice/lucky-wheel/events/${eventId}/credit-claims/${claimId}/revocations`,
      { method: "POST", body: JSON.stringify(data), token },
    ),
    getState: (token: string, eventId: number) =>
      fetchAPI<AdminWheelState>(
        `/api/backoffice/lucky-wheel/events/${eventId}`,
        { token },
      ),
    setupAttendance: (token: string, eventId: number, data: AttendanceSetupInput) =>
      fetchAPI<AttendanceSetupResult>(`/api/backoffice/lucky-wheel/events/${eventId}/attendance-setup`,
        { method: "POST", body: JSON.stringify(data), token }),
    initialize: (token: string, eventId: number, mainSessionId: number) =>
      fetchAPI<{
        eventId: number;
        wheelId: string;
        mainSessionId: number;
        created: boolean;
        requestId: string;
      }>(`/api/backoffice/lucky-wheel/events/${eventId}`, {
        method: "PUT",
        body: JSON.stringify({ mainSessionId }),
        token,
      }),
    publish: (
      token: string,
      eventId: number,
      data: {
        expectedVersion: number;
        configuration: WheelConfiguration;
        reason?: string;
      },
    ) =>
      fetchAPI<{
        eventId: number;
        version: number;
        poolRevision: number;
        paused: boolean;
        configuration: WheelConfiguration;
        replayed: boolean;
        requestId: string;
      }>(`/api/backoffice/lucky-wheel/events/${eventId}/publication`, {
        method: "PUT",
        body: JSON.stringify(data),
        token,
      }),
    adjustStock: (
      token: string,
      eventId: number,
      data: StockAdjustmentInput,
    ) =>
      fetchAPI<{
        eventId: number;
        segmentId: string;
        before: number;
        after: number;
        delta: number;
        poolRevision: number;
        replayed: boolean;
        requestId: string;
      }>(`/api/backoffice/lucky-wheel/events/${eventId}/stock`, {
        method: "POST",
        body: JSON.stringify(data),
        token,
      }),
    setPaused: (
      token: string,
      eventId: number,
      data: {
        paused: boolean;
        reason: string;
        idempotencyKey: string;
      },
    ) =>
      fetchAPI<{
        eventId: number;
        paused: boolean;
        replayed: boolean;
        requestId: string;
      }>(`/api/backoffice/lucky-wheel/events/${eventId}/pause`, {
        method: "PUT",
        body: JSON.stringify(data),
        token,
      }),
    listSpins: (
      token: string,
      eventId: number,
      query?: URLSearchParams,
    ) =>
      fetchAPI<AdminWheelSpinsResponse>(
        `/api/backoffice/lucky-wheel/events/${eventId}/spins${query && query.size ? `?${query.toString()}` : ""}`,
        { token },
      ),
    uploadImage: (token: string, eventId: number, file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return fetchAPI<WheelImageUpload>(
        `/api/backoffice/lucky-wheel/events/${eventId}/images`,
        {
          method: "POST",
          body: formData as unknown as BodyInit,
          token,
        },
      );
    },
    lookupReward: (token: string, eventId: number, credential: string) =>
      fetchAPI<RewardLookup>(
        `/api/backoffice/lucky-wheel/events/${eventId}/reward-lookups`,
        {
          method: "POST",
          body: JSON.stringify({ credential }),
          token,
        },
      ),
    confirmRedemption: (
      token: string,
      eventId: number,
      spinId: string,
      data: RedemptionInput,
    ) =>
      fetchAPI<Record<string, unknown>>(
        `/api/backoffice/lucky-wheel/events/${eventId}/spins/${spinId}/redemption`,
        { method: "PUT", body: JSON.stringify(data), token },
      ),
    correctRedemption: (
      token: string,
      eventId: number,
      spinId: string,
      data: RedemptionCorrectionInput,
    ) =>
      fetchAPI<Record<string, unknown>>(
        `/api/backoffice/lucky-wheel/events/${eventId}/spins/${spinId}/redemption-corrections`,
        { method: "POST", body: JSON.stringify(data), token },
      ),
  },

  members: {
    list: (token: string, query?: string) =>
      fetchAPI<{ members: Record<string, unknown>[]; pagination: Pagination }>(
        `/api/backoffice/members${query ? `?${query}` : ""}`,
        { token },
      ),
    get: (token: string, id: number) =>
      fetchAPI<{ member: Record<string, unknown> }>(
        `/api/backoffice/members/${id}`,
        { token },
      ),
    stats: (token: string, query?: string) =>
      fetchAPI<{
        total: number;
        purchased: number;
        notPurchased: number;
        byRole: { role: string; count: number }[];
        byStatus: { status: string; count: number }[];
      }>(`/api/backoffice/members/stats/summary${query ? `?${query}` : ""}`, { token }),
    delete: (token: string, id: number) =>
      fetchAPI<{ success: boolean }>(`/api/backoffice/members/${id}`, {
        method: "DELETE",
        token,
      }),
  },

  // File Upload
  uploadFile: (token: string, file: File, folder: string = "general") => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder", folder);
    const resolvedToken = token || getStoredBackofficeToken();
    const headers: Record<string, string> = {};

    if (resolvedToken) {
      headers["Authorization"] = `Bearer ${resolvedToken}`;
    }

    const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;
    return fetch(`${API_BASE_URL}/upload`, {
      method: "POST",
      headers,
      body: formData,
    }).then(async (res) => {
      if (!res.ok) {
        if (res.status === 401) {
          dispatchUnauthorizedEvent();
        }
        throw new Error("Upload failed");
      }
      return res.json() as Promise<{ success: boolean; url: string }>;
    });
  },
};
