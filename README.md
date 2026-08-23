# Fume

A persistent AI companion that lives in your environment and can be spoken to
naturally. Voice-first, memory-first, model-agnostic.

No phone. No laptop. No app. No repeated invocation. Just a companion that
remembers you.

`"Fume."` → the device wakes → you keep talking.

## Why Fume

Alexa, Google Home, Siri are *search boxes with speakers*: command → response →
end. Fume is a **persistent intelligence**:

- **Memory first** — durable facts survive across sessions, and you own them.
  You can ask *"what do you remember about me?"*, *"forget everything about
  Japan"*, and it listens.
- **Alexa is only the first microphone** — the brain lives in a backend that is
  hardware-independent. When the companion gets its own hardware, the swap is
  an interface change, not a rewrite.
- **Model-agnostic** — a provider interface behind a router. Ships with DeepSeek
  and a mock provider; bring your own.
- **Conversation over commands** — the backend owns conversation state and
  short/long-term memory, so an ended Alexa session is not an ended
  conversation.

## Architecture

```
Alexa (mic + speaker only)
   ↓  access token, utterance
Alexa Skill (thin lambda)          — no keys, no logic
   ↓  POST /v1/*  Bearer <LWA token>
Companion API (Fastify)
   ├── Session Manager   — one active conversation per user, resumes
   ├── Memory Engine     — extraction, retrieval, tombstones
   ├── Model Router      — mock | deepseek (interface stays)
   └── Postgres          — conversations, messages, memories
```

```
Alexa session END  ≠  conversation END
```

## Quick start

```bash
npm install
docker compose up -d            # postgres 16 + pgvector on :5433
npm run db:push                 # create schema
npm run dev                     # http://localhost:3000
```

Test the whole loop with zero external services (mock provider + dev key):

```bash
curl -s http://localhost:3000/v1/health

curl -s -X POST http://localhost:3000/v1/respond \
  -H 'content-type: application/json' -H 'x-fume-dev-key: dev' \
  -d '{"utterance":"I like chai tea and I am building a companion"}'

curl -s -X POST http://localhost:3000/v1/memory/recall -H 'x-fume-dev-key: dev'
```

To use the real model: `DEFAULT_PROVIDER=deepseek` + `DEEPSEEK_API_KEY` in
`apps/api/.env` (see `apps/api/.env.example`).

## Repo layout

```
apps/
  api/       Fastify + Drizzle + Postgres companion backend
  skill/     Alexa skill (ASK SDK v2 lambda) — thin voice proxy
docs/        API, memory, deployment, architecture docs
```

## Documentation

Start at [docs/README.md](docs/README.md) — API reference, memory design,
Alexa skill internals, and deployment (Railway + AWS Lambda).

## Roadmap

- **M1 (built)** — Alexa skill, backend API, conversation DB, session manager,
  memory engine (auto-extraction + explicit commands), DeepSeek provider, LWA
  auth, keep-alive skill sessions
- **P2** — semantic memory search (pgvector pre-provisioned), compaction of
  long conversations, personality modes, MCP tools, proactive features, memory
  dashboard
- **P3** — dedicated hardware: wake word, far-field mic array, own voice
  pipeline; Alexa disappears, the rest of the system stays

## Security & privacy

- API keys live only in the backend. The skill never holds secrets.
- Memory is user-owned: `recall`, `forget`, `pin` are first-class, and
  forgetting is tombstone-guarded so deleted facts stay deleted.
- Env-dependent: when using a remote model provider, conversation context is
  sent there per request. Handle with your provider's retention policy in mind.

See [SECURITY.md](SECURITY.md).

## Contributing

Issues, PRs, ideas — see [CONTRIBUTING.md](CONTRIBUTING.md). Please don't
commit real LM/LWA/AWS secrets.

## License

[MIT](LICENSE)
