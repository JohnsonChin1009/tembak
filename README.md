# Tembak

**Talk it through. Then ship the app.**

Tembak is a team chat that builds software. When a conversation has enough
context, anyone can tag `@tembak` and Gemini builds a small, single-purpose app
(a dashboard, a tracker, a calculator, a form) from what the team said. It
previews next to the chat and publishes to a live link in one click.

*Tembak* is Malay for "to shoot". Built for the Google AI Builder Cup.

## How it works

1. Your team talks in a channel, for example about Q4 spend per channel and the Google Sheet that tracks it.
2. Someone writes `@tembak make us a dashboard for this`.
3. Tembak asks a clarifying question if it needs one, then builds the app.
4. The app opens in a side panel. Ask for changes in plain words; each one becomes a new version.
5. Click **Publish**. Tembak posts the live link in the channel.

## What's in it

- **Workspaces.** Create one, invite your team with a link, and keep channels, data and apps private to the team. An open **Demo** workspace is always available.
- **Channels and threads.** Realtime chat, `@` mentions of teammates, and unread-mention badges in the sidebar.
- **Data connectors.** Google Sheets, Notion, Linear, CSV and JSON APIs. Apps read real data through a server-side proxy, so secrets never reach the browser or the model.
- **Builder panel.** Live preview, code view and version history for every app.
- **App runtime.** Every generated app gets a small `window.tembak` API:

  | Call | What it does |
  |---|---|
  | `tembak.data(key)` | Reads a connected data source |
  | `tembak.kv.get` / `tembak.kv.set` | Stores small values for the app |
  | `tembak.me()` / `tembak.members()` | The person using the app and their teammates |
  | `tembak.post(text, { thread })` | Posts a message to the app's channel |
  | `tembak.ask(prompt, { data, json, schema })` | One rate-limited AI call from inside the app |
  | `tembak.action(name, input)` | Writes back to Sheets, Notion or Linear |

## Run locally

No credentials needed:

```bash
pnpm install
pnpm dev            # http://localhost:3000
```

With no `.env.local`, Tembak uses an in-memory store, name-only sign-in and a
mock agent that still builds a working dashboard. Sign in, then create a
workspace or open the seeded Demo at `/w/demo`. To see realtime chat, copy the
invite link from the workspace menu into a second browser window and sign in
with another name.

To switch on the real services, copy [.env.example](.env.example) to
`.env.local` and set what you need. Every option is documented there.

| To use | Set |
|---|---|
| Real Gemini | `GEMINI_API_KEY` (or `GOOGLE_GENAI_USE_VERTEXAI=true`) |
| Real Firestore | `STORE=firestore` and `GOOGLE_CLOUD_PROJECT`, after `gcloud auth application-default login` |
| Google sign-in | `AUTH_MODE=firebase` and the `FIREBASE_*` web config |
| Notion and Linear OAuth | `NOTION_OAUTH_*` and `LINEAR_OAUTH_*` (otherwise connectors use API keys) |
| Reset demo button | `DEMO_OWNER_EMAILS=dev:<your name>` in dev sign-in mode |

## Routes

| Path | Page |
|---|---|
| `/login` | Sign in |
| `/new` | Create a workspace |
| `/join/:token` | Accept an invite |
| `/w/:slug/c/:channel` | A workspace channel |
| `/w/:slug/settings` | Workspace, agent and connector settings |
| `/a/:slug` | A published app |

## Stack

Next.js 16 (App Router) on Cloud Run · Firestore · Firebase Auth · Gemini via
`@google/genai` · Server-Sent Events for realtime · Tailwind v4.

One Cloud Run service runs everything: the UI, the API, the agent and the
published apps. Generated apps are single HTML files stored in Firestore, so
publishing is a database write, not a build. Apps run in a sandbox and can't
touch the user's session.

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Local dev server |
| `pnpm build` | Production build (standalone output) |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | Route types and `tsc` |
| `./scripts/setup-gcp.sh` | One-time Google Cloud project setup |
| `./scripts/deploy.sh` | Build with Cloud Build and deploy to Cloud Run |

## Docs

- [docs/README.md](docs/README.md): product, architecture and key decisions
- [docs/DEPLOY.md](docs/DEPLOY.md): deploying to Google Cloud
- [docs/prd/](docs/prd/): one PRD per module
