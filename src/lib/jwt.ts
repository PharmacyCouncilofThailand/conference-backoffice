export interface JwtPayload {
  exp?: unknown;
  [claim: string]: unknown;
}

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (normalized.length % 4)) % 4);

  return atob(normalized + padding);
}

export function decodeJwtPayload(token: string): JwtPayload {
  const parts = token.split(".");
  const encodedPayload = parts[1];

  if (parts.length !== 3 || !encodedPayload) {
    throw new Error("Invalid JWT format");
  }

  const binaryPayload = decodeBase64Url(encodedPayload);
  const bytes = Uint8Array.from(binaryPayload, (character) =>
    character.charCodeAt(0),
  );

  return JSON.parse(new TextDecoder().decode(bytes)) as JwtPayload;
}

export function isTokenExpired(token: string, now = Date.now()): boolean {
  try {
    const payload = decodeJwtPayload(token);

    return typeof payload.exp !== "number" || payload.exp * 1000 <= now;
  } catch {
    return true;
  }
}
