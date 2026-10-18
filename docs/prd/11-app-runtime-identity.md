# PRD 11: App runtime v2, identity and capabilities (foundation)

## Goal

Generated apps can show data and remember a list (`window.tembak.data()` and `kv`), but they can't
tell who is using them or do anything on someone's behalf.

This PRD adds the first identity capabilities, `tembak.me()` and `tembak.members()`, on top of the
member identity that every app runtime already carries (see "Already shipped" below).

PRDs 12 (post to channel), 13 (AI in apps) and 14 (write-back actions) depend on this one and
must use the helpers defined here, not their own auth.

## Already shipped: workspace-scoped apps

Apps are never public. Every place an app runs has a signed-in member of the app's workspace
behind it, so there is no anonymous "public mode" to design for.

| Where | How the member is identified |
|---|---|
| Builder panel preview (`src/components/builder/builder-panel.tsx`, `srcdoc` iframe) | Panel fetches a token from `POST /api/apps/[id]/token` (session auth + `requireAppAccess`) and refreshes it 5 minutes before expiry |
| Published page `GET /a/:slug` on the apps host (`src/app/a/[slug]/route.ts`) | Viewer cookie on the apps host, set via the `/view/:slug` handshake below; the page is served with a token baked in |

Published-link handshake (the apps host can't see the workspace session cookie):

1. `GET apps/a/:slug` with no valid `tembak_viewer` cookie, or a viewer who can't use this workspace's
   apps → redirect to `app/view/:slug`.
2. `GET app/view/:slug` (`src/app/view/[slug]/route.ts`): signed out → `/login?next=/view/:slug`. Not a
   member, or the app isn't published → the same 404 as an unknown link (`src/lib/app-not-found.ts`), so
   links don't leak which apps exist. Member → redirect to `apps/a/:slug?ticket=…` (60 s ticket).
3. The apps host verifies the ticket, sets `tembak_viewer` (httpOnly, `path=/a/`, 12 h) and redirects to
   the clean URL, which serves the app with `cache-control: private, no-store`.

Open workspaces (the demo) let any signed-in user through, as they do for joining.

Pages still run on an opaque origin via the CSP sandbox, and runtime requests keep
`credentials: "omit"`: auth is the bearer header only, never cookies.

### App token (`src/lib/app-token.ts`)

```ts
type AppTokenClaims = { appId: string; workspaceId: string; uid: string };
export function signAppToken(claims: AppTokenClaims, ttlMs?: number): string; // default 12 h
export const verifyAppToken: (raw: string | null | undefined, now?: number) => (AppTokenClaims & { exp: number }) | null;
```

HMAC-SHA256 over a base64url JSON payload, key = `HKDF(SESSION_SECRET, "tembak:app-token:v1")`, constant-time
compare. The viewer ticket and viewer cookie use the same signer with their own HKDF keys.
`injectRuntime(html, { …, token })` sends `authorization: Bearer <token>` on every runtime call.

### Runtime API auth (`src/lib/runtime-auth.ts`)

```ts
export type RuntimeCaller = { app: App; workspaceId: string; uid: string };
/** Verifies the bearer token, loads the app and checks the uid can still use the workspace's apps. */
export async function requireRuntimeCaller(req: Request, appId: string): Promise<RuntimeCaller>;
export class RuntimeAuthError extends Error { status: 401 | 403 | 404 }
export async function canUseWorkspaceApps(workspaceId: string, uid: string): Promise<boolean>;
```

- 401 when the token is missing, invalid or expired ("Open this app from Tembak to use it.").
- 403 when the token is for a different app, or the user is no longer a member.
- `/api/public/data` and `/api/public/kv` already use it. `CORS_HEADERS` already allows `authorization`.

## To build in this PRD

- New runtime routes live under `src/app/api/runtime/[appId]/…`, call `requireRuntimeCaller`, and use
  `publicJson`/`publicError`/`preflight` from `src/lib/public-api.ts` (CORS `*`, opaque origin).
- Simple in-memory rate limiter in `src/lib/rate-limit.ts` (`limit(key, max, windowMs) => boolean`),
  fine for the single Cloud Run instance. Later PRDs reuse it.

## Capabilities in this PRD

```js
await tembak.me()               // { uid, name, photoUrl?, title? }
await tembak.members()          // [{ uid, name, photoUrl?, title? }]
```

- `GET /api/runtime/[appId]/me` and `GET /api/runtime/[appId]/members`. Never return emails.

## Builder prompt and UI kit

- Document the new runtime surface in `RUNTIME_DOC` (`src/lib/agent/prompts.ts`). Apps can assume a
  signed-in member; there's no anonymous mode to degrade for.
- UI kit helpers worth adding if cheap: `ui.avatar(el, person)`, and `ui.form` field type
  `"member"` (a select filled from `tembak.members()`).
- Update the `tracker` and `kanban` skills to use `tembak.me()` for "created by" and `"member"` fields for owners.

## Acceptance

- In the builder preview, an app calling `tembak.me()` shows the signed-in member's name.
- The same app published and opened by another member shows *their* name; opened by a non-member it 404s.
- A token for app A can't call app B's routes (403). An expired token gets 401. A removed member gets 403.
- `pnpm typecheck` and `pnpm lint` pass. Mock agent mode still builds apps.
