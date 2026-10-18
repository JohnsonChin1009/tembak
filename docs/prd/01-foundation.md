# PRD 01: Foundation

## Goal

A Next.js app that boots locally with zero credentials and in production with
Firestore and Firebase Auth. It provides the shared plumbing every other
module uses: config, a storage abstraction, sessions, and the UI shell.

## Requirements

### Config (`src/lib/config.ts`)

Server-only, read once from env, validated with zod.

| Var | Default | Notes |
|---|---|---|
| `STORE` | `memory` | `memory` or `firestore` |
| `AUTH_MODE` | `dev` | `dev` (pick a name, no password) or `firebase` |
| `AGENT_MODE` | `mock` if no `GEMINI_API_KEY`, else `gemini` | `mock` or `gemini` |
| `GEMINI_API_KEY` | (none) | Gemini Developer API key. Or use `GOOGLE_GENAI_USE_VERTEXAI=true` |
| `GEMINI_MODEL` | `gemini-3.5-flash-lite` | Builds and revisions |
| `GEMINI_FAST_MODEL` | `gemini-3.5-flash-lite` | Triage (reply or build?) |
| `APP_URL` | `http://localhost:3000` | Public URL of the workspace |
| `APPS_URL` | `APP_URL` | Public origin for published apps, e.g. `https://apps.example.com` |
| `ALLOWED_EMAIL_DOMAINS` | (none) | Comma list; empty means any Google account |
| `SESSION_SECRET` | dev value | HMAC key for dev-mode sessions and OAuth state; also the source of the key that encrypts connector tokens |
| `FIREBASE_WEB_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_PROJECT_ID` | (none) | Web config for client Google sign-in, passed to the login page at runtime (no build-time env) |
| `SERVICE_ACCOUNT_EMAIL` | (none) | Shown in the Add Sheet dialog |
| `NOTION_OAUTH_CLIENT_ID`, `NOTION_OAUTH_CLIENT_SECRET`, `LINEAR_OAUTH_CLIENT_ID`, `LINEAR_OAUTH_CLIENT_SECRET` | (none) | Optional OAuth apps for the Notion and Linear connectors (PRD 10); without them, API keys only |

### Store (`src/lib/store/`)

A `Store` interface with two implementations: `MemoryStore` (process-local,
seeded with demo data, persists across HMR via `globalThis`) and
`FirestoreStore`. Both implement:

- users: `upsertUser`, `getUser`
- channels: `listChannels`, `createChannel`, `getChannel`
- messages: `listMessages(channelId, limit)`, `addMessage`, `updateMessage`, `subscribeMessages(channelId, cb) => unsubscribe`
- apps: `createApp`, `getApp`, `getAppBySlug`, `listApps`, `updateApp`
- versions: `addVersion`, `getVersion`, `listVersions`
- sources: `listSources`, `getSource`, `upsertSource`, `deleteSource`

Firestore layout: originally a single workspace; since PRD 08 everything except apps is
nested under `workspaces/{wid}`. See [08-workspaces.md](08-workspaces.md#firestore-layout).

```
users/{uid}
workspaces/{wid}  (+ members/, channels/{channelId}/messages/, sources/)
apps/{appId}      (+ versions/{n}, kv/{key}; has workspaceId)
```

### Auth and session (`src/lib/auth/`)

- Cookie `tembak_session`, httpOnly, SameSite=Lax, Secure in production.
- **dev mode**: `/login` shows a name field. The server signs `{uid, name}` with HMAC.
- **firebase mode**: `/login` uses Firebase Auth `signInWithPopup(GoogleAuthProvider)`,
  POSTs the ID token to `/api/session`, and the server verifies it and creates a Firebase
  session cookie (5 days). `ALLOWED_EMAIL_DOMAINS` is enforced here.
- `getSessionUser()` is used by server components and route handlers. It returns `null` if signed out.
- Proxy (`src/proxy.ts`, Next 16's renamed middleware) redirects signed-out users from `/` to `/login`. It skips `/a/*` and `/api/public/*`.

### UI shell

- `/login`: brand, one-line pitch, sign-in button.
- `/w/[slug]/c/[channelId]` (was `/c/[channelId]` before PRD 08): three-column app shell: sidebar | channel | builder panel (collapsible).
- Design: dark-first neutral palette with one accent (electric lime `#c6f432`, which reads
  "shoot" or "go"), Geist Sans and Geist Mono, 8px spacing grid, subtle borders, no gradients-on-everything.

## Acceptance

- `pnpm dev` with no `.env` boots, `/login` works, and you land in `#general` with seeded channels.
- `pnpm build` and `pnpm lint` are clean.
- No secrets in git; `.env.example` documents every var.
