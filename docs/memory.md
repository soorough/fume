# Memory engine

Memory is **not** a giant transcript. The transcript (`conversations`,
`messages`) is layer 1 — the durable facts live in `memories`, which is one
table, five conceptual layers, each just a `type`:

| type | example |
|---|---|
| `semantic` | "User is building an AI companion" |
| `episodic` | "In August the user decided to prototype with Alexa" |
| `profile` | "User's favorite drink is chai" |
| `preference` | "User prefers voice-first interaction" |

A future entity/relationship graph stays a separate table; the memory layers
remain views over the same facts.

## Extraction (automatic)

On every user turn (if `MEMORY_EXTRACTION_ENABLED`), the model receives a
small extraction prompt and returns facts as JSON:

```json
[{"content": "User likes chai tea", "type": "preference", "importance": 0.8}]
```

Facts with `importance >= MEMORY_IMPORTANCE_THRESHOLD` (default 0.6) are
stored. Small talk ("I had coffee", importance ~0.01) never lands. Bad JSON
from the model is discarded gracefully.

## Retrieval

For the next prompt, the oldest-tier ranking:

```
score = token overlap with the user's utterance + importance
```

Top `MEMORY_RETRIEVE_LIMIT` (8) are injected into the model context as a
memory block. This keeps prompts small instead of shipping the user's life
history into every request.

## Explicit control (user-owned memory)

- **pin** — "remember this": stores the last user message at `importance=1`.
- **recall** — "what do you remember about me": lists active memories.
- **forget** — "forget that" / "forget everything about Japan":
  1. writes a suppression pattern (`memory_suppressions`)
  2. tombstones every active memory whose content contains it
     (`status = suppressed`)

The tombstone is the important part: the suppression pattern stays in the table,
so if the user later mentions Japan again, **re-extraction of the same fact is
blocked**. Delete-without-tombstone would resurrect deleted facts a week later.

## Known gaps / next

- Retrieval is keyword scoring. `pgvector` is pre-provisioned in the compose
  image; phase 2 adds embedding-based semantic retrieval.
- Duplicate detection is exact-normalized-match only; near-duplicates (e.g.
  "User likes chai tea" vs "User is drinking chai") can coexist.
- Long conversations replay raw history up to `CONTEXT_WINDOW_LAST_N`;
  compaction/rollups are phase 2.
