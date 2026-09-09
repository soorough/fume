import { eq } from 'drizzle-orm';
import type { FastifyRequest } from 'fastify';
import { env } from './config';
import { db } from './db/client';
import { users } from './db/schema';
import { verifyToken } from './oauth';

const profileCache = new Map<
  string,
  { amazonUserId: string; fetchedAt: number }
>();

async function amazonUserIdFromToken(accessToken: string): Promise<string> {
  const cached = profileCache.get(accessToken);
  if (cached && Date.now() - cached.fetchedAt < env.LWA_TOKEN_CACHE_TTL_MS) {
    return cached.amazonUserId;
  }
  const res = await fetch(env.LWA_PROFILE_URL, {
    headers: { authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`LWA profile ${res.status}`);
  const data = (await res.json()) as { user_id: string };
  if (!data.user_id) throw new Error('LWA profile missing user_id');
  profileCache.set(accessToken, {
    amazonUserId: data.user_id,
    fetchedAt: Date.now(),
  });
  return data.user_id;
}

async function upsertUser(amazonUserId: string): Promise<string> {
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.amazonUserId, amazonUserId))
    .limit(1);
  if (existing[0]) return existing[0].id;
  const [row] = await db
    .insert(users)
    .values({ amazonUserId })
    .returning({ id: users.id });
  return row.id;
}

// Alexa sends a stable, unique-per-skill id for the speaking user on every
// request. Our own OAuth cannot tell users apart — /auth/authorize never learns
// who is linking, so every token it mints carries the same subject — which meant
// every linked user shared one memory store. Prefer Alexa's id when the skill
// forwards it, and fall back to the token subject only when it is absent.
function looksLikeOwnToken(token: string): boolean {
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  try {
    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
    return header.alg === 'HS256' && header.typ === 'JWT';
  } catch {
    return false;
  }
}

function alexaUserId(req: FastifyRequest): string | undefined {
  const id = req.headers['x-fume-alexa-user-id'];
  return typeof id === 'string' && id.startsWith('amzn1.ask.account.')
    ? id
    : undefined;
}

export async function authenticate(req: FastifyRequest): Promise<string> {
  const header = req.headers.authorization ?? '';
  if (header.startsWith('Bearer ')) {
    const token = header.slice(7).trim();
    if (token) {
      const jwt = verifyToken(token);
      if (jwt) return upsertUser(alexaUserId(req) ?? jwt.sub);
      if (env.NODE_ENV !== 'production' && token === env.DEV_AUTH_KEY) {
        return upsertUser('dev-user');
      }
      // Only hand opaque tokens to LWA. One shaped like our own JWT that failed
      // verification is expired, forged, or a refresh token being spent as a
      // bearer credential — all of which are 'unauthorized', not a reason to
      // ask Amazon about a token Amazon never issued.
      if (looksLikeOwnToken(token)) throw new Error('unauthorized');
      return upsertUser(await amazonUserIdFromToken(token));
    }
  }
  const devKey = req.headers['x-fume-dev-key'];
  if (
    env.NODE_ENV !== 'production' &&
    typeof devKey === 'string' &&
    devKey === env.DEV_AUTH_KEY
  ) {
    return upsertUser('dev-user');
  }
  throw new Error('unauthorized');
}
