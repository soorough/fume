# Alexa skill

The skill is a **thin voice proxy**. Every rule of the voice pipeline lives on
the backend, because the product's core rule is:

> Never make Alexa the product. Make the Companion the product.

## Conversation keep-alive

| Component | Code | Effect |
|---|---|---|
| `shouldEndSession: false` | every chat response | skill stays open |
| `reprompt(...)` | every chat response | "Go on. I am listening." |
| `AMAZON.StopIntent` / `CancelIntent` | calls `POST /v1/close` then ends | "Goodbye." |
| `SessionEndedRequest` | calls `POST /v1/close` (best effort) | wraps it up |

Result: the skill stays open for the whole conversation and only closes on
Goodbye or after long idle (Amazon re-asks once after silence; exact idle
timeout is Amazon's, not ours). Because the **backend** owns the conversation,
even a force-closed session is survivable: the next "open" says

> "Welcome back. We were talking about X. Want to continue?"

(conversation summary is written at close when `SUMMARY_ON_END=true`).

## Intents

| Intent | Backend call |
|---|---|
| `LaunchRequest` | `POST /v1/open` |
| `AMAZON.FallbackIntent` (raw text in slot `text`) | `POST /v1/respond` |
| `RememberIntent` (invocation/chat: "remember this") | `POST /v1/memory/pin` |
| `ForgetIntent` (`what` slot optional) | `POST /v1/memory/forget` |
| `RecallIntent` | `POST /v1/memory/recall` |
| `AMAZON.StopIntent`/`CancelIntent` | `POST /v1/close` + goodbye |

## Account linking (LWA)

- Skill → Amazon account link → LWA (`AUTH_CODE` grant)
- The access token Amazon attaches to every request is forwarded to the API
- API resolves it via LWA's profile endpoint and upserts `users`
- **No API keys in the skill.** If the token is missing the skill returns a
  LinkAccount card.

## Local smoke test (no AWS, no Echo)

Proves the whole chain — launch → chat → memory → goodbye — against a local
API:

```bash
docker compose up -d && npm run db:push
npm run dev                                            # terminal A
node apps/skill/scripts/smoke.mjs                      # terminal B
```

The smoke script sends real ASK request envelopes to the skill handler
(in-process) with `accessToken: "dev"` (accepted in non-production) and prints
every spoken reply. Requires only ask-sdk-core inside `apps/skill/lambda`
(`npm install --prefix apps/skill/lambda`).

## Deploy

See [deployment.md](deployment.md) — Lambda is required (Amazon deprecated
HTTPS endpoints for new skills), packaging script included
(`apps/skill/scripts/package.sh`), and the Lambda just needs one env var:
`FUME_API_URL`.

## Testing on the dev console / a real Echo

Once deployed:

```
Alexa, open fume bot.
I like chai tea and I am building a companion named Fume.
What do you remember about me?
Remember this.
Forget that.
Goodbye.
```

## Notes / limits

- Classic skill request/response: no streaming. Long replies can be cut — the
  persona prompt keeps replies under 4 sentences for exactly this reason.
- The new Alexa LLM/streaming APIs are a future evaluation (would enable longer
  and more natural open sessions).
