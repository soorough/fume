# Railway deployment

The companion API lives here; the Alexa skill's Lambda only proxies to it.

## Live deployment

| | |
|---|---|
| Project | `robust-enchantment` |
| Services | `@fume/api` (from `soorough/fume`, root Dockerfile) + `Postgres` |
| Public URL | `https://fumeapi-production.up.railway.app` |
| Health | `GET /v1/health` → `{"ok":true}` |
| Region | Southeast Asia |
| Deploys | automatically on push to `main` |

## Service variables

Set on `@fume/api`:

- `NODE_ENV=production` — closes both dev-auth bypasses in `src/auth.ts`
- `DATABASE_URL=${{Postgres.DATABASE_URL}}` — Railway reference, not a literal
- `PORT=8080` — **must** match the domain's target port; Railway does not
  inject `PORT`, and the app defaults to 3000, so a mismatch is a 502
- `DEFAULT_PROVIDER=mock` — switch to `deepseek` once `DEEPSEEK_API_KEY` is set
- `OAUTH_CLIENT_ID=fume-skill`

Still to set by hand (secrets, never commit them):

- `DEEPSEEK_API_KEY`
- `OAUTH_CLIENT_SECRET` — **must byte-match** the client secret in the SMAPI
  account-linking config, or `/auth/token` returns `invalid_client`

## Container gotchas

- `tsx` must stay in `dependencies`, not `devDependencies` — the Dockerfile
  runs `npm install --omit=dev` and starts with `tsx src/index.ts`.
- `.dockerignore` is required: `COPY . .` otherwise bakes local `node_modules`
  and `apps/api/.env` into the image (Docker ignores `.gitignore`).

## Remaining setup

1. Migrate the schema — the Railway Postgres is still empty:
   `railway login && railway link && railway run npm run db:push`
2. Point the skill at Railway: Lambda env `FUME_API_URL=https://fumeapi-production.up.railway.app`
3. Update SMAPI account linking:
   - `authorizationUrl` → `https://fumeapi-production.up.railway.app/auth/authorize`
   - `accessTokenUrl`  → `https://fumeapi-production.up.railway.app/auth/token`
4. `ask deploy --ignore-hash`

No more ngrok; the skill talks to Railway directly, and the URL is stable.
