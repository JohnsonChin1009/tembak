# PRD 03: Agent

## Goal

Turn a channel conversation into a working app. The agent should feel like a
sharp teammate: it asks only what it truly needs, then builds.

## Trigger

A user message with `mentionsAgent` creates an **agent run**. It runs after the
HTTP response via Next.js `after()`, so on Cloud Run deploy with
`--no-cpu-throttling` (PRD 07). The run:

1. Inserts a placeholder agent message `{status: "thinking"}` that streams to all clients.
2. Builds context:
   - the last 40 messages in the channel (author names and text; agent build results summarized as `[built app "X" v3]`)
   - the triggering message
   - the workspace's data sources (name, key, kind, column names, 3 sample rows)
   - the target app, if any: `appRef` on the message, or the most recent app in the channel when the user says "it", "the dashboard", or similar
3. **Triage** (fast model, JSON output) decides one of:
   - `reply`: answer or ask clarifying questions (max 3, specific, with suggested defaults)
   - `build`: create a new app; returns `{title, brief}`, where the brief is a compact spec distilled from the chat
   - `revise`: change an existing app; returns `{appId, instructions}`
4. For `reply`: update the placeholder with the text, `status: done`.
5. For `build` and `revise`: set `status: building` with a short "on it" line, call the
   build model to produce HTML, validate, save a new version, then update the
   placeholder with a summary and `appRef`, `status: done`.
6. On any error: `status: error` with a human-readable error, and log details server-side.

Bias: if the team has already discussed what they want, or the user says
"just build it", **build** with sensible assumptions and list them in the
reply instead of asking.

## Build output contract

The build model returns one complete HTML document:

- `<!doctype html>`, mobile-friendly, works offline except for allowed CDNs
- Allowed CDNs: `cdn.tailwindcss.com`, `cdn.jsdelivr.net`, `unpkg.com`, `cdnjs.cloudflare.com`, Google Fonts
- No `localStorage` dependence for core function (sandboxed origin); wrap any use in try/catch
- Data access only via the injected runtime: `await tembak.data("<sourceKey>")` returns an array of row
  objects. If no suitable source exists, embed realistic mock data and label it "Sample data".
- Optional `tembak.ask(prompt)` is not in the MVP.

Post-processing: strip markdown fences, require `<html`, enforce a 500KB cap,
and on failure retry once with the validation error.

## Prompts

They live in `src/lib/agent/prompts.ts` as plain template functions so they're
easy to tune during the day. The system prompt covers who Tembak is, the
audience (non-technical teammates), the output contract, the design bar
(clean, modern, legible charts, real labels, no lorem ipsum), and the runtime API.

## Mock mode

`AGENT_MODE=mock` gives deterministic behavior for local dev and the demo fallback:
a short wait, then a reply if the message contains `?`, otherwise a build of a
templated dashboard (KPI tiles, a chart, a table) themed by keywords in the
conversation. Revisions append a "revision note" and tweak the accent color, so v2 is visibly different.

## Acceptance

- In mock mode, `@tembak build a dashboard` in `#marketing` produces an app card within 3s.
- In Gemini mode, the seeded `#marketing` conversation with `@tembak make a dashboard` builds a
  dashboard that uses the `campaign` sample source.
- Failures never leave a message stuck in `thinking` (a timeout of 180s marks it as an error).
