# Deployment — LWA + Alexa skill

## 0. What you need

- Amazon Dev account (already have) → https://developer.amazon.com
- AWS account + `aws configure` (for the skill lambda) — or zip-upload manually in the Lua console
- A public URL for the API. Easiest for dev: `ngrok http 3000` (write the https URL down)
- ASK CLI: `npm install -g ask-cli` then run `ask configure` (browser login)

## 1. LWA security profile (Login with Amazon)

1. https://developer.amazon.com → Login with Amazon → Create Security Profile
2. Names: e.g. `FumeSkill`, app id `FumeSkill`
3. Copy **Client ID** and **Client Secret**
4. Paste both into `apps/skill/skill.json` (`clientId`, `clientSecret`)
5. If ASK CLI or the skill console complains about redirects: add the URL it prints
   (e.g. `https://alexa.amazon.com`) to your LWA profile's "Allowed Return URLs"

## 2. API

```bash
cd apps/api
cp .env.example .env          # or keep existing
# DATABASE_URL must point to a reachable postgres (local is fine behind ngrok)
npm run dev                   # port 3000
ngrok http 3000               # FUME_API_URL=https://xxxx.ngrok.app
```

## 3. Lambda

```bash
bash apps/skill/scripts/package.sh              # zips apps/skill/lambda -> dist/skill-lambda.zip
# upload via Ask CLI auto (aws credentials configured + ask configure) or:
```

Set lambda env var **FUME_API_URL** = your ngrok URL.

## 4. Deploy the skill

```bash
cd apps/skill
npx ask-cli deploy             # validates skill.json, interaction model + uploads lambda
npx ask-cli smapi list-skills  # sanity check
```

## 5. Test

- Alexa developer console → test tab → simulate "open fume"
- Enable skill to link the account, then:

```
Alexa, open Fume.
I'm building an AI companion.
Remember this.
What do you remember about me?
Goodbye.
```

Note: skipOnEnablement is false — customers link the account before enablement, so
`accessToken` should always be present. If it is missing the skill returns the
LinkAccount card.
