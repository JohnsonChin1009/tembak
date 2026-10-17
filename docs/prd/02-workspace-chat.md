# PRD 02: Workspace and chat

## Goal

Slack-lite: channels and realtime messages that are good enough that the demo
conversation feels natural, plus the `@tembak` mention that hands off to the agent.

## User stories

- As a member I can see the channel list, switch channels, and create a channel.
- As a member I see new messages from teammates appear without refreshing.
- As a member I can type `@` and pick `tembak` from an autocomplete. Enter sends, Shift+Enter adds a newline.
- As a member I see agent messages render differently: status (thinking, building),
  markdown text, and **app cards** (title, version, "Open" and "Publish" buttons).

## Data model

```ts
Message {
  id, channelId, createdAt (ms),
  author: { kind: "user", uid, name, photoUrl? } | { kind: "agent" },
  text: string,                 // markdown for the agent
  mentionsAgent: boolean,
  appRef?: { appId, version }   // set on agent build results, and on user revision requests from the builder
  status?: "thinking" | "building" | "done" | "error"   // agent messages only
  error?: string
}
Channel { id, name, topic?, createdAt, createdBy }
```

## API

| Method | Path | Body / result |
|---|---|---|
| GET | `/api/channels` | `Channel[]` |
| POST | `/api/channels` | `{name, topic?}` returns `Channel` (name slugified, unique) |
| GET | `/api/channels/:id/messages?limit=100` | `Message[]` ascending |
| POST | `/api/channels/:id/messages` | `{text, appRef?}` returns `Message`. If it mentions the agent, an agent run starts after the response (PRD 03) |
| GET | `/api/channels/:id/stream` | SSE: `event: message` with a `Message` (new or updated), plus a heartbeat every 20s |

Mention detection: `/(^|\s)@tembak\b/i`. Messages sent from the builder panel's
"request changes" box always set `mentionsAgent` and carry `appRef`.

## UX details

- Messages from the same author within 5 minutes group together (avatar shown once).
- Auto-scroll to the bottom unless the user has scrolled up. Show a "New messages" pill when they have.
- Optimistic send: the message shows right away, then reconciles by id when the SSE echo arrives.
- Empty channel state suggests a starter prompt.
- Seed data: `#general`, `#marketing` (with a realistic campaign conversation so the demo
  works immediately), `#ops`.

## Acceptance

- Two browser windows (two dev users) see each other's messages within about 1s.
- Reloading keeps history; switching channels resubscribes cleanly (no leaked streams).
