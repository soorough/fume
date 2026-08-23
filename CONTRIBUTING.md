# Contributing

Thanks for helping make Fume a better room companion.

## Ground rules

- **No secrets in commits.** Real LM keys, LWA client secrets, AWS keys must
  never land in the repo. `apps/skill/skill.json` ships with
  `__LWA_CLIENT_ID__` / `__LWA_CLIENT_SECRET__` placeholders — replace them
  locally only (add `git update-index --skip-worktree apps/skill/skill.json`
  so the file stays untouched while you work).
- **Mobile/product constraints** are load-bearing elsewhere; here the rule is:
  the backend owns identity, memory, conversation state and model routing;
  interfaces (Alexa today, hardware later) stay thin.
- Keep the docs in sync when you change behavior — the docs are the contract.

## Dev setup

```bash
npm install
docker compose up -d
npm run db:push
npm run dev
npm run typecheck
node apps/skill/scripts/smoke.mjs   # with the API running (mock provider fine)
```

## Submitting

1. Fork / branch; one logical change per PR
2. `npm run typecheck` green
3. If you touched memory or sessions, run the smoke test and quote the output
   in the PR description
4. Linear commit history; no merge commits — squash if needed

## Issues/ideas

Product thinking, memory schemas, model routing, hardware journey (wake word,
far-field mic array, own voice pipeline) — all welcome as issues, especially
with a sketch of how it should behave in a conversation.
