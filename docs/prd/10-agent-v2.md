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
- Respect free-tier limits: on a 429, wait once (about 5s) and retry, then fail with the friendly message.

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

- Built-in skills in `src/lib/agent/skills/` (markdown with frontmatter), for example:
  `kpi-dashboard`, `tracker` (CRUD list with kv), `signup-form`, `kanban`, `report` (printable),
  `linear-sprint-board`, `notion-content-calendar`.
- Workspace skills: members can add their own in Agent settings (name, description, body,
  up to 20 per workspace, 4k chars each). Stored at `workspaces/{wid}/skills/{id}`.
- Workspace skills with the same name override built-ins.

## 5. Data sources: Notion and Linear

Google Sheets stays as is. Add two kinds to `SourceConfig`, following the JSON source pattern
(server-side fetch, normalized rows, secrets never leave the server, `redact()` covers them).

### Notion

```ts
{ kind: "notion"; token: string; databaseId: string }
```

- The user creates an internal integration at notion.so/my-integrations, shares the database with it,
  and pastes the token plus the database URL (we parse the id from the URL).
- Fetch: `POST https://api.notion.com/v1/databases/{id}/query` (Notion-Version header), paginate up to 1,000 rows.
- Normalize properties to flat columns: title/rich_text → text, number, select/status → name,
  multi_select → comma list, date → ISO start, checkbox, people → names, url, email, formula/rollup → value.

### Linear

```ts
{ kind: "linear"; token: string; teamKey?: string; resource: "issues" | "projects" }
```

- The user creates a personal API key in Linear settings and pastes it; optional team key (e.g. `ENG`).
- Fetch: GraphQL `https://api.linear.app/graphql`, paginate up to 1,000 rows.
- Issue columns: `identifier, title, state, state_type, priority, assignee, team, project, cycle,
  labels, estimate, created_at, updated_at, completed_at, due_date, url`.
- Project columns: `name, state, progress, lead, target_date, start_date, url`.

### Secrets

- Tokens are encrypted at rest with AES-256-GCM using a key derived from `SESSION_SECRET` (HKDF),
  in `src/lib/crypto.ts`; existing JSON header values get the same treatment.
- Redacted to "••••••" in every API response. Never sent to Gemini or to generated apps.

### UI

The Add data dialog gets two new tabs, Notion and Linear, each with 3-step inline
instructions ("Create an integration → share the database → paste here") and a Test
connection button that shows column names and a row count before saving.

## Scope boundaries (parallel work)

PRD 09 is built at the same time. This module owns `src/lib/agent/**`, `src/lib/data/**`,
`src/lib/runtime.ts`, `src/lib/crypto.ts`, `src/components/data/data-dialog.tsx`, and the new
Agent settings dialog. It must not change `/new`, workspace seeding, chat empty states, or the
onboarding checklist. It adds one item ("Agent settings") to `workspace-menu.tsx`.

## Out of scope

Outgoing webhooks, BigQuery, Gmail/Calendar/Slack (per-user OAuth), MCP client,
diff-based revisions.

## Acceptance

1. Mock mode: `@tembak make a dashboard` still builds (scripted tool calls); all existing flows pass.
2. With Gemini: "@tembak which channel had the lowest cost per sign-up?" answers in chat from
   `query_source` without building an app.
3. With Gemini: a dashboard build uses the UI kit; generated HTML is under about 200 lines and renders
   correctly in the preview and at `/a/:slug`.
4. Agent rules ("use orange #ff5a1f as the accent") visibly change the next build.
5. A workspace skill is listed in the prompt index and loaded only when relevant (check the logs).
6. A Notion database and a Linear team connect, show columns and row counts, and a built app reads them
   through the data proxy. Tokens never appear in any API response, log line, or generated HTML.
7. A step-limit or 429 situation ends with a readable message, never a raw error.
8. `pnpm typecheck`, `pnpm lint`, and `pnpm build` pass.
