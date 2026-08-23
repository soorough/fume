# Security

## Reporting

Security issues in code, auth, or data handling: open a private advisory via
GitHub, or email the maintainer from the git log. Do not open a public issue
with exploit details.

## Threat model / notes

- **Secrets**: model provider keys live only in the backend env
  (`apps/api/.env`) and are git-ignored; the skill has none.
- **Auth**: Alexa requests carry an LWA access token; the API validates it
  against LWA's profile endpoint (5 min cache). Local dev uses
  `x-fume-dev-key`. Production must not ship a `DEV_AUTH_KEY` (it is checked
  only when `NODE_ENV !== production`).
- **Memory**: user-owned. `forget` tombstones (suppression + status) so
  deletions are durable; `recall` exposes everything stored; extraction only
  stores facts above an importance threshold.
- **Data residency**: with `DEFAULT_PROVIDER=deepseek` (or any remote model),
  prompt context — conversation history + retrieved memories — is sent to that
  provider on each request. Operators must comply with their provider's
  retention policies; local/self-hosted model providers are supported by design.

## Good practices in this repo

- `x-fume-dev-key` never works in production (`NODE_ENV === 'production'`).
- Summaries, memory blocks, utterances: server-side logging only, no request
  bodies in logs by default (Fastify logger is metadata-only in the repo).
- The skill forwards the utterance and nothing else; it never stores or logs
  the token.
