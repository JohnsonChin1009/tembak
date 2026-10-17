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

With no `.env.local`, Tembak uses an in-memory store (seeded with a demo
workspace), name-only dev sign-in, and a mock agent that builds a real working
dashboard. Open two browser windows with different names to see realtime chat.

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
