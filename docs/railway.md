# Railway deployment

The companion API lives here; the Alexa skill's Lambda only proxies to it.

## One-time

1. `railway login`
2. `railway init` in the repo root (or integrate the GitHub repo, private OK)
3. `railway add` → PostgreSQL (this is the DB; pgvector not needed for M1)
4. Set env vars in Railway: Service → Variables
   - `DATABASE_URL` = the Postgres `DATABASE_URL` Railway gives you
   - `DEFAULT_PROVIDER=deepseek`
   - `DEEPSEEK_API_KEY=<your key>`
5. Migrate: `railway run npm run db:push` (works because DATABASE_URL is injected)
6. Deploy: `railway up` (or let GitHub hooks deploy) — the Dockerfile at repo root
   builds the API, listening on :3000
7. Add a custom domain (Settings → Networking → Generate domain) → `https://fume-production.up.railway.app`

## After

- Set the Lambda env var `FUME_API_URL=https://<railway-domain>`
- No more ngrok; the skill talks to Railway directly
