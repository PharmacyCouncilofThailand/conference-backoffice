import { ApiError } from './api';

// HealthHack team shown on the check-in result (null for other roles).
export interface HealthHackTeam {
  teamName: string;
  nickname: string | null;
}

export function healthHackOf(registration: unknown): HealthHackTeam | null {
  if (!registration || typeof registration !== 'object') return null;
  const h = (registration as { healthHack?: unknown }).healthHack;
  if (!h || typeof h !== 'object') return null;
  const { teamName, nickname } = h as Record<string, unknown>;
  if (typeof teamName !== 'string' || !teamName) return null;
  return {
    teamName,
    nickname: typeof nickname === 'string' && nickname ? nickname : null,
  };
}

export function healthHackFromError(error: unknown): HealthHackTeam | null {
  if (
    !(error instanceof ApiError) ||
    !error.details ||
    typeof error.details !== 'object' ||
    !('registration' in error.details)
  )
    return null;
  return healthHackOf(error.details.registration);
}
