import { and, desc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { env } from './config';
import { db } from './db/client';
import { memories, memorySuppressions, messages } from './db/schema';
import { resolveProvider } from './providers/model';

const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'for', 'nor', 'of', 'to', 'with',
  'was', 'were', 'is', 'am', 'are', 'be', 'do', 'did', 'does', 'have', 'has',
  'had', 'that', 'this', 'these', 'those', 'i', 'me', 'my', 'we', 'our',
  'you', 'your', 'it', 'its', 'they', 'them', 'their', 'he', 'she', 'his',
  'her', 'on', 'at', 'in', 'from', 'by', 'not', 'so', 'just', 'like', 'about',
  'should', 'would', 'could', 'can', 'will', 'what', 'when', 'where', 'how',
  'why', 'who', 'which', 'really', 'think', 'going', 'want', 'need',
]);

function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

export function normalize(s: string): string {
  return s.trim().replace(/\.$/, '').toLowerCase();
}

export async function retrieveMemories(
  userId: string,
  query: string,
  limit = env.MEMORY_RETRIEVE_LIMIT,
) {
  const rows = await db
    .select()
    .from(memories)
    .where(and(eq(memories.userId, userId), eq(memories.status, 'active')))
    .orderBy(desc(memories.importance))
    .limit(40);
  const q = tokens(query);
  const scored = rows
    .map((m) => {
      const t = tokens(m.content);
      const hits = t.filter((x) => q.includes(x)).length;
      return { memory: m, score: hits + m.importance };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  const ids = scored.map(({ memory }) => memory.id);
  if (ids.length) {
    void db
      .update(memories)
      .set({ lastRetrievedAt: new Date() })
      .where(and(eq(memories.userId, userId), eq(memories.status, 'active')))
      .then(() => undefined);
  }
  return scored.map(({ memory }) => memory);
}

const extractionPrompt = [
  'You are Fume\'s memory extractor. You hear one utterance from a conversation.',
  'Return ONLY a JSON array (no prose) of durable facts worth remembering long-term, each as:',
  '{"content": "user likes X", "type": "semantic|episodic|profile|preference", "importance": 0.0-1.0}',
  'Rules:',
  '- Only durable facts: preferences, identities, beliefs, plans, significant events.',
  '- Ignore chit-chat, questions, or anything transient ("I had coffee" -> omit).',
  '- importance: 0.95 life-changing (move/impending job), 0.8 clear preference, 0.6 mild preference or plan.',
  '- If nothing is worth remembering, return [].',
].join('\n');

const factSchema = z.object({
  content: z.string().min(1).max(280),
  type: z.enum(['semantic', 'episodic', 'profile', 'preference']),
  importance: z.number().min(0).max(1),
});
const factsSchema = z.array(factSchema);

function stripCodeFence(s: string): string {
  return s
    .replace(/^```(?:json)?\s*/m, '')
    .replace(/```\s*$/, '')
    .trim();
}

function parseFacts(text: string): z.infer<typeof factsSchema> {
  try {
    return factsSchema.parse(JSON.parse(stripCodeFence(text)));
  } catch {
    return [];
  }
}

async function isSuppressed(userId: string, content: string): Promise<boolean> {
  const suppressed = await db
    .select()
    .from(memorySuppressions)
    .where(eq(memorySuppressions.userId, userId));
  const n = normalize(content);
  return suppressed.some((s) => n.includes(normalize(s.pattern)));
}

async function alreadyStored(userId: string, content: string): Promise<boolean> {
  const existing = await db
    .select({ content: memories.content })
    .from(memories)
    .where(and(eq(memories.userId, userId), eq(memories.status, 'active')))
    .limit(200);
  const n = normalize(content);
  return existing.some((e) => normalize(e.content) === n);
}

export async function extractMemories(
  userId: string,
  conversationId: string,
  sourceMessageId: string,
  utterance: string,
): Promise<number> {
  if (!env.MEMORY_EXTRACTION_ENABLED) return 0;
  const { text } = await resolveProvider().generate({
    messages: [
      { role: 'system', content: extractionPrompt },
      { role: 'user', content: utterance },
    ],
    temperature: 0.2,
  });
  const facts = parseFacts(text).filter(
    (f) => f.importance >= env.MEMORY_IMPORTANCE_THRESHOLD,
  );
  let stored = 0;
  for (const fact of facts) {
    if (await alreadyStored(userId, fact.content)) continue;
    if (await isSuppressed(userId, fact.content)) continue;
    await db.insert(memories).values({
      userId,
      conversationId,
      sourceMessageId,
      content: fact.content,
      type: fact.type,
      importance: fact.importance,
    });
    stored += 1;
  }
  return stored;
}

export async function pinLastMessage(
  userId: string,
  conversationId: string,
): Promise<number> {
  const [last] = await db
    .select()
    .from(messages)
    .where(
      and(
        eq(messages.conversationId, conversationId),
        eq(messages.role, 'user'),
      ),
    )
    .orderBy(desc(messages.createdAt))
    .limit(1);
  if (!last) return 0;
  const content = last.content.trim();
  if (await alreadyStored(userId, content)) return 0;
  await db.insert(memories).values({
    userId,
    conversationId,
    sourceMessageId: last.id,
    content,
    type: 'profile',
    importance: 1,
  });
  return 1;
}

export async function forget(userId: string, pattern: string): Promise<number> {
  const normalized = pattern.trim().toLowerCase();
  if (!normalized) throw new Error('empty pattern');
  await db.insert(memorySuppressions).values({ userId, pattern: normalized });
  const rows = await db
    .select({ id: memories.id, content: memories.content })
    .from(memories)
    .where(and(eq(memories.userId, userId), eq(memories.status, 'active')));
  const ids = rows
    .filter((r) => r.content.toLowerCase().includes(normalized))
    .map((r) => r.id);
  if (ids.length) {
    await db
      .update(memories)
      .set({ status: 'suppressed' })
      .where(inArray(memories.id, ids));
  }
  return ids.length;
}

export async function recall(userId: string) {
  return db
    .select({
      content: memories.content,
      type: memories.type,
      importance: memories.importance,
      createdAt: memories.createdAt,
    })
    .from(memories)
    .where(and(eq(memories.userId, userId), eq(memories.status, 'active')))
    .orderBy(desc(memories.importance))
    .limit(50);
}

export async function lastUserMessageForConversation(
  conversationId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ content: messages.content })
    .from(messages)
    .where(
      and(
        eq(messages.conversationId, conversationId),
        eq(messages.role, 'user'),
      ),
    )
    .orderBy(desc(messages.createdAt))
    .limit(1);
  return row?.content ?? null;
}

