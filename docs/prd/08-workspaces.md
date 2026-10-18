# PRD 08: Workspaces

## Goal

Move Tembak from one shared demo space to real workspaces: anyone can create a
workspace, invite their team with a link, and keep their channels, data, and
apps private to that team. The demo stays available as one open workspace.

Budget: about 4 hours. Onboarding (PRD 09) builds on this; agent rules, skills,
and connectors (PRD 10) will be stored per workspace, so the data model reserves
room for them.

## User stories

- As a new user I can create a workspace by giving it a name, and I land in its `#general`.
- As an owner I can copy an invite link, send it to a teammate, and they join in one click after signing in.
- As an owner I can reset the invite link so old links stop working.
- As a member of several workspaces I can switch between them from the sidebar.
- As anyone signed in I can open the **Demo** workspace and try Tembak without creating anything.
  Creating my own workspace is the default path; the demo is the secondary option.
- As a Tembak maintainer I own the Demo workspace and can reset it to its curated seed.
- As a member I only ever see channels, messages, apps, and data sources from workspaces I belong to.
- As a visitor with a published app link I can still open the app without signing in (unchanged).

## Data model

```ts
Workspace {
  id: string            // random, e.g. "ws_k3x9…"
  slug: string          // kebab(name) + "-" + 4 base36 chars, unique, used in URLs
  name: string          // 1..40 chars
  createdAt: number
  createdBy: string     // uid
  inviteToken: string   // 24 random url-safe chars; rotate to revoke
  open?: boolean        // true only for the Demo workspace: any signed-in user can join
  // Reserved for PRD 10: agentRules?: string
}

Member {
  uid: string
  role: "owner" | "member"
  name: string; email?: string; photoUrl?: string   // denormalized for the member list
  joinedAt: number
}

User { …existing, workspaceIds: string[], lastWorkspaceId?: string }
```

Every workspace-owned record gains `workspaceId`: `Channel`, `Message`, `Source`, `App`.

### Firestore layout

```
users/{uid}                                   // + workspaceIds[], lastWorkspaceId
workspaces/{wid}
workspaces/{wid}/members/{uid}
workspaces/{wid}/channels/{channelId}
workspaces/{wid}/channels/{channelId}/messages/{messageId}
workspaces/{wid}/sources/{sourceId}
apps/{appId}                                  // stays top level, + workspaceId
apps/{appId}/versions/{n}
apps/{appId}/kv/{key}
```

Apps stay top level because the public routes (`/a/:slug`, `/api/public/data/:appId/:key`,
`/api/public/kv/:appId/:key`) look them up without knowing the workspace. The data
proxy resolves `app.workspaceId` and only reads sources from that workspace.

Channel ids stay human slugs (`general`, `marketing`), unique within a workspace only.
`workspaceIds` on the user avoids a collection-group query and its index.

### Store interface

All workspace-owned methods take `workspaceId` first:

```ts
createWorkspace(ws, owner: Member), getWorkspace(id), getWorkspaceBySlug(slug),
getWorkspaceByInvite(token), updateWorkspace(id, patch),
addMember(wid, member), getMember(wid, uid), listMembers(wid),
listWorkspacesForUser(uid)

listChannels(wid), getChannel(wid, id), createChannel(wid, channel)
listMessages(wid, channelId, limit), getMessage(wid, channelId, id),
addMessage(message /* has workspaceId */), updateMessage(wid, channelId, id, patch),
subscribeMessages(wid, channelId, listener)

listApps(wid)          // getApp/getAppBySlug/createApp/updateApp/versions/kv unchanged
listSources(wid), getSource(wid, id), getSourceByKey(wid, key), upsertSource(source), deleteSource(wid, id)
```

`MemoryStore` and `FirestoreStore` both implement it; the memory store keeps one
map per workspace.

## Routes

### Pages

| Path | Behavior |
|---|---|
| `/` | Signed out: landing page. Signed in: redirect to `lastWorkspaceId`'s first channel, or `/new` if the user has no workspaces |
| `/new` | Primary: create a workspace (name field, focused). Secondary: "Explore the demo workspace" link |
| `/w/[slug]` | Redirect to the workspace's first channel |
| `/w/[slug]/c/[channelId]` | The workspace UI (today's `/c/[channelId]`). 404 if not a member |
| `/join/[token]` | Signed out: `/login?next=/join/[token]`. Signed in: add as member (idempotent), redirect to the workspace |
| `/c/[channelId]` | Legacy: redirect to `/w/demo/c/[channelId]` so old links keep working |

### API

Workspace-scoped routes move under `/api/w/[ws]/…`, where `[ws]` is the slug. Every
handler starts with `requireMember(ws)`, which returns `{ user, workspace, member }`
or throws 401 (signed out), 404 (no such workspace, or not a member; don't leak
existence).

| Method | Path | Notes |
|---|---|---|
| GET | `/api/workspaces` | Workspaces I belong to |
| POST | `/api/workspaces` | `{name}` creates a workspace with me as owner and seeds `#general` |
| GET | `/api/w/[ws]` | Workspace, my role, members, and the invite URL (any member can share it; open workspaces have none) |
| POST | `/api/w/[ws]/invite` | Owner only: rotate the invite token, returns the new URL |
| POST | `/api/w/[ws]/reset` | Demo owners only: clear the demo and restore the curated seed |
| GET | `/api/w/[ws]/members` | Member list |
| POST | `/api/join/[token]` | Join by invite; returns the workspace slug |
| * | `/api/w/[ws]/channels…`, `/messages`, `/stream` | Moved from `/api/channels…` |
| * | `/api/w/[ws]/sources…` | Moved from `/api/sources…` |
| GET | `/api/w/[ws]/apps` | Moved from `/api/apps` |

App routes (`/api/apps/[id]`, `/versions/[n]`, `/publish`) stay flat because app ids
are global; each one loads the app, then checks membership in `app.workspaceId`.

Public routes are unchanged.

## Agent

- `startAgentRun` reads `message.workspaceId` and passes it through context building,
  source lookup, `sourcesFromMessage` (pasted sheet links become sources in *this*
  workspace), and app creation.
- The agent never reads another workspace's channels, apps, or sources.

## UI

- **Workspace switcher** at the top of the sidebar: workspace name with a chevron. The menu lists
  my workspaces, "Create workspace", and "Invite people".
- **Invite dialog**: the invite link with a Copy button, the member list, and (owner only)
  "Reset link".
- Channel links, the stream URL, and API calls in client components take the slug from
  the route (`useParams`) instead of assuming one global workspace.
- `/new` and `/join` pages reuse the login page's split layout.

## Demo workspace

- Seeded on first boot with slug `demo`, `open: true`, and today's seed data
  (`#general`, `#marketing` conversation, `#ops`, sample sources).
- Any signed-in user who opens `/w/demo` is added as a member automatically.
- Maintainers are listed in `DEMO_OWNER_EMAILS` (comma list, env). They are owners of the demo;
  everyone else joins as a member. The demo has no invite link (it's open).
- Owners see "Reset demo" in the workspace menu: it deletes the demo's channels, messages, sources,
  and apps, then re-seeds the curated content. This keeps the shared demo clean after judges
  and visitors play in it.
- Existing production data: apps without `workspaceId` are treated as `demo`.
  Old top-level `channels` and `sources` docs are ignored; the demo is re-seeded under
  `workspaces/demo`. No migration script needed for the hackathon.

## Limits and safety

- Workspace name 1–40 chars; up to 10 workspaces created per user.
- Invite tokens are unguessable (`crypto.randomBytes(18)` base64url) and compared exactly.
- Roles: owner can rotate the invite (and, later, rename and remove members). Members can
  do everything else, including sharing the invite link and publishing apps.
- Firestore rules stay deny-all; all access goes through the server.
- `ALLOWED_EMAIL_DOMAINS` still gates sign-in globally.

## Out of scope (for now)

Email invites, removing members, transferring ownership, deleting workspaces,
per-channel permissions, billing.

## Acceptance

1. User A creates "Acme" and lands in `/w/acme-xxxx/c/general`.
2. A copies the invite link; user B opens it in another browser, signs in, and lands in Acme.
   Messages between A and B are realtime.
3. User C (not invited) gets a 404 for Acme's pages and APIs, including `/api/w/acme-xxxx/stream`
   and `/api/apps/<acme app id>`.
4. A resets the invite; the old link shows "This invite link is no longer valid".
5. A sheet connected in Acme isn't visible in Demo, and an Acme app can't read Demo sources
   through the data proxy.
6. `@tembak` in Acme builds an app that appears in Acme's app list only. Publishing still gives
   a public `/a/:slug` URL.
7. Any signed-in user can open `/w/demo` and use the seeded demo.
8. `pnpm typecheck`, `pnpm lint`, and `pnpm build` pass; the existing flows in `regress.mjs` pass on `/w/demo`.
