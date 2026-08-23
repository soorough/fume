# Deployment — LWA + Alexa skill

## 0. What you need

- Amazon Dev account → https://developer.amazon.com
- AWS account (Lambda is free-tier friendly at this scale) + `aws configure`
- Public URL for the API — Railway (see [railway.md](railway.md)) or `ngrok http 3000` for dev
- ASK CLI: `npm install -g ask-cli` then `ask configure` (browser login; this
  step must fully complete — check for a success message)

## 1. LWA security profile (Login with Amazon)

1. https://developer.amazon.com/login-with-amazon/console → Create Security Profile
2. Copy **Client ID** and **Client Secret**
3. Replace `__LWA_CLIENT_ID__` / `__LWA_CLIENT_SECRET__` in `apps/skill/skill.json` locally
4. **Never commit** the filled skill.json: `git update-index --skip-worktree apps/skill/skill.json`
5. If ASK CLI/console asks for a redirect URL, add it to the LWA profile's
   "Allowed Return URLs"

## 2. API

```bash
cd apps/api && cp .env.example .env   # then fill provider/key
npm run dev                            # port 3000
ngrok http 3000                        # dev-only URL; Railway for production
```

## 3. Lambda

```bash
bash apps/skill/scripts/package.sh     # zip -> dist/skill-lambda.zip
# Upload in AWS console (or ask-cli auto-deploys when AWS creds are configured)
```

Set the Lambda env var **FUME_API_URL** to the API's public URL.

## 4. Deploy the skill

```bash
cd apps/skill
npx ask-cli deploy                     # validates manifest, model, uploads lambda
```

## 5. Test

- Developer console test tab, or a real Echo:

```
Alexa, open Fume.
I'm building an AI companion.
Remember this.
What do you remember about me?
Goodbye.
```

Account linking is `skipOnEnablement: false`, customers link before enabling;
if a token is ever missing the skill returns a LinkAccount card.
