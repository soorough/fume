# Deployment runbook (verified end-to-end)

The real-world path that works: skill → Lambda (free tier) → backend (Railway or
ngrok) → model provider. This document reflects what actually deployed, in order.

## 0. Accounts & tools

- Amazon developer account: https://developer.amazon.com
- AWS account + `aws configure` (only free-tier Lambda is used; you will not be billed)
- ASK CLI: `npm install -g ask-cli` then `ask configure` **to completion**
  (browser sign-in; verify `~/.ask/cli_config` has a `profiles.default` entry)
- ngrok (dev) or Railway (production) for the public API URL

## 1. Project shape (ask-cli v2)

```
apps/skill/
  skill-package/
    skill.json                # manifest; NO accountLinking inside
    interactionModels/
      custom/en-US.json       # interaction model
  lambda/                     # ask-sdk-core, ESM (index.js, "type":"module")
  ask-resources.json          # v2 project metadata (see below)
```

`ask-resources.json` — note **Alexa region keys** (`NA`), not AWS regions:

```json
{
  "askcliResourcesVersion": "2020-03-31",
  "profiles": {
    "default": {
      "skillMetadata": { "src": "skill-package" },
      "code": { "NA": { "src": "lambda" } },
      "skillInfrastructure": {
        "type": "@ask-cli/lambda-deployer",
        "userConfig": {
          "runtime": "nodejs20.x",
          "handler": "index.handler",
          "environmentVariables": { "FUME_API_URL": "https://..." }
        }
      }
    }
  }
}
```

`environmentVariables` here sets the Lambda env var — no post-steps needed.

## 2. Deployment order matters

1. `ask deploy` — first run: skill metadata + Lambda + permission. **A skill with
   `apis.custom.endpoint` fails validation ("invalid trigger") if the Lambda does
   not exist** when the manifest is validated. Order the steps:
   - deploy WITHOUT endpoint first (creates skill + Lambda) — or create the
     function yourself with `aws lambda create-function` and add the Alexa
     permission afterwards
2. ask-cli then syncs the endpoint into
   `skill-package/skill.json` (it uses `apis.custom.regions.NA.endpoint.uri` —
   keep the flat `apis.custom.endpoint.uri` too; both are schema-valid)
3. `ask deploy --ignore-hash` to force re-upload/prompt-free rebuild

**Lambda permission** (exact requirements matter — principal + skillId token):

```
aws lambda add-permission --function-name <fn> --statement-id alexa-appkit \
  --action lambda:InvokeFunction --principal alexa-appkit.amazon.com \
  --source-arn arn:aws:lambda:...:function:<fn> \
  --source-account <acct> --event-source-token <skillId>
```

ask-cli's own deployer calls AddPermission with `EventSourceToken: <skillId>` —
the token is only creatable after the skill exists (console flow, hence the
chicken-and-egg error "trigger setting ... is invalid").

## 3. Account linking — LWA will bite you

Standalone LWA security profiles reject `scope=profile` / `profile:user_id` for
skill linking ("An unknown scope was requested"). Instead: **the backend is an
OAuth provider itself** (AUTH_CODE grant, self-hosted JWT — see
`apps/api/src/oauth.ts`, endpoints `/auth/authorize` + `/auth/token`).

Set it via SMAPI (keeps client secrets out of the repo):

```bash
P=$(cat <<'EOF'
{
  "accountLinkingRequest": {
    "type": "AUTH_CODE",
    "authorizationUrl": "https://<public-url>/auth/authorize",
    "accessTokenUrl": "https://<public-url>/auth/token",
    "accessTokenScheme": "HTTP_BASIC",
    "clientId": "fume-skill",
    "clientSecret": "<OAUTH_CLIENT_SECRET from .env>",
    "scopes": ["profile"],
    "domains": ["<public-host>"],
    "defaultTokenExpirationInSeconds": 3600,
    "skipOnEnablement": false
  }
}
EOF
)
ask smapi update-account-linking-info --skill-id <skillId> \
  --stage development --account-linking-request "$(echo "$P" | tr -d '\n')"
```

Console "Alexa Redirect URLs" are fixed Amazon hosts (pitangui/layla/co.jp) —
the backend echoes back whichever `redirect_uri` it receives, so any of them
works. The authorize endpoint intentionally accepts any `client_id`.

## 4. Public URL lifecycle

- ngrok free: URL changes every restart → **must** refresh BOTH
  `ask-resources.json` (environmentVariables) via deploy, AND the SMAPI
  account-linking URIs. Keep ngrok + API running during tests.
- Railway: stable domain. Set the env var once. Recommended for anything beyond
  a single demo — see docs/railway.md.

## 5. Store / beta prerequisites

- Invocation name: 2+ words or brand proof — use "fume bot".
- Example phrases use full sentence + period: `Alexa, open fume bot.`
- Privacy & Compliance: purchases=No, shopping=No, personal info=Yes,
  targeting children=No, ads=No; **check Export Compliance cert box**;
  testing instructions mention the no-credential OAuth click-through.
- Store assets: icons 108/512 PNG (scripts available under assets/skill-icons),
  privacy policy + terms URLs (public pages — put them in the repo: PRIVACY.md,
  TERMS.md).
- **Real device testing = beta only**; console Test tab needs none of this.
  Beta path: Distribution → Availability (selected countries) → private beta →
  your own email → "Certify now and publish later" → submit → app invite.
- Dev-stage skills cannot be enabled on Echo devices until beta/cert.
