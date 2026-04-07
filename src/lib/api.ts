import type {
  LoginCredentials,
  LoginResponse,
  User,
  Event,
  EventCreateInput,
  EventUpdateInput,
  Session,
  Ticket,
  Registration,
  VerificationRequest,
  Abstract,
  Speaker,
  PromoCode,
  Payment,
  Pagination,
} from '@/types/api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL;
const AUTH_UNAUTHORIZED_EVENT = "accp-backoffice-auth:unauthorized";

interface FetchOptions extends RequestInit {
  token?: string;
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
  options: FetchOptions = {}
): Promise<T> {
  const { token, ...fetchOptions } = options;
  const resolvedToken =
    token ||
    (endpoint === "/backoffice/login" ? "" : getStoredBackofficeToken());

  const headers: Record<string, string> = {};

  if (fetchOptions.body && typeof fetchOptions.body === 'string') {
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
    const details = error.details ? ` — ${JSON.stringify(error.details)}` : '';
    throw new Error((error.error || `API Error: ${res.status}`) + details);
  }

  return res.json();
}

// API Functions with Proper Types
export const api = {
  auth: {
    login: (credentials: LoginCredentials) =>
      fetchAPI<LoginResponse>('/backoffice/login', {
        method: 'POST',
        body: JSON.stringify(credentials)
      }),
  },

  upload: {
    venueImage: (token: string, formData: FormData) =>
      fetchAPI<{ success: boolean; url: string }>('/api/upload/venue-image', {
        method: 'POST',
        body: formData as unknown as BodyInit,
        token
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
      fetchAPI<{ users: Record<string, unknown>[]; pagination: Pagination }>(`/api/backoffice/users${query ? `?${query}` : ''}`, { token }),
    create: (token: string, data: Record<string, unknown>) =>
      fetchAPI<{ user: Record<string, unknown> }>('/api/backoffice/users', { method: 'POST', body: JSON.stringify(data), token }),
    update: (token: string, id: number, data: Record<string, unknown>) =>
      fetchAPI<{ user: Record<string, unknown> }>(`/api/backoffice/users/${id}`, { method: 'PATCH', body: JSON.stringify(data), token }),
    delete: (token: string, id: number) =>
      fetchAPI<{ success: boolean }>(`/api/backoffice/users/${id}`, { method: 'DELETE', token }),
    assignEvents: (token: string, id: number, eventIds: number[]) =>
      fetchAPI<{ success: boolean; count: number }>(`/api/backoffice/users/${id}/assignments`, { method: 'POST', body: JSON.stringify({ eventIds }), token }),
    assignEventsAndSessions: (token: string, id: number, assignments: { eventId: number; sessionIds?: number[] }[]) =>
      fetchAPI<{ success: boolean }>(`/api/backoffice/users/${id}/assignments`, { method: 'PUT', body: JSON.stringify({ assignments }), token }),
  },

  verifications: {
    list: (token: string, query?: string) =>
      fetchAPI<{ verifications: VerificationRequest[]; pagination: Pagination }>(`/api/backoffice/verifications${query ? `?${query}` : ''}`, { token }),
    approve: (token: string, id: string, comment?: string) =>
      fetchAPI<{ success: boolean; user: User }>(`/api/backoffice/verifications/${id}/approve`, { method: "POST", body: JSON.stringify({ comment }), token }),
    reject: (token: string, id: string, reason: string) =>
      fetchAPI<{ success: boolean; user: User }>(`/api/backoffice/verifications/${id}/reject`, { method: "POST", body: JSON.stringify({ reason }), token }),
    getRejectionHistory: (token: string, id: string) =>
      fetchAPI<{ history: { id: number; reason: string; rejectedAt: string; rejectedBy: number | null; rejectedByName: string | null }[] }>(`/api/backoffice/verifications/${id}/rejection-history`, { token }),
  },

  backofficeEvents: {
    list: (token: string, query?: string) =>
      fetchAPI<{ events: Record<string, unknown>[]; pagination: Pagination }>(`/api/backoffice/events${query ? `?${query}` : ''}`, { token }),
    get: (token: string, id: number) =>
      fetchAPI<{ event: Event; sessions: Record<string, unknown>[]; tickets: Record<string, unknown>[]; venueImages: { id: number; url: string; imageUrl?: string; caption?: string }[] }>(`/api/backoffice/events/${id}`, { token }),
    create: (token: string, data: EventCreateInput) =>
      fetchAPI<{ event: Event }>('/api/backoffice/events', { method: 'POST', body: JSON.stringify(data), token }),
    update: (token: string, id: number, data: EventUpdateInput) =>
      fetchAPI<{ event: Event }>(`/api/backoffice/events/${id}`, { method: 'PATCH', body: JSON.stringify(data), token }),
    delete: (token: string, id: number) =>
      fetchAPI<void>(`/api/backoffice/events/${id}`, { method: 'DELETE', token }),

    // Sessions nested routes (using Record for page compatibility)
    getSessions: (token: string, eventId: number) =>
      fetchAPI<{ sessions: Record<string, unknown>[] }>(`/api/backoffice/events/${eventId}/sessions`, { token }),
    createSession: (token: string, eventId: number, data: Record<string, unknown>) =>
      fetchAPI<{ session: Record<string, unknown> }>(`/api/backoffice/events/${eventId}/sessions`, { method: 'POST', body: JSON.stringify(data), token }),
    updateSession: (token: string, eventId: number, sessionId: number, data: Record<string, unknown>) =>
      fetchAPI<{ session: Record<string, unknown> }>(`/api/backoffice/events/${eventId}/sessions/${sessionId}`, { method: 'PATCH', body: JSON.stringify(data), token }),
    deleteSession: (token: string, eventId: number, sessionId: number) =>
      fetchAPI<void>(`/api/backoffice/events/${eventId}/sessions/${sessionId}`, { method: 'DELETE', token }),
    getSessionEnrollments: (token: string, eventId: number, sessionId: number) =>
      fetchAPI<{ enrollments: { id: number; regCode: string; email: string; firstName: string; lastName: string; status: string; createdAt: string; ticketName: string | null }[]; count: number }>(`/api/backoffice/events/${eventId}/sessions/${sessionId}/enrollments`, { token }),

    // Tickets nested routes (using Record for page compatibility)
    getTickets: (token: string, eventId: number) =>
      fetchAPI<{ tickets: Record<string, unknown>[] }>(`/api/backoffice/events/${eventId}/tickets`, { token }),
    createTicket: (token: string, eventId: number, data: Record<string, unknown>) =>
      fetchAPI<{ ticket: Record<string, unknown> }>(`/api/backoffice/events/${eventId}/tickets`, { method: 'POST', body: JSON.stringify(data), token }),
    updateTicket: (token: string, eventId: number, ticketId: number, data: Record<string, unknown>) =>
      fetchAPI<{ ticket: Record<string, unknown> }>(`/api/backoffice/events/${eventId}/tickets/${ticketId}`, { method: 'PATCH', body: JSON.stringify(data), token }),
    deleteTicket: (token: string, eventId: number, ticketId: number) =>
      fetchAPI<void>(`/api/backoffice/events/${eventId}/tickets/${ticketId}`, { method: 'DELETE', token }),

    // Images nested routes
    addImage: (token: string, eventId: number, data: { imageUrl: string; caption?: string }) =>
      fetchAPI<{ image: { id: number; imageUrl: string } }>(`/api/backoffice/events/${eventId}/images`, { method: 'POST', body: JSON.stringify(data), token }),
    deleteImage: (token: string, eventId: number, imageId: number) =>
      fetchAPI<void>(`/api/backoffice/events/${eventId}/images/${imageId}`, { method: 'DELETE', token }),
  },

  speakers: {
    list: (token: string, query?: string) =>
      fetchAPI<{ speakers: Record<string, unknown>[]; eventSpeakers?: { speakerId: number; eventId: number; sessionId: number | null }[] }>(`/api/backoffice/speakers${query ? `?${query}` : ''}`, { token }),
    create: (token: string, data: Record<string, unknown>) =>
      fetchAPI<{ speaker: Record<string, unknown> }>('/api/backoffice/speakers', { method: 'POST', body: JSON.stringify(data), token }),
    update: (token: string, id: number, data: Record<string, unknown>) =>
      fetchAPI<{ speaker: Record<string, unknown> }>(`/api/backoffice/speakers/${id}`, { method: 'PATCH', body: JSON.stringify(data), token }),
    delete: (token: string, id: number) =>
      fetchAPI<void>(`/api/backoffice/speakers/${id}`, { method: 'DELETE', token }),
    assignEvents: (token: string, speakerId: number, assignments: { eventId: number; sessionId: number | null }[]) =>
      fetchAPI<{ success: boolean }>(`/api/backoffice/speakers/${speakerId}/events`, {
        method: 'POST',
        body: JSON.stringify({ assignments }),
        token,
      }),
  },

  registrations: {
    list: (token: string, query?: string) =>
      fetchAPI<{ registrations: Record<string, unknown>[]; pagination: Pagination }>(`/api/backoffice/registrations${query ? `?${query}` : ''}`, { token }),
    get: (token: string, id: number) =>
      fetchAPI<{ registration: Record<string, unknown> }>(`/api/backoffice/registrations/${id}`, { token }),
    update: (token: string, id: number, data: Record<string, unknown>) =>
      fetchAPI<{ registration: Record<string, unknown> }>(`/api/backoffice/registrations/${id}`, { method: 'PATCH', body: JSON.stringify(data), token }),
    manualAdd: (token: string, data: { userId: number; eventId: number; ticketTypeId: number; sessionIds?: number[]; note?: string }) =>
      fetchAPI<{ success: boolean; registration: Record<string, unknown> }>('/api/backoffice/registrations/manual', { method: 'POST', body: JSON.stringify(data), token }),
    batchManualAdd: (token: string, data: { userIds: number[]; eventId: number; ticketTypeId: number; sessionIds?: number[]; note?: string }) =>
      fetchAPI<{ success: boolean; addedCount: number; successList: any[]; skippedList: { userId: number; reason: string }[] }>('/api/backoffice/registrations/manual/batch', { method: 'POST', body: JSON.stringify(data), token }),
    getRegisteredUsers: (token: string, eventId: number, ticketTypeId?: number) =>
      fetchAPI<{ registeredUserIds: number[]; ticketCategory?: string }>(`/api/backoffice/registrations/registered-users?eventId=${eventId}${ticketTypeId ? `&ticketTypeId=${ticketTypeId}` : ''}`, { token }),
    addSessions: (token: string, id: number, data: { sessionIds: number[]; ticketTypeId: number; note?: string }) =>
      fetchAPI<{ success: boolean; addedCount: number }>(`/api/backoffice/registrations/${id}/sessions`, { method: 'POST', body: JSON.stringify(data), token }),
  },

  abstracts: {
    list: (token: string, query?: string) =>
      fetchAPI<{ abstracts: Record<string, unknown>[]; pagination: Pagination }>(`/api/backoffice/abstracts${query ? `?${query}` : ''}`, { token }),
    get: (token: string, id: number) =>
      fetchAPI<{ abstract: Record<string, unknown> }>(`/api/backoffice/abstracts/${id}`, { token }),
    updateStatus: (token: string, id: number, status: string, comment?: string) =>
      fetchAPI<{ abstract: Record<string, unknown> }>(`/api/backoffice/abstracts/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status, comment }), token }),
  },

  checkins: {
    list: (token: string, query?: string) =>
      fetchAPI<{ checkins: any[]; pagination: Pagination }>(`/api/backoffice/checkins${query ? `?${query}` : ''}`, { token }),
    create: (token: string, data: { regCode: string; sessionId?: number; checkInAll?: boolean; assignedSessionId?: number }) =>
      fetchAPI<any>(`/api/backoffice/checkins`, { method: 'POST', body: JSON.stringify(data), token }),
    stats: (token: string, query?: string) =>
      fetchAPI<{ total: number; checkedIn: number; remaining: number; percentage: number }>(`/api/backoffice/checkins/stats${query ? `?${query}` : ''}`, { token }),
    undo: (token: string, registrationSessionId: number) =>
      fetchAPI<{ success: boolean; undone: any }>(`/api/backoffice/checkins/undo`, { method: 'POST', body: JSON.stringify({ registrationSessionId }), token }),
  },

  tickets: {
    list: (token: string, query?: string) =>
      fetchAPI<{ tickets: Ticket[]; pagination: Pagination }>(`/api/backoffice/tickets${query ? `?${query}` : ''}`, { token }),
  },

  sessions: {
    list: (token: string, query?: string) =>
      fetchAPI<{ sessions: Session[]; pagination: Pagination }>(`/api/backoffice/sessions${query ? `?${query}` : ''}`, { token }),
  },

  payments: {
    list: (token: string) =>
      fetchAPI<{ payments: Payment[] }>("/api/payments", { token }),
  },

  promoCodes: {
    list: (token: string, query?: string) =>
      fetchAPI<{ promoCodes: Record<string, unknown>[]; pagination: Pagination }>(`/api/backoffice/promo-codes${query ? `?${query}` : ''}`, { token }),
    get: (token: string, id: number) =>
      fetchAPI<{ promoCode: Record<string, unknown> }>(`/api/backoffice/promo-codes/${id}`, { token }),
    create: (token: string, data: Record<string, unknown>) =>
      fetchAPI<{ promoCode: Record<string, unknown> }>('/api/backoffice/promo-codes', { method: 'POST', body: JSON.stringify(data), token }),
    update: (token: string, id: number, data: Record<string, unknown>) =>
      fetchAPI<{ promoCode: Record<string, unknown> }>(`/api/backoffice/promo-codes/${id}`, { method: 'PUT', body: JSON.stringify(data), token }),
    delete: (token: string, id: number) =>
      fetchAPI<{ success: boolean }>(`/api/backoffice/promo-codes/${id}`, { method: 'DELETE', token }),
    toggle: (token: string, id: number) =>
      fetchAPI<{ promoCode: Record<string, unknown> }>(`/api/backoffice/promo-codes/${id}/toggle`, { method: 'PATCH', token }),
  },

  members: {
    list: (token: string, query?: string) =>
      fetchAPI<{ members: Record<string, unknown>[]; pagination: Pagination }>(`/api/backoffice/members${query ? `?${query}` : ''}`, { token }),
    get: (token: string, id: number) =>
      fetchAPI<{ member: Record<string, unknown> }>(`/api/backoffice/members/${id}`, { token }),
    stats: (token: string) =>
      fetchAPI<{ total: number; byRole: { role: string; count: number }[]; byStatus: { status: string; count: number }[] }>('/api/backoffice/members/stats/summary', { token }),
    delete: (token: string, id: number) =>
      fetchAPI<{ success: boolean }>(`/api/backoffice/members/${id}`, { method: 'DELETE', token }),
  },

  // File Upload
  uploadFile: (token: string, file: File, folder: string = 'general') => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', folder);
    const resolvedToken = token || getStoredBackofficeToken();
    const headers: Record<string, string> = {};

    if (resolvedToken) {
      headers['Authorization'] = `Bearer ${resolvedToken}`;
    }

    const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;
    return fetch(`${API_BASE_URL}/upload`, {
      method: 'POST',
      headers,
      body: formData
    }).then(async (res) => {
      if (!res.ok) {
        if (res.status === 401) {
          dispatchUnauthorizedEvent();
        }
        throw new Error('Upload failed');
      }
      return res.json() as Promise<{ success: boolean; url: string }>;
    });
  }
};
