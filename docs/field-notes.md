# Field notes — everything that bit us (so you don't fight it)

Painful-but-usable knowledge from getting Fume to an Echo end-to-end.

## ASK CLI

- v2 requires `ask-resources.json`; v1 `skill.json`-at-root projects are dead.
  `ask util upgrade-project` only converts genuine v1 projects.
- `code` keys in ask-resources are **Alexa** regions (`NA`, `EU`, `FE`), not AWS
  regions — "Unsupported Alexa region: us-east-1" means you used the AWS name.
- `ask deploy` is hash-driven; stale packages get skipped silently. Always
  `ask deploy --ignore-hash` when you suspect the upload isn't taking.
- ask-cli rewrites `skill-package/skill.json` (endpoints sync from the
  `regions.NA.endpoint.uri` shape). Diff it after deploys before committing.

## Manifest / schema

- `accountLinking` is **not** part of the manifest anymore — it's a separate
  SMAPI resource (`update-account-linking-info`). Keeping credentials in the
  manifest fails validation AND pollutes the public repo.
- `privacyAndCompliance` accepts only: allowsPurchases, usesPersonalInfo,
  isChildDirected, isExportCompliant, containsAds. Extra keys fail validation.
- "Trigger setting for the Lambda ... is invalid" = the Lambda didn't exist at
  manifest-validation time, or permission missing. Fix order: skill first
  (endpoint-less), then permission with `EventSourceToken: <skillId>`, then
  endpoint.

## Lambda

- Handler for ESM: our lambda uses `index.js` + `"type":"module"` with
  `index.handler` — works on nodejs20.x.
- Lambda reads `FUME_API_URL` lazily at request time (env set at cold start is
  fine; importing env at module load breaks local smoke tests).
- Every skill request without an `accessToken` (unlinked users) must return the
  LinkAccount card — cheap and correct UX.

## Account linking

- LWA standalone profiles won't grant skill scopes ("An unknown scope was
  requested" for `profile` AND `profile:user_id`). Don't burn an hour there —
  self-host the OAuth (backend already ports the JWT path; see
  `apps/api/src/oauth.ts`).
- Console default "skip account linking" + Implicit grant will silently break
  AUTH_CODE flows. Re-apply the correct config via SMAPI, refresh the page.
- The console simulator runs links against your **public** URL — localhost
  never works; ngrok/Railway required.
- Fastify needs `@fastify/formbody` for `application/x-www-form-urlencoded`
  (core only parses JSON) — token endpoint 415s otherwise.

## Invocation & store

- 1-word invocation = brand proof required. "fume ai" passes.
- Example-phrase validation: full sentence, period: `Alexa, open fume ai.`
- "1 Fix Required: Confirmation for 'Export compliance' is missing" — the
  checkbox lives in Distribution → Privacy & Compliance, not the manifest.
- Dev-stage skills are invisible to devices until beta; beta submission requires
  the publish-later flow + at least the account's own email as tester.

## Ops mini-checklist

- ngrok URL changed? → update `ask-resources.json` env + SMAPI account-linking
  URIs (`ask deploy --ignore-hash` after).
- Lambda cold start ~2s is normal; keep replies short (persona enforces it).
- Memory tests via `x-fume-dev-key: dev` don't touch real users; link a real
  account before judging memory behavior.
