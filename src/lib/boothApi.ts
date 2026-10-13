import { fetchAPI } from './api';
import type {
  BoothSummary,
  BoothMemberReport,
  BoothType,
} from '../types/booths';
type Page = { page: number; limit: number; total: number; totalPages: number };
const base = (eventId: number) => `/api/backoffice/events/${eventId}/booths`;
export const boothApi = {
  list: (
    eventId: number,
    q: URLSearchParams,
    token: string,
    signal?: AbortSignal,
  ) =>
    fetchAPI<{ booths: BoothSummary[]; pagination: Page }>(
      `${base(eventId)}?${q}`,
      { token, signal },
    ),
  create: (
    eventId: number,
    input: { name: string; type: BoothType },
    token: string,
  ) =>
    fetchAPI(base(eventId), {
      token,
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (
    eventId: number,
    id: number,
    input: { name: string; type: BoothType },
    token: string,
  ) =>
    fetchAPI(`${base(eventId)}/${id}`, {
      token,
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  members: (
    eventId: number,
    id: number,
    q: URLSearchParams,
    token: string,
    signal?: AbortSignal,
  ) =>
    fetchAPI<BoothMemberReport>(`${base(eventId)}/${id}/members?${q}`, {
      token,
      signal,
    }),
  exportMembers: (eventId: number, id: number, token: string) =>
    fetchAPI<BoothMemberReport>(`${base(eventId)}/${id}/members/export`, {
      token,
    }),
};
