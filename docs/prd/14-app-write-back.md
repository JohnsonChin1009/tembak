# PRD 14: Write-back actions (Linear, Notion, Google Sheets)

Depends on PRD 11 (`requireRuntimeCaller`, app token, rate limiter).

## Goal

Reading data helps a team decide; writing it back lets them act. Apps can create and update records in
the tools the workspace already connected: triage an issue in an app and it lands in Linear, approve a
request and the row in the Sheet updates.

## API

```js
await tembak.action(name, input)   // resolves to the action's result
```

`POST /api/runtime/[appId]/action` `{ name, input }`, auth via `requireRuntimeCaller`. A fixed allowlist
of actions, each with a zod input schema, in `src/lib/actions/` (one file per provider plus an index):

| Action | Input | Result |
|---|---|---|
| `linear.createIssue` | `teamKey, title, description?, priority? (0-4), assigneeEmail?, labelNames?` | `{ id, identifier, url }` |
| `linear.updateIssue` | `id, stateName?, priority?, assigneeEmail?, title?` | `{ id, identifier, url }` |
| `linear.comment` | `issueId, body` | `{ id }` |
| `notion.createPage` | `dataSourceId, properties` (name → plain value) | `{ id, url }` |
| `notion.updatePage` | `pageId, properties` | `{ id, url }` |
| `sheets.appendRow` | `sourceKey, row` (column → value) | `{ updatedRange }` |
| `sheets.updateRow` | `sourceKey, match: { column, value }, set` | `{ updated: number }` |

Rules:

- **Scope to what the app may touch.** Sheets/Notion actions only target sources in the app's
  `sourceKeys` (or a Notion data source of one of those sources); Linear actions only teams of the
  connected organization. Anything else is 403.
- Each action writes an audit record `workspaces/{wid}/actions/{id}`:
  `{ appId, uid, name, input (truncated 2 KB), ok, error?, at }` (add to the `Store` interface, both
  memory and Firestore implementations).
- After a successful write, invalidate any cached rows for that source so `tembak.data` sees the change.
- Rate limit: 30 actions per member per 10 minutes.
- Errors from providers come back as friendly messages ("Linear says the team XYZ doesn't exist").
- Mock mode / no connection: return 409 "Connect Linear first" (or the relevant provider), so apps show a
  clear message rather than silently failing.

## Provider changes

- **Linear**: OAuth scope is `read` today (`src/lib/connectors/linear.ts`). Change to `read,write`.
  Existing connections keep read-only tokens: detect the permission error and return
  "Reconnect Linear to allow Tembak to make changes". Personal API keys already allow writes.
- **Notion**: uses the same token; the integration needs "Insert content" and "Update content"
  capabilities (note this in `docs/DEPLOY.md`). Map plain values to Notion property payloads by
  reading the data source's property types (title, rich_text, number, select, multi_select, status,
  date, checkbox, people by email is out of scope).
- **Google Sheets**: reading uses the `spreadsheets.readonly` scope (`src/lib/data/fetch.ts`). Writes need
  the `spreadsheets` scope and the service account must have **editor** access on the sheet. When it
  doesn't, return "Share this sheet with <service account email> as an editor so apps can update it".
  Public-CSV-only sheets can't be written to.

## Builder prompt and skills

- Document `tembak.action` and the action table in `RUNTIME_DOC` (only the actions for providers that
  are connected in this workspace, to save tokens; pass that list into `buildPrompt`/`revisePrompt`).
  Every write sits behind an explicit button, shows a pending state, and reports success/failure.
- Update `linear-sprint-board` to add a quick "New issue" form and a state change per row, and
  `tracker` to optionally sync to a sheet with `sheets.appendRow` when its source is a sheet.

## Acceptance

- With Linear connected (API key is fine for testing), an app in the builder preview creates an issue
  and it shows up in Linear with the returned URL.
- An app can't write to a sheet that isn't in its `sourceKeys` (403).
- Every action, successful or not, leaves an audit record.
- Without a valid app token (e.g. a removed member) `/action` returns 401/403 and nothing is written.
- `pnpm typecheck` and `pnpm lint` pass.
