# Architecture — M1

```
Alexa (microphone + speaker only)
   ↓  access token, utterance
Alexa Skill (lambda)                    — thin proxy, no keys, no logic
   ↓  POST /v1/* with Bearer <LWA token>
Companion API (Fastify)                 — auth → session → memory → model
   ↓
Model Router        mock | deepseek (interface stays, more providers later)
Postgres            conversations, messages, memories, memory_suppressions

Alexa session END  ≠  conversation END. Backend owns conversation state.
```

## Decisions

- **LWA account linking, no self-hosted OAuth.** The skill never holds keys.
  The API resolves the LWA access token to a user via the LWA profile endpoint
  (cached 5 min) and upserts `users`. For local dev, `x-fume-dev-key` maps to a
  dev user.
- **One model provider interface** (`providers/model.ts`) with `mock` (default,
  offline) and `deepseek` behind env `DEFAULT_PROVIDER`. Deploy with mock,
  switch by flipping env.
- **One active conversation per user**, restored on every `open`.
- **Memory = one table, layers are views.** `type` enum covers semantic /
  episodic / profile / preference. Retrieval is token-overlap + importance
  ranking (good enough for M1 commands; pgvector was pre-provisioned in the
  compose image for phase 2).
- **Forget = suppression, not just delete.** `memory_suppressions` blocks
  re-extraction and `memories` rows get `status: suppressed` (tombstones).
  This is the fix for the classic resurrection bug: user says "forget Japan",
  says "Japan" next week, memory comes back.
- **`/v1/open` does the welcome-back.** Optional `SUMMARY_ON_END` runs a cheap
  summarizer when a conversation closes, feeding "Welcome back. We were talking
  about X. Want to continue?" — the feature that makes Alexa's session limits
  survivable.

## Known M1 limits

- History is replayed raw up to `CONTEXT_WINDOW_LAST_N`; compaction/rollups are
  P2. At ~10+ long conversations this matters.
- No streaming to Alexa yet (classic skill request/response). Newer Voice AI
  streaming APIs are a P2 evaluation item.
- DeepSeek provider has no retry/backoff.
