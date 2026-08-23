# Fume

A persistent AI companion that lives in your environment and can be spoken to
naturally. Voice-first, memory-first, model-agnostic, hardware-independent.

> Never make Alexa the product. Make the Companion the product. (SPEC §32)

Product spec: [docs/spec.md](docs/spec.md) — architecture: [docs/architecture.md](docs/architecture.md)

## Layout

```
apps/
  api/    Fastify + Drizzle + Postgres backend (companion brain)
  skill/  Alexa skill (ASDK v2 lambda) + interaction model + account linking
docs/
  spec.md           the full product spec
  architecture.md   M1 decisions
```

## Quick start (backend, no Amazon account needed)

```bash
npm install
docker compose up -d                      # postgres 16 + pgvector on :5433
npm run db:push                           # create schema
npm run dev                               # http://localhost:3000
```

Test the full loop with the mock provider + dev auth key:

```bash
curl -s http://localhost:3000/v1/health

curl -s -X POST http://localhost:3000/v1/respond \
  -H 'content-type: application/json' \
  -H 'x-fume-dev-key: dev' \
  -d '{"utterance":"I am building an AI companion with Alexa"}'

curl -s -X POST http://localhost:3000/v1/memory/pin -H 'x-fume-dev-key: dev'
curl -s -X POST http://localhost:3000/v1/memory/recall -H 'x-fume-dev-key: dev'
```

## Config

Copy [apps/api/.env.example](apps/api/.env.example) to `apps/api/.env` to override.
Defaults: mock model provider (set `DEFAULT_PROVIDER=deepseek` + key for the real one),
`x-fume-dev-key: dev` for local auth, LWA profile endpoint for real Alexa tokens.

## Alexa skill

1. Create a Login with Amazon (LWA) security profile at developer.amazon.com →
2. Fill `__LWA_CLIENT_ID__` / `__LWA_CLIENT_SECRET__` in
   [apps/skill/skill.json](apps/skill/skill.json)
3. Deploy the lambda: `npm install --prefix apps/skill/lambda`, zip contents,
   or `ask deploy` from `apps/skill`
4. Set the `FUME_API_URL` env var in the lambda to the public backend URL
   (e.g. ngrok tunnel or a deployed API)

The skill uses LWA as the OAuth IdP (account linking): the access token Amazon
passes in each request is forwarded to the API, which resolves it to a user via
`https://api.amazon.com/user/profile`. No keys in the skill.

## Works towards

M1 ✓ : skill + backend + conversation DB + session manager + memory engine +
DeepSeek-compatible provider + basic auth (see docs/architecture.md)
