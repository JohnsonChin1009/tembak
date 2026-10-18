# Tembak

**Talk it through. Then ship the app.**

Tembak is a team chat that builds software. When a conversation has enough
context, anyone can tag `@tembak` and Gemini builds a small, single-purpose app
(a dashboard, a tracker, a calculator) from what the team said. It previews
next to the chat and publishes to a live URL on Google Cloud in one click.

Built for the Google AI Builder Cup.

- Product, architecture, and PRDs: [docs/README.md](docs/README.md)
- Deploying to Google Cloud: [docs/DEPLOY.md](docs/DEPLOY.md)

## Run locally (no credentials needed)

```bash
pnpm install
pnpm dev            # http://localhost:3000
```

With no `.env.local`, Tembak uses an in-memory store, name-only dev sign-in, and
a mock agent that builds a real working dashboard. After signing in you create a
workspace (or open the seeded **Demo** at `/w/demo`). Copy the invite link from
the workspace menu into a second browser window to see realtime chat between two people.

Routes: `/w/:slug/c/:channel` is a workspace channel, `/new` creates a workspace,
`/join/:token` accepts an invite, and `/a/:slug` serves a published app. To be a
maintainer of the Demo workspace locally (it unlocks **Reset demo**), set
`DEMO_OWNER_EMAILS=dev:<your name>` in `.env.local`.

To use real Gemini locally, put `GEMINI_API_KEY=...` in `.env.local`. To use real
Firestore, run `gcloud auth application-default login` and set `STORE=firestore`
and `GOOGLE_CLOUD_PROJECT=...`. Every option is documented in [.env.example](.env.example).

## Stack

Next.js 16 (App Router) on Cloud Run · Firestore · Firebase Auth · Gemini via
`@google/genai` · Server-Sent Events for realtime · Tailwind v4.

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Local dev server |
| `pnpm build` | Production build (standalone output) |
| `pnpm lint` / `pnpm typecheck` | Checks |
| `./scripts/setup-gcp.sh` | One-time GCP project setup |
| `./scripts/deploy.sh` | Build with Cloud Build and deploy to Cloud Run |
