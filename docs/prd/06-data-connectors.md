# PRD 06: Data connectors

## Goal

Let generated apps show the team's real data without anyone touching code or
OAuth screens. Hackathon-scope, but it works.

## Source kinds

| Kind | Config | How it's fetched |
|---|---|---|
| `sheet` | Google Sheets URL, optional tab/range | 1) Sheets API v4 with the Cloud Run service account (ADC, `spreadsheets.readonly` scope); the user shares the sheet with the service account email shown in the UI. 2) Fallback: CSV export URL for "anyone with the link" sheets |
| `csv` | Pasted CSV text or uploaded file (up to 1MB) | Stored in the source doc |
| `json` | URL, optional header name and secret value | Server `fetch`; the secret is stored server-side and never sent to the client or the model |
| `sample` | Built-in sample datasets (`campaign`, `sales`, `support`) | Static; seeded so the demo works offline |

```ts
Source { id, key /* slug, unique, used in tembak.data(key) */, name, kind, config,
         columns?: string[], sample?: Row[], updatedAt, createdBy }
```

Rows are normalized to `Array<Record<string, string | number | null>>`.
Numeric-looking strings become numbers. The header row becomes keys. JSON
responses are used as-is if they are an array, else the first array property.

## UI

A sidebar "Data" section lists sources. **+ Add data** opens a modal with tabs
(Google Sheet | CSV | JSON API). On save the server test-fetches, stores
`columns` and 3 sample rows, and shows a preview table. The Sheet tab shows
"Share your sheet with `tembak@<project>.iam.gserviceaccount.com` (Viewer)" with a copy button.

Agents can also reference sources mentioned in chat: if a user pastes a Sheets
URL in a message that mentions `@tembak`, the agent run auto-creates a `sheet`
source (when fetchable) before triage.

## API

| Method | Path | Notes |
|---|---|---|
| GET | `/api/sources` | Secrets redacted |
| POST | `/api/sources` | Create plus test fetch |
| DELETE | `/api/sources/:id` | |
| GET | `/api/public/data/:appId/:key` | CORS `*`, 60s in-memory cache, max 5,000 rows |

## Acceptance

- The `campaign` sample source exists on first boot, and the mock build uses it.
- Adding a public Google Sheet URL produces columns and a preview.
- A JSON source's secret never appears in any API response, prompt, or generated HTML.
