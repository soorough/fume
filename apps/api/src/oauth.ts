import { createHmac, randomBytes } from 'node:crypto';
import { env } from './config';

const TOKEN_TTL_SECONDS = 3600;
// Alexa keeps the refresh token privately and exchanges it for a new access
// token when the old one expires. Without one the link simply dies after an
// hour and the user has to link again by hand.
const REFRESH_TTL_SECONDS = 60 * 60 * 24 * 365;
const codes = new Map<string, { expiresAt: number }>();

function b64u(data: Buffer | string): string {
  return Buffer.from(data).toString('base64url');
}

function sign(payload: Record<string, unknown>): string {
  const header = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64u(JSON.stringify(payload));
  const sig = createHmac('sha256', env.OAUTH_CLIENT_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');
  return `${header}.${body}.${sig}`;
}

export function verifyToken(
  token: string,
  expected: 'access' | 'refresh' = 'access',
): { sub: string } | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;
  const expectedSig = createHmac('sha256', env.OAUTH_CLIENT_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');
  if (!sig || sig.length !== expectedSig.length) return null;
  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length) return null;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  if (diff !== 0) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (typeof payload.exp !== 'number' || payload.exp < Date.now() / 1000) {
      return null;
    }
    // A refresh token must never be accepted as a bearer credential, nor an
    // access token spent as a refresh token.
    const kind = payload.kind === 'refresh' ? 'refresh' : 'access';
    if (kind !== expected) return null;
    return { sub: payload.sub };
  } catch {
    return null;
  }
}

export async function issueCode(): Promise<string> {
  const code = randomBytes(24).toString('hex');
  codes.set(code, { expiresAt: Date.now() + 120000 });
  return code;
}

export function consumeCode(code: string): boolean {
  const entry = codes.get(code);
  if (!entry) return false;
  if (entry.expiresAt < Date.now()) {
    codes.delete(code);
    return false;
  }
  codes.delete(code);
  return true;
}

export function issueToken(sub: string): {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
} {
  const now = Math.floor(Date.now() / 1000);
  return {
    access_token: sign({
      sub,
      kind: 'access',
      iat: now,
      exp: now + TOKEN_TTL_SECONDS,
    }),
    refresh_token: sign({
      sub,
      kind: 'refresh',
      iat: now,
      exp: now + REFRESH_TTL_SECONDS,
    }),
    token_type: 'Bearer',
    expires_in: TOKEN_TTL_SECONDS,
  };
}

export function ownerId(): string {
  return env.OAUTH_OWNER;
}
