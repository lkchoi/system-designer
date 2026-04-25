export interface JwtParts {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  signature: string;
  isExpired: boolean;
  expiresAt: Date | null;
  issuedAt: Date | null;
}

function base64UrlDecode(str: string): string {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4;
  const final = pad ? padded + "=".repeat(4 - pad) : padded;
  return atob(final);
}

export function decodeJwt(token: string): JwtParts | { error: string } {
  const parts = token.trim().split(".");
  if (parts.length !== 3) return { error: "JWT must have 3 parts separated by dots" };

  try {
    const header = JSON.parse(base64UrlDecode(parts[0]));
    const payload = JSON.parse(base64UrlDecode(parts[1]));
    const signature = parts[2];

    const exp = typeof payload.exp === "number" ? new Date(payload.exp * 1000) : null;
    const iat = typeof payload.iat === "number" ? new Date(payload.iat * 1000) : null;
    const isExpired = exp ? exp.getTime() < Date.now() : false;

    return { header, payload, signature, isExpired, expiresAt: exp, issuedAt: iat };
  } catch {
    return { error: "Failed to decode JWT — invalid base64 or JSON" };
  }
}

export function formatTimestamp(date: Date | null): string {
  if (!date) return "—";
  return date.toLocaleString();
}

export function timeUntilExpiry(exp: Date | null): string {
  if (!exp) return "No expiry";
  const diff = exp.getTime() - Date.now();
  if (diff <= 0) return "Expired";
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

export const KNOWN_CLAIMS: Record<string, string> = {
  iss: "Issuer",
  sub: "Subject",
  aud: "Audience",
  exp: "Expiration",
  nbf: "Not Before",
  iat: "Issued At",
  jti: "JWT ID",
  name: "Name",
  email: "Email",
  role: "Role",
  scope: "Scope",
};
