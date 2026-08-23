# AI Room Companion — Product & Technical Specification v1

## 1. Product Vision

Build a persistent AI companion that lives in the user's physical environment and can be spoken to naturally, without requiring a phone or laptop.

The initial prototype will use an Amazon Alexa/Echo device as the voice interface. Alexa is only the entry point. The actual companion will live in a cloud backend containing:

- Conversation history
- Long-term memory
- User profile
- Context
- Personality
- Model orchestration
- Tools/MCP integrations
- Session management
- Privacy controls

The long-term goal is to replace the Alexa hardware/interface with a dedicated always-available AI companion device.

## 2. Core Experience

The desired experience is:

> "Alexa, talk to Fume."

Then the user should be able to have a natural conversation with the AI.

Instead of treating every request as an isolated command, the system should understand that the user is having an ongoing conversation.

Example:

**User:** Alexa, talk to Fume.

**Fume:** Hey, what's up?

**User:** I'm thinking about switching jobs.

**Fume:** What changed?

**User:** I got an offer from that startup we talked about.

**Fume:** Ah, the one you mentioned last week?

This requires persistent conversation state and long-term memory outside Alexa.

## 3. Important Alexa Constraint

Alexa Skills have an important limitation: they are not designed to function as unrestricted, continuously open voice conversations.

A normal Alexa interaction can eventually end or require another invocation.

Therefore:

**We should NOT attempt to make Alexa the conversation engine.**

Instead:

```text
Alexa
   ↓
Alexa Skill
   ↓
Companion API
   ↓
Session Manager
   ↓
Memory Engine
   ↓
LLM / Model Router
   ↓
Response
   ↓
Alexa
```

Alexa becomes an interface layer.

This makes the backend reusable when custom hardware is introduced.

## 4. MVP Interaction Model

The first version should use Alexa's normal skill invocation mechanism.

Example:

> "Alexa, open Fume."

The skill establishes a conversation session.

The user then speaks naturally.

The backend maintains the conversation context.

When Alexa's session eventually ends, the conversation itself is NOT lost.

A future interaction can retrieve the previous conversation context from the backend.

## 5. Conversation Continuity

The system should distinguish between:

### Short-term conversation memory

Information from the current conversation.

Example:

User:

> I'm planning a trip to Japan.

Later:

> What should I pack?

The companion understands that "the trip" refers to Japan.

### Long-term memory

Important information that should survive indefinitely.

Example:

> I'm planning to visit Japan in November.

The system may store:

```text
User
 └── Travel
      └── Japan
           └── Planned trip
                └── November 2026
```

The user should be able to explicitly control this.

Commands:

> "Remember this."

> "Forget what I just told you."

> "What do you remember about me?"

> "Forget everything about Japan."

## 6. Memory Architecture

Memory should not simply be a giant conversation transcript.

Use multiple layers.

### Layer 1 — Raw conversation history

Store conversations exactly as they happened.

```text
Conversation
 ├── timestamp
 ├── user message
 ├── assistant response
 ├── session ID
 └── metadata
```

### Layer 2 — Semantic memories

Extract durable information from conversations.

Examples:

```text
User likes minimalist interfaces.
User is building an AI companion.
User prefers voice-first interaction.
User is experimenting with local LLMs.
```

### Layer 3 — Episodic memories

Important events.

```text
August 23:
User decided to prototype the AI companion using Alexa.
```

### Layer 4 — User profile

Stable preferences and information.

```text
Communication style
Technical interests
Preferred assistant personality
Important projects
Recurring routines
```

### Layer 5 — Relationship/context graph

Eventually represent relationships between entities.

```text
User
 ├── Projects
 │    ├── AI Companion
 │    └── Nexus
 │
 ├── People
 ├── Places
 ├── Preferences
 └── Goals
```

## 7. Memory Retrieval

When a user asks something, the backend should retrieve only relevant memories.

Example:

User:

> "What was that LLM I was considering for the companion?"

The system searches semantic memory and conversation history.

It might retrieve:

```text
DeepSeek
Qwen
OpenAI
local LLM
Alexa companion project
```

The LLM then receives the relevant context.

This avoids sending the entire user's life history into every request.

## 8. Model Architecture

The system must be model-agnostic.

Do not tightly couple the product to OpenAI.

The backend should expose an internal interface such as:

```text
generate(
    messages,
    memory,
    tools,
    model_preferences
)
```

Possible models:

- OpenAI
- DeepSeek
- Qwen
- Claude
- Gemini
- Local models
- Future models

## 9. DeepSeek Integration

DeepSeek can be used as the initial model provider if it provides the desired quality/cost/latency.

The system should support:

```text
Companion
    ↓
Model Router
    ├── DeepSeek
    ├── OpenAI
    ├── Claude
    ├── Gemini
    └── Local LLM
```

The user should never need to know which model handled a normal conversation.

Later, model routing could become intelligent.

Example:

```text
Casual conversation → fast inexpensive model
Complex reasoning → reasoning model
Coding → coding-specialized model
Writing → strongest writing model
Local/private task → local model
```

## 10. MCP / Tool Architecture

The companion should eventually support tools through MCP or a similar tool protocol.

Examples:

- Calendar
- Email
- Tasks
- Smart home
- Weather
- Web search
- Personal files
- Notes
- Music
- Home Assistant
- Computer control
- Custom APIs

Architecture:

```text
                ┌── Calendar
                ├── Email
Companion ─ MCP ├── Smart Home
                ├── Files
                ├── Web
                └── Custom Tools
```

The LLM decides when a tool is required.

## 11. Smart Home Integration

This could eventually become one of the most interesting capabilities.

Example:

> "It's getting cold in here."

The companion could understand the context and ask:

> "Want me to turn the AC down?"

Or:

> "I'm going to bed."

It could execute a bedtime routine:

```text
Lights → Off
AC → 24°C
Door → Locked
Music → Off
```

The companion becomes both an AI and an ambient home interface.

## 12. Proactive Companion

Eventually the system should be able to proactively interact with the user, subject to explicit permissions.

Examples:

> "You have a meeting in 15 minutes."

> "You mentioned you wanted to call Mom today."

> "You haven't worked on the project you said you wanted to finish this week."

This must be permission-controlled.

There should be separate settings for:

```text
Passive
Reactive
Proactive
Highly proactive
```

## 13. Context Awareness

The companion should understand context without requiring explicit commands.

Possible signals:

- Time
- Calendar
- Conversation history
- Location, if permitted
- Smart-home state
- Current activity
- Device currently being used
- Recent conversations

Example:

Morning:

> "Good morning. You've got a fairly busy day today."

Late evening:

> "You've got an early meeting tomorrow. Want me to keep things short tonight?"

## 14. Multiple Personality Modes

The same underlying companion could have different modes.

Examples:

### Normal

Friendly, conversational companion.

### Work

Concise and productive.

### Study

Explains concepts and asks questions.

### Coding

Technical and precise.

### Travel

Planning-oriented.

### Emotional / reflective

More conversational and thoughtful.

The user can say:

> "Switch to work mode."

## 15. Memory Transparency

This is a core product feature.

The user must always be able to inspect memory.

Commands:

> "What do you remember about me?"

> "Why did you remember that?"

> "Forget that."

> "Show me everything you remember about me."

> "Don't remember anything from this conversation."

The system should provide a memory-management interface in the future, but voice commands should work from day one.

## 16. Privacy Architecture

The backend should separate:

```text
Identity
Conversation
Memory
Model provider
Tools
```

API keys must never be stored in the Alexa client.

Alexa communicates with the backend using authenticated requests.

The backend handles:

- Authentication
- Authorization
- Encryption
- Model API keys
- Memory access
- Tool permissions

## 17. User Identity

The system needs to determine which user is speaking.

MVP:

Alexa account/device identity.

Future:

Voice identification.

Potential flow:

```text
Voice
 ↓
Wake word
 ↓
Speaker identification
 ↓
User profile
 ↓
Conversation
```

This becomes particularly important if multiple people use the same device.

## 18. Conversation Database

A basic schema:

```text
users
 ├── id
 ├── profile
 ├── preferences
 └── settings

conversations
 ├── id
 ├── user_id
 ├── started_at
 └── ended_at

messages
 ├── conversation_id
 ├── role
 ├── content
 └── timestamp

memories
 ├── user_id
 ├── memory
 ├── type
 ├── importance
 ├── created_at
 └── updated_at

entities
 ├── user_id
 ├── type
 ├── name
 └── metadata
```

## 19. Memory Importance

Not every sentence should become memory.

Use a scoring system.

Example:

```text
"I had coffee."
Importance: 0.01

"I hate coffee."
Importance: 0.65

"My favorite drink is chai."
Importance: 0.85

"I'm moving to Bangalore next year."
Importance: 0.95
```

Only information above a configurable threshold becomes long-term memory.

The user can always override this.

## 20. Voice Pipeline

Eventually the system should be:

```text
Microphone
    ↓
Wake-word detection
    ↓
Voice Activity Detection
    ↓
Speech-to-Text
    ↓
Conversation Engine
    ↓
Memory Retrieval
    ↓
LLM
    ↓
Text-to-Speech
    ↓
Speaker
```

For Alexa MVP, Alexa handles much of the speech pipeline.

For custom hardware, we own the entire pipeline.

## 21. Future Custom Hardware

Once the software works, build dedicated hardware.

Possible hardware:

```text
Far-field microphone array
        ↓
Small computer / SoC
        ↓
Wake-word engine
        ↓
Cloud Companion API
        ↓
Speaker
```

Potential hardware platform:

- Raspberry Pi prototype
- ESP32-class microcontroller for simpler versions
- Linux SBC
- Dedicated ARM SoC for production

The hardware does not need to run the LLM initially.

It can simply be:

**ears + network + voice + speaker.**

## 22. Custom Wake Word

Instead of:

> "Alexa, open Fume."

The eventual device could simply respond to:

> "Fume."

or another custom wake word.

Then:

> "Fume, what were we talking about yesterday?"

No Alexa invocation.

No phone.

No laptop.

No app.

Just the room companion.

## 23. Ambient Conversation

The final product should feel fundamentally different from Alexa.

Instead of:

```text
Command
→ Response
→ End
```

The desired experience is:

```text
Wake
→ Conversation
→ Follow-up
→ Follow-up
→ Natural pause
→ Conversation ends
```

The companion should understand conversational references.

Example:

> "What do you think?"

> "About the startup."

> "I think it's worth exploring, especially because..."

The user should not have to repeatedly say the wake word.

## 24. Session Management

Because Alexa may terminate a skill session, the backend should maintain its own concept of a conversation session.

```text
Alexa session
       ↓
Backend session
       ↓
Conversation ID
       ↓
Persistent history
```

If Alexa terminates:

```text
Alexa session → END

Backend conversation → CONTINUES TO EXIST
```

Therefore the limitation affects the interface, not the memory.

## 25. "Continue" Capability

If the user reopens the companion:

> "Alexa, open Fume."

The system can say:

> "Welcome back. We were talking about your startup idea. Want to continue?"

This makes the Alexa limitation much less painful.

## 26. Product Philosophy

The companion should not behave like a search box.

It should behave like:

**A persistent intelligence that lives in your environment.**

Key principles:

1. Voice first
2. Memory first
3. Model agnostic
4. Tool enabled
5. Privacy controlled
6. Hardware independent
7. Conversation over commands
8. User-owned memory
9. Minimal friction
10. Replaceable infrastructure

## 27. Crazy / Future Features

### Memory Time Travel

> "What was I interested in six months ago?"

> "What were we discussing around this time last year?"

### Personal Pattern Detection

> "You've mentioned changing jobs 11 times this year. Do you want to think through what's bothering you?"

### Relationship Memory

> "Your friend Alex prefers morning meetings."

### Life Timeline

The system builds a private timeline:

```text
January → New project
March → Started job search
June → Travel
August → AI Companion project
```

### Personal Knowledge Graph

The companion gradually builds a graph of:

```text
People
Places
Projects
Ideas
Goals
Preferences
Events
Conversations
```

### Cross-Model Intelligence

One assistant, multiple models.

The user doesn't need to care whether the response came from DeepSeek, OpenAI, Claude, Qwen, or a local model.

### Companion-to-Companion

Eventually multiple devices could share the same identity.

Bedroom:

> "Good night."

Living room:

> "Welcome back."

Car:

> "We were discussing that startup idea earlier."

All are the same companion.

## 28. MVP Scope

Do NOT build everything initially.

Version 1 should contain only:

```text
Alexa Skill
+
Backend API
+
Conversation Database
+
Session Manager
+
Memory Engine
+
DeepSeek-compatible Model Provider
+
Text-to-Speech response
+
Basic authentication
```

Initial voice commands:

```text
"Alexa, open Fume."

"Remember this."

"Forget that."

"What do you remember about me?"

"Continue our conversation."

"Goodbye."
```

## 29. Phase 2

Add:

- Better memory extraction
- Semantic search
- User profile
- MCP
- Calendar
- Smart home
- Multiple model providers
- Model routing
- Proactive notifications
- Memory dashboard

## 30. Phase 3

Build custom hardware.

Replace:

```text
Alexa → Custom Voice Device
```

while retaining:

```text
Backend
Memory
LLM
Tools
Identity
Conversation Engine
```

This is the most important architectural advantage of the project.

## 31. Target End State

The final system should feel like this:

User walks into a room.

> "Fume."

The device wakes.

> "Yeah?"

> "What was that thing we were talking about yesterday?"

The companion remembers.

> "You were thinking about building the AI companion and were debating whether to use DeepSeek or another model."

> "Yeah. I think I figured it out."

> "What did you decide?"

No phone.

No laptop.

No app.

No repeated invocation.

No command syntax.

Just a persistent AI companion living in the room.

## 32. Core Architectural Principle

The project should be built around one rule:

> **Never make Alexa the product. Make the Companion the product.**

Alexa is simply the first microphone and speaker.

When custom hardware arrives, Alexa disappears and the rest of the system remains intact.
