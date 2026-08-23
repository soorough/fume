# Companion API

Base: `http://localhost:3000` (dev) — all routes under `/v1`.

## Auth

Two ways, in order:

1. **LWA bearer token** (production, from Alexa skill):
   `Authorization: Bearer <access token>`
   Resolved to a user via the LWA profile endpoint and cached for 5 min.
   Invalid/missing → `401`.
2. **Dev key** (local only):
   `x-fume-dev-key: <DEV_AUTH_KEY>` (default `dev`)
   Maps to a single local `dev-user`. In non-production only, a Bearer token
   equal to `DEV_AUTH_KEY` is also accepted (used by the skill smoke test).

## Endpoints

### `GET /v1/health`
`{"ok": true}` — no auth.

### `POST /v1/open`
Open (or resume) the user's conversation. Creates one if none is open.
Returns the welcome/continue message the skill should speak.

```bash
curl -s -X POST localhost:3000/v1/open -H 'x-fume-dev-key: dev'
# {"conversationId":"...","resumed":false,"text":"Hey, I'm Fume. I'm listening — say whatever is on your mind."}
```

### `POST /v1/respond`
Body: `{"utterance": "<user speech>"}` (1..2000 chars).

Flow: ensure conversation → append user message → retrieve relevant memories
(importance + token-overlap ranking) → assemble prompt (persona + memories +
recent history) → model provider → append assistant message → run memory
extraction on the utterance. Returns `{conversationId, text}`.

### `POST /v1/close`
Ends the open conversation; if `SUMMARY_ON_END` is set and the conversation
has ≥4 exchanges it writes a one-line summary for "welcome back" greetings.

### `POST /v1/memory/pin`
Store the user's **last message** as a memory at importance `1.0`
("Remember this."). 400 if there is nothing to pin.

### `POST /v1/memory/forget`
Body: `{"target": "<text>"}` (optional — defaults to the last user message).
Inserts a suppression pattern and tombstones (`status = suppressed`) all
matching active memories. Returns `{suppressed: n}`.

### `POST /v1/memory/recall`
Returns the user's active memories, importance-descending, capped at 50.

## OAuth (self-hosted account linking)

The backend doubles as the OAuth provider so the Alexa skill can link accounts
without LWA (whose standalone profiles reject skill scopes — see
[field-notes.md](field-notes.md)).

- `GET /auth/authorize` — `response_type=code` required; client_id/redirect are
  lenient (echoes any redirect, defaults to the Alexa pitangui callback).
- `POST /auth/token` — Basic auth (`OAUTH_CLIENT_ID`/`OAUTH_CLIENT_SECRET`) or
  body credentials; `grant_type=authorization_code` → signed JWT
  (HS256, `exp` 1h).
- The Bearer JWT is accepted by `/v1/*` auth alongside LWA tokens and the dev
  key.

## Errors

`400` invalid body / nothing to operate on · `401` auth failed · `500` provider
or DB error (logged server-side).

## Env vars (all optional in dev)

| Var | Default | Notes |
|---|---|---|
| `DATABASE_URL` | `postgres://fume:fume@localhost:5433/fume` | local compose |
| `PORT` | `3000` | |
| `DEFAULT_PROVIDER` | `mock` | `mock` for offline dev, `deepseek` otherwise |
| `DEEPSEEK_API_KEY` | – | required for `deepseek` |
| `DEEPSEEK_MODEL` | `deepseek-chat` | |
| `DEV_AUTH_KEY` | `dev` | dev auth header value |
| `MEMORY_EXTRACTION_ENABLED` | `true` | LLM extraction on each user turn |
| `MEMORY_IMPORTANCE_THRESHOLD` | `0.6` | facts below this are dropped |
| `MEMORY_RETRIEVE_LIMIT` | `8` | memories injected into the prompt |
| `CONTEXT_WINDOW_LAST_N` | `20` | last N messages replayed to the model |
| `SUMMARY_ON_END` | `false` | summarize conversation on close |
| `LWA_PROFILE_URL` | `https://api.amazon.com/user/profile` | use for LWA tokens, dev key otherwise |
