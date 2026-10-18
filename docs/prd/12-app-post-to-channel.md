# PRD 12: Apps post back to their channel

Depends on PRD 11 (`requireRuntimeCaller`, app token, rate limiter).

## Goal

Close the loop between an app and the conversation it came from. An app can post a short
message into its channel: "Budget approved by Ben: TikTok −20%", "3 new RSVPs today",
"Aisha moved *Launch email* to Done". This is how decisions made inside apps get back to the team.

## API

```js
await tembak.post(text, { thread?: boolean })
```

- `POST /api/runtime/[appId]/post` `{ text, thread? }`, auth via `requireRuntimeCaller`.
- Text: 1 to 1,000 chars, markdown subset the chat already renders (`src/components/chat/rich-text.tsx`).
  Strip `<@uid>` mention syntax except for real workspace members, and never trigger the agent
  (`mentionsAgent: false`, even if the text contains "@tembak").
- `thread: true` posts as a reply in the thread of the message that introduced the app (the agent
  message whose `appRef.appId` matches); otherwise a top-level channel message.
- Rate limit: 10 posts per app per member per 10 minutes, 60 per app per hour. 429 with a friendly message.

## Message shape

A new author kind so the UI can render it distinctly and the agent transcript can read it:

```ts
author: { kind: "app"; appId: string; appTitle: string; uid: string; name: string }
```

- Rendered as the app's title with a small app icon, "via <member name>", and a link that opens the
  app in the builder panel (reuse the `appRef` click behavior).
- Agent context (`src/lib/agent/context.ts` `line()`): `[hh:mm] App "Title" (posted by Name): text`.
- Update every place that switches on `author.kind` (message item, people context, hover cards, store
  serializers in `src/lib/store/*`) so the new kind doesn't crash anything.

## Builder prompt

- Document `tembak.post` in `RUNTIME_DOC`: use it for meaningful events only (a decision, a submitted
  approval, a summary the user asked to share), never on load or on every keystroke, and always behind
  an explicit user action (button click).
- Add a "Share to channel" pattern to the `report` and `kpi-dashboard` skills: a button that posts a 2-3
  line summary of what's on screen.

## Acceptance

- In the builder preview and on the published link, clicking an app's "Share to channel" button posts a
  message that appears live in the channel (existing SSE stream) with the app attribution of the member
  who clicked it.
- An app message mentioning "@tembak" does not start an agent run.
- `pnpm typecheck` and `pnpm lint` pass.
