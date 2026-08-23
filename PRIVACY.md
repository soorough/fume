# Fume — Privacy Policy

_Last updated: 2026-08-24_

Fume is a voice companion. This policy describes what the Fume skill and its
backend collect, store, and how you can control it.

## What we collect

- **Your voice conversation** — the utterances (and the assistant's replies)
  required to hold a conversation are stored so the conversation can continue
  across sessions.
- **Long-term memories** — facts extracted from conversations, plus anything
  you explicitly ask Fume to remember (`"remember this"`).
- **Identity** — the account identifier Amazon provides for account linking
  (an opaque Amazon user ID). We do not collect name, email, location, or any
  other profile data.

## What we do NOT collect

- Any data from your Amazon account beyond the opaque identifier above.
- Location, contacts, calendars, files, purchases, or smart-home state.
- Payment data. Fume is free.

## What is shared

- When the skill uses a remote model provider (e.g. DeepSeek), the most recent
  conversation turns and relevant memories are sent to that provider to
  generate a reply. This sharing is required for Fume to respond at all.
- Nothing is ever sold or used for ad targeting.

## Your controls

- `"What do you remember about me?"` — inspect everything stored.
- `"Forget that."` / `"Forget everything about <topic>."` — delete related
  memories (deletion is durable: the same fact is not re-learned).
- Not saying anything sensitive is equally valid: only facts above an
  importance threshold are stored automatically.

## Retention & deletion

- Conversations and memories remain until you delete them via voice, or
  request deletion by contacting the maintainer (email in the git log of the
  open-source repository).
- Model providers may retain request logs per their own policies.

## Contact

Open an issue or email through the repository: github.com/soorough/fume
