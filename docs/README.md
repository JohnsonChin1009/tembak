# Tembak

> *tembak* (Malay): to shoot. One tag. One shot. One flow.

Tembak is a chat workspace for small teams. When a conversation has enough
context, anyone can tag `@tembak` and the agent (Gemini) asks what it needs,
builds a small single-purpose app (a dashboard, tracker, calculator, form),
previews it beside the chat, and publishes it to a live URL on Google Cloud.
These are **disposable apps**: built in minutes, for one job, by people who
don't write code.

Built for the Google AI Builder Cup, in one day.

## The demo (what we're optimizing for)

1. Two teammates are chatting in `#marketing` about the Q4 campaign: spend per
   channel, sign-ups, a Google Sheet that tracks it all.
2. One types: `@tembak can you make us a dashboard for this?`
3. Tembak replies in the channel with one or two clarifying questions (or goes
   straight to building if the context is clear).
4. A "Building..." card appears. Seconds later the preview opens in the side
   panel: a working dashboard that reads the team's Sheet.
5. "Make the sign-ups chart a line chart and add a CPA column." Tembak
   revises it and produces v2.
6. Click **Publish**. A link like `apps.<domain>/q4-campaign-dashboard-x7k2`
   is posted in the channel. Anyone opens it.

## Architecture

```
                         Cloud Run service "tembak" (Next.js, one container)
 Browser  ───────────►  ┌──────────────────────────────────────────────────┐
  - chat UI              │  UI (app router)          /api/*  route handlers │
  - builder panel        │  SSE /api/w/:ws/channels/:id/stream             │
  - iframe preview       │  Agent runner (Gemini via @google/genai)         │
                         │  App server  /a/:slug  (CSP sandbox, opaque orig)│
 apps.<domain> ───────►  │  Data proxy  /api/public/data/:appId/:source     │
                         └───────┬───────────────────────┬──────────────────┘
                                 │                       │
                         Firestore (workspace,     Gemini API / Vertex AI
                         channels, messages,       Google Sheets API (ADC)
                         apps, versions, sources)
```

One Cloud Run service does everything. Generated apps are **single HTML
files** stored in Firestore and served by the same service. "Publish" is an
instant database write, not a build pipeline. Per-app Cloud Run deploys are a
stretch goal (see PRD 07).

### Key decisions

| Decision | Choice | Why |
|---|---|---|
| Framework | Next.js (App Router, TypeScript), Tailwind v4 | UI, API, and app hosting in one deployable |
| Data | Firestore via `firebase-admin` (server-only) | Serverless, free tier, no schema migrations |
| Realtime | Server-Sent Events backed by Firestore `onSnapshot` | Works across Cloud Run instances, no websocket infra |
| Auth | Firebase Auth (Google sign-in) to a server session cookie | Workspace users already have Google accounts |
| LLM | Gemini (`GEMINI_MODEL`, default `gemini-3.5-flash-lite`) | Hackathon requirement; model is configurable |
| Generated app format | One self-contained HTML file (Tailwind CDN, Chart.js, vanilla JS) | Instant preview (`iframe srcdoc`), instant publish |
| Isolation | Preview: `sandbox="allow-scripts"`. Published: `Content-Security-Policy: sandbox` header plus optional separate `APPS_HOST` | Generated code can't touch the user's session |
| Local dev | `STORE=memory`, `AUTH_MODE=dev`, `AGENT_MODE=mock` | Whole product runs with zero cloud credentials |

The client never talks to Firestore directly. Every read and write goes
through `/api/*`, so the client bundle carries no Firebase config except the
Auth web config, and Firestore rules can deny all client access.

## Modules and PRDs

| # | Module | PRD | Branch |
|---|---|---|---|
| 01 | Foundation: scaffold, config, store abstraction, auth | [prd/01-foundation.md](prd/01-foundation.md) | `feat/foundation` |
| 02 | Workspace and chat: channels, messages, realtime, mentions | [prd/02-workspace-chat.md](prd/02-workspace-chat.md) | `feat/chat` |
| 03 | Agent: context, clarify, build, revise | [prd/03-agent.md](prd/03-agent.md) | `feat/agent` |
| 04 | Builder panel: preview, code, versions | [prd/04-builder-panel.md](prd/04-builder-panel.md) | `feat/builder` |
| 05 | App hosting and publish | [prd/05-app-hosting.md](prd/05-app-hosting.md) | `feat/hosting` |
| 06 | Data connectors: Sheets, CSV, JSON APIs | [prd/06-data-connectors.md](prd/06-data-connectors.md) | `feat/connectors` |
| 07 | Deployment to Google Cloud | [prd/07-deployment.md](prd/07-deployment.md) | `feat/deploy` |

## Build plan (one day, solo + agent)

Each module is built in its own git worktree (`../tembak-worktrees/<module>`)
on its own branch, committed, and merged into `main` with `--no-ff`. Nothing is
pushed to the remote; the owner pushes when ready.

| Phase | Owner | Work |
|---|---|---|
| Overnight | Claude | Modules 01 to 07: code, docs, deploy scripts. Everything runnable locally in mock mode |
| Morning, hour 1 | Human | Create GCP project, enable APIs, Firebase Auth, Gemini key (see [DEPLOY.md](DEPLOY.md)) |
| Morning, hour 2 | Human | `./scripts/deploy.sh`, map domain, smoke test with real Gemini |
| Rest of day | Both | Prompt tuning, demo script, polish, stretch goals |

## Non-goals for the hackathon

- Multi-workspace and org management (one workspace per deployment)
- Fine-grained permissions (anyone signed in with an allowed email domain is a member)
- Multi-file or server-side generated apps (single HTML only; data goes through the proxy)
- OAuth to third-party services (connectors use the service account, public links, or a stored header secret)
