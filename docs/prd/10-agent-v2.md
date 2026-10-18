# PRD 10: Agent v2 (tools, UI kit, rules, skills, Notion and Linear)

## Goal

Turn `@tembak` from a fixed two-call pipeline into a tool-using agent that can
look at real data, answer questions in chat, and build better apps with fewer
tokens. Add Notion and Linear as data sources alongside Google Sheets.

Budget: about 5 hours. Runs in parallel with PRD 09.

## 1. Agent loop

Replace triage then produce in `src/lib/agent/run.ts` with a Gemini function-calling loop
(`@google/genai`, `tools: [{ functionDeclarations }]`), in the same Cloud Run service.

```
mention → system prompt (+ workspace rules, + skill index) + recent transcript
loop up to MAX_STEPS = 6:
  model returns text → post it as the final reply, stop
  model returns function calls → run them, update the status line, append results, continue
step limit hit → post what we have plus "I stopped early, ask me to continue"
```

### Tools

| Tool | Args | Does |
|---|---|---|
| `list_sources` | — | Names, keys, kinds, columns, row counts in this workspace |
| `query_source` | `key, columns?, filter?, limit<=50` | Returns rows (server-side fetch, normalized). Lets the agent answer data questions in chat and check data before building |
| `list_apps` | — | Apps in this channel with title, versions, published state |
| `load_skill` | `name` | Returns the full skill text (section 4) |
| `build_app` | `title, brief, sourceKeys[], skill?` | Generates a new app (existing HTML generation call, now with the UI kit). Returns app id and version |
| `revise_app` | `appId, instructions` | New version of an existing app |
| `publish_app` | `appId` | Publishes the latest version (only when the user explicitly asks) |

Rules for the loop:

- Status line updates per tool: "Looking at Q4 campaign…", "Building Q4 Dashboard…".
- Each tool result sent back to the model is capped (rows truncated, about 4k tokens max).
- `build_app` and `revise_app` keep the existing template fallback on failure.
- Mock mode keeps working: a scripted sequence (list_sources, then build_app) so local dev and tests stay free.
- The final message keeps today's shape (`text`, `appRef`), so the chat UI doesn't change.
- Keep the agent behind one entry point (`runAgent(trigger)`), with tools in `src/lib/agent/tools/`, so it
  can later move to its own service or to ADK / Vertex AI Agent Engine without a rewrite.

### Models

- Loop decisions: `GEMINI_FAST_MODEL` (default `gemini-3.5-flash-lite`).
- HTML generation inside `build_app` and `revise_app`: `GEMINI_MODEL` (default `gemini-3.5-flash-lite`).
- Respect free-tier limits: on a 429 or a 503 ("high demand"), wait once (about 5s) and retry, then fail with a friendly message.

## 2. UI kit in the runtime (the big token saver)

Extend the injected `window.tembak` runtime (`src/lib/runtime.ts`) with a small UI library, plus
a base stylesheet with design tokens, so generated apps call components instead of writing them:

```js
tembak.ui.theme({ accent })                        // CSS variables, light and dark
tembak.ui.kpis(el, [{ label, value, delta?, format? }])
tembak.ui.chart(el, { type: "line"|"bar"|"donut", data, x, y, series? })   // inline SVG, no CDN
tembak.ui.table(el, rows, { columns?, sortable?, search?, pageSize? })
tembak.ui.form(el, { fields, onSubmit })           // with kv persistence helper
tembak.ui.tabs(el, [{ label, render }])
tembak.ui.format.number|currency|percent|date
```

- No external CDN dependencies (works offline, faster, nothing to break).
- The build prompt documents this API in about 40 lines and tells the model to prefer it.
  The target is generated HTML under about 150 lines for a typical dashboard (today it's often 400 or more).
- Revisions send the current HTML and ask for the full updated file (patching is a stretch goal).
- The existing template fallback is rewritten to use the kit (it doubles as the kit's test page).

## 3. Workspace rules

- `Workspace.agentRules?: string` (up to 2,000 chars), e.g. "Brand color #ff5a1f. Always add CSV export. Casual tone."
- Edited in a new **Agent settings** dialog (workspace menu, then "Agent settings"); any member can edit.
- Injected into the system prompt for every run in that workspace, under "Team rules".
- API: `GET/PATCH /api/w/[ws]/agent` with `{ rules }`.

## 4. Skills

A skill is a named recipe: `{ name, description, body }`. The system prompt only lists
`name: description` for each skill; the model calls `load_skill(name)` when one fits,
so the full text costs tokens only when used.

- Built-in skills in `src/lib/agent/skills.ts` (kept in code so they ship in the standalone build), for example:
  `kpi-dashboard`, `tracker` (CRUD list with kv), `signup-form`, `kanban`, `report` (printable),
  `linear-sprint-board`, `notion-content-calendar`.
- Workspace skills: members can add their own in Agent settings (name, description, body,
  up to 20 per workspace, 4k chars each). Stored at `workspaces/{wid}/skills/{id}`.
- Workspace skills with the same name override built-ins.

## 5. Data sources: Notion and Linear

Google Sheets stays as is. Notion and Linear connect like Claude's connectors: a
**Connect Notion** / **Connect Linear** button runs OAuth, then a picker chooses
what to read. Pasting an API key stays as a fallback ("Use an API key instead"),
and is the only option when OAuth isn't configured (local dev, or before the
OAuth apps exist).

### Connections (per workspace)

`workspaces/{wid}/connections/{provider}`:

```ts
Connection {
  workspaceId, provider: "notion" | "linear", authType: "oauth" | "api_key",
  accessToken,            // AES-256-GCM sealed (lib/crypto.ts, key = HKDF(SESSION_SECRET))
  refreshToken?, expiresAt?,  // Linear tokens last 24h and are refreshed automatically;
                              // Notion returns a refresh token too and is refreshed on 401
  accountName?, accountId?,   // Notion workspace or Linear organization, for display
  connectedBy, connectedAt
}
```

Sources reference the connection instead of holding a token:

```ts
{ kind: "notion"; dataSourceId: string; title?: string }
{ kind: "linear"; resource: "issues" | "projects"; teamKey?: string }
```

In the open Demo workspace only maintainers can connect, disconnect, or change agent settings.

### OAuth flow

- `GET /api/w/[ws]/connect/[provider]?channel=…` signs a `state` (HMAC, key derived from
  `SESSION_SECRET`) over `{workspace, user, provider, nonce, expiry 10 min, channel}`, sets the
  nonce in a short-lived httpOnly cookie (`Path=/api/oauth`), and redirects to the provider.
- `GET /api/oauth/[provider]/callback` checks, in order: signed in (else `/login?next=…`), valid
  unexpired state for this provider, nonce cookie matches, same user, still a member (and allowed
  to configure). Only then is the code exchanged server side and the connection stored. It then
  redirects to `/w/[slug]/c/[channel]?connected=notion` (or `?connect_error=denied|failed|not_configured`),
  and the Data dialog reopens on that provider.
- `POST /api/w/[ws]/connections/[provider]` `{ apiKey }` is the fallback: the key is verified with the
  provider before it's stored. `DELETE` disconnects. `GET /api/w/[ws]/connections` lists both providers
  with `oauth: boolean` and the connection (never tokens).
- `GET /api/w/[ws]/connections/[provider]/targets` feeds the picker: Notion data sources shared with the
  integration (`POST /v1/search`, filter `data_source`), or Linear teams.
- `POST /api/w/[ws]/sources/test` fetches a config without saving ("Test connection").

### Notion

- API version `2025-09-03` (databases hold one or more "data sources"; rows are queried per data source):
  `POST /v1/data_sources/{id}/query`, paginated, up to 1,000 rows.
- Authorize: `https://api.notion.com/v1/oauth/authorize?client_id&response_type=code&owner=user&redirect_uri&state`.
  Token: `POST /v1/oauth/token` with HTTP Basic `client_id:client_secret`, JSON body.
- Properties flatten to columns (title first): title/rich_text → text, number, select/status → name,
  multi_select/people/files → comma list, date → start, checkbox, url, email, phone, formula/rollup → value,
  relation → count, unique_id → `PREFIX-42`; plus `created` and `notion_url`.

### Linear

- Authorize: `https://linear.app/oauth/authorize?client_id&redirect_uri&response_type=code&scope=read&state`.
  Token: `POST https://api.linear.app/oauth/token`, form encoded. OAuth tokens are sent as `Bearer`,
  personal API keys bare.
- GraphQL, paginated, up to 1,000 rows. Issue columns: `identifier, title, state, state_type, priority,
  priority_label, assignee, team, project, cycle, labels, estimate, created_at, updated_at, completed_at,
  due_date, url`. Project columns: `name, state, progress (%), lead, start_date, target_date, url`.

### Config

`NOTION_OAUTH_CLIENT_ID`, `NOTION_OAUTH_CLIENT_SECRET`, `LINEAR_OAUTH_CLIENT_ID`,
`LINEAR_OAUTH_CLIENT_SECRET` (all optional; `"unset"` counts as absent). Client IDs go in
`deploy.env`; secrets go to Secret Manager through `setup-gcp.sh`. Setup steps for both
providers are in `docs/DEPLOY.md` ("Connectors").

### Secrets

- Connector tokens and JSON-source header values are sealed at rest with AES-256-GCM.
- Redacted in every API response, never logged, never sent to Gemini or to generated apps.

### UI

The Add data dialog has five tabs: Sheet, Notion, Linear, CSV, JSON. Notion and Linear show
Connect (or the key form), then the picker (searchable Notion database list; Linear issues or
projects plus a team filter), and a Test connection button that previews columns and a row count
before saving.

## Scope boundaries (parallel work)

PRD 09 is built at the same time. This module owns `src/lib/agent/**`, `src/lib/data/**`,
`src/lib/runtime.ts`, `src/lib/crypto.ts`, `src/components/data/data-dialog.tsx`, and the new
Agent settings dialog. It must not change `/new`, workspace seeding, chat empty states, or the
onboarding checklist. It adds one item ("Agent settings") to `workspace-menu.tsx`.

## Out of scope

Outgoing webhooks, BigQuery, Gmail/Calendar/Slack, MCP client, diff-based revisions,
per-user (rather than per-workspace) connector credentials.

## Acceptance

1. Mock mode: `@tembak make a dashboard` still builds (scripted tool calls); all existing flows pass.
2. With Gemini: "@tembak which channel had the lowest cost per sign-up?" answers in chat from
   `query_source` without building an app.
3. With Gemini: a dashboard build uses the UI kit; generated HTML is under about 200 lines and renders
   correctly in the preview and at `/a/:slug`.
4. Agent rules ("use orange #ff5a1f as the accent") visibly change the next build.
5. A workspace skill is listed in the prompt index and loaded only when relevant (check the logs).
6. Notion and Linear connect with OAuth (or an API key), the picker lists databases or teams, Test
   connection shows columns and row counts, and a built app reads them through the data proxy. Tokens
   never appear in any API response, log line, or generated HTML. The OAuth callback rejects tampered,
   expired, replayed, cross-user, and non-member states.
7. A step-limit or 429 situation ends with a readable message, never a raw error.
8. `pnpm typecheck`, `pnpm lint`, and `pnpm build` pass.
