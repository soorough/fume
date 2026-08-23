import { and, count, desc, eq, isNull } from 'drizzle-orm';
import { env } from './config';
import { db } from './db/client';
import { conversations, messages, type Conversation, type Message } from './db/schema';
import { resolveProvider } from './providers/model';

export async function openConversation(
  userId: string,
): Promise<{ conversation: Conversation; resumed: boolean }> {
  const [open] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.userId, userId), isNull(conversations.endedAt)))
    .orderBy(desc(conversations.startedAt))
    .limit(1);
  if (open) return { conversation: open, resumed: true };
  const [created] = await db
    .insert(conversations)
    .values({ userId })
    .returning();
  return { conversation: created, resumed: false };
}

export async function appendMessage(
  conversationId: string,
  role: 'user' | 'assistant',
  content: string,
): Promise<Message> {
  const [agg] = await db
    .select({ n: count() })
    .from(messages)
    .where(
      and(
        eq(messages.conversationId, conversationId),
        eq(messages.role, 'user'),
      ),
    );
  const [msg] = await db
    .insert(messages)
    .values({ conversationId, role, content, round: agg.n + 1 })
    .returning();
  await db
    .update(conversations)
    .set({ lastMessageAt: new Date() })
    .where(eq(conversations.id, conversationId));
  return msg;
}

export async function recentMessages(
  conversationId: string,
  limit = env.CONTEXT_WINDOW_LAST_N,
): Promise<Message[]> {
  const rows = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(desc(messages.createdAt))
    .limit(limit);
  return rows.reverse();
}

async function summarize(
  conversationId: string,
): Promise<string | undefined> {
  const history = await recentMessages(conversationId, 12);
  if (history.length < 4) return undefined;
  const transcript = history
    .map((m) => `${m.role}: ${m.content}`)
    .join('\n');
  const { text } = await resolveProvider().generate({
    messages: [
      {
        role: 'system',
        content:
          'From the transcript, write one short sentence in the style of a friend recalling what the user was talking about. Start with "We were talking about ". Max 20 words. Return only the sentence.',
      },
      { role: 'user', content: transcript },
    ],
    temperature: 0.3,
  });
  return text.trim();
}

export async function closeConversation(
  userId: string,
): Promise<{ summary?: string }> {
  const [open] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.userId, userId), isNull(conversations.endedAt)))
    .orderBy(desc(conversations.startedAt))
    .limit(1);
  if (!open) return {};
  await db
    .update(conversations)
    .set({ endedAt: new Date() })
    .where(eq(conversations.id, open.id));
  if (!env.SUMMARY_ON_END || open.summary) return { summary: open.summary ?? undefined };
  try {
    const summary = await summarize(open.id);
    if (summary) {
      await db
        .update(conversations)
        .set({ summary })
        .where(eq(conversations.id, open.id));
      return { summary };
    }
  } catch {
    // summarizer is best-effort; M1 may run without summary
  }
  return {};
}

export async function latestSummary(userId: string): Promise<string | null> {
  const [latest] = await db
    .select({ summary: conversations.summary })
    .from(conversations)
    .where(eq(conversations.userId, userId))
    .orderBy(desc(conversations.lastMessageAt))
    .limit(1);
  return latest?.summary ?? null;
}
