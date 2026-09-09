import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { authenticate } from './auth';
import { env } from './config';
import * as memory from './memory';
import * as oauth from './oauth';
import { buildSystemPrompt, memoryBlock } from './prompt';
import { resolveProvider } from './providers/model';
import * as sessions from './sessions';

function unauthorized(): Error {
  const e = new Error('unauthorized');
  Object.assign(e, { statusCode: 401 });
  return e;
}

const requireAuth = async (req: FastifyRequest): Promise<void> => {
  try {
    req.userId = await authenticate(req);
  } catch (err) {
    // Only a genuine credential failure is a 401. Anything else (database
    // down, missing schema, LWA unreachable) is a server fault, and reporting
    // it as 401 makes an outage indistinguishable from a bad token.
    req.log.error({ err }, 'authenticate failed');
    if (err instanceof Error && err.message === 'unauthorized') {
      throw unauthorized();
    }
    throw err;
  }
};

const respondSchema = z.object({
  utterance: z.string().min(1).max(2000),
});

const forgetSchema = z.object({
  target: z.string().min(1).max(2000).optional(),
});

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  app.get('/v1/health', async () => ({ ok: true }));

  app.get('/auth/authorize', async (req, reply) => {
    const q = req.query as Record<string, string | undefined>;
    if (q.response_type !== 'code') {
      return reply.status(400).send('invalid authorize request');
    }
    const redirectUri = q.redirect_uri ?? 'https://pitangui.amazon.com/api/skill/link/M2DIFADMJJC323';
    const code = await oauth.issueCode();
    try {
      const url = new URL(redirectUri);
      url.searchParams.set('code', code);
      if (q.state) url.searchParams.set('state', q.state);
      return reply.redirect(url.toString());
    } catch {
      return reply.status(400).send('invalid redirect_uri');
    }
  });

  app.post('/auth/token', async (req, reply) => {
    const body = (req.body ?? {}) as Record<string, string | undefined>;
    let clientId = body.client_id;
    let clientSecret = body.client_secret;
    const auth = req.headers.authorization ?? '';
    if (auth.startsWith('Basic ')) {
      const [user, pass] = Buffer.from(auth.slice(6), 'base64')
        .toString()
        .split(':');
      clientId = user;
      clientSecret = pass;
    }
    if (
      clientId !== env.OAUTH_CLIENT_ID ||
      clientSecret !== env.OAUTH_CLIENT_SECRET
    ) {
      return reply.status(401).send({ error: 'invalid_client' });
    }
    if (body.grant_type !== 'authorization_code') {
      return reply.status(400).send({ error: 'unsupported_grant_type' });
    }
    if (!body.code || !oauth.consumeCode(body.code)) {
      return reply.status(400).send({ error: 'invalid_grant' });
    }
    return reply.send(oauth.issueToken(oauth.ownerId()));
  });

  app.post(
    '/v1/open',
    { preHandler: requireAuth },
    async (req) => {
      const { conversation, resumed } = await sessions.openConversation(
        req.userId!,
      );
      let text: string;
      if (resumed) {
        text = 'Welcome back.';
        if (conversation.summary) {
          text += ` ${conversation.summary} Want to continue?`;
        } else {
          text += ' Want to continue where we left off?';
        }
      } else {
        const previous = await sessions.latestSummary(req.userId!);
        if (previous) {
          text = `Welcome back. ${previous} Want to pick that up?`;
        } else {
          text = "Hey, I'm Fume. I'm listening — say whatever is on your mind.";
        }
      }
      return { conversationId: conversation.id, resumed, text };
    },
  );

  app.post(
    '/v1/respond',
    { preHandler: requireAuth },
    async (req, reply) => {
      const parsed = respondSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'invalid body' });
      }
      const userId = req.userId!;
      const utterance = parsed.data.utterance.trim();
      const { conversation } = await sessions.openConversation(userId);
      const userMsg = await sessions.appendMessage(
        conversation.id,
        'user',
        utterance,
      );
      const relevant = await memory.retrieveMemories(userId, utterance);
      const history = await sessions.recentMessages(conversation.id);
      const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
        { role: 'system', content: buildSystemPrompt() },
      ];
      if (relevant.length) {
        messages.push({
          role: 'system',
          content: memoryBlock(relevant),
        });
      }
      for (const m of history) {
        messages.push({ role: m.role, content: m.content });
      }
      const { text } = await resolveProvider().generate({ messages });
      await sessions.appendMessage(conversation.id, 'assistant', text);
      try {
        await memory.extractMemories(
          userId,
          conversation.id,
          userMsg.id,
          utterance,
        );
      } catch (e) {
        req.log.error(e, 'memory extraction failed');
      }
      return { conversationId: conversation.id, text };
    },
  );

  app.post(
    '/v1/close',
    { preHandler: requireAuth },
    async (req) => {
      await sessions.closeConversation(req.userId!);
      return { text: 'Goodbye. I will be here when you come back.' };
    },
  );

  app.post(
    '/v1/memory/pin',
    { preHandler: requireAuth },
    async (req, reply) => {
      const { conversation } = await sessions.openConversation(req.userId!);
      const pinned = await memory.pinLastMessage(req.userId!, conversation.id);
      if (!pinned) return reply.code(400).send({ error: 'nothing to pin' });
      return { pinned };
    },
  );

  app.post(
    '/v1/memory/forget',
    { preHandler: requireAuth },
    async (req, reply) => {
      const parsed = forgetSchema.safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: 'invalid body' });
      const userId = req.userId!;
      let target = parsed.data.target;
      if (!target) {
        const { conversation } = await sessions.openConversation(userId);
        const last = await memory.lastUserMessageForConversation(
          conversation.id,
        );
        target = last ?? undefined;
      }
      if (!target) return reply.code(400).send({ error: 'nothing to forget' });
      const suppressed = await memory.forget(userId, target);
      return { suppressed };
    },
  );

  app.post(
    '/v1/memory/recall',
    { preHandler: requireAuth },
    async (req) => {
      const memories = await memory.recall(req.userId!);
      return { memories };
    },
  );
}
