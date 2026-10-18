# PRD 13: AI inside apps (`tembak.ask`)

Depends on PRD 11 (`requireRuntimeCaller`, app token, rate limiter).

## Goal

Let disposable apps do work, not just display it: categorize 200 feedback rows, summarize this week's
tickets, draft a reply, pull fields out of pasted text. One small, cheap, rate-limited model call
behind the runtime.

## API

```js
await tembak.ask(prompt, { data?, json?: boolean, schema? })
// -> string, or a parsed object/array when json is true
```

- `POST /api/runtime/[appId]/ask` `{ prompt, data?, json?, schema? }`, auth via `requireRuntimeCaller`.
- Model: `config().gemini.fastModel` (stays `gemini-3.5-flash-lite`, cost matters). Reuse the Gemini
  client in `src/lib/agent/gemini.ts`; add a plain `generate` helper there if one doesn't exist.
- `json: true` sets `responseMimeType: "application/json"` (plus `responseSchema` when `schema` is given)
  and the route returns parsed JSON; on parse failure return 502 with "The AI reply wasn't valid JSON".
- Limits: prompt up to 4,000 chars; `data` serialized up to 60 KB (reject larger with a message telling
  the app to send fewer rows); output capped at ~2,000 tokens; 30 s timeout.
- Rate limit: 20 calls per member per 10 minutes, 200 per workspace per day (in-memory is fine for now).
- Mock mode (`config().agentMode !== "gemini"`): return a deterministic canned answer
  (`"(mock) " + first 80 chars of prompt`, or `[]`/`{}` for json) so local dev costs nothing.
- System instruction: short and fixed; the model answers only from the given data, plain language,
  no HTML. Workspace agent rules (`agentRules`) are appended.
- Log one line per call: app id, member uid, prompt length, data bytes, latency. Never log the data.

## Builder prompt and UI kit

- Document `tembak.ask` in `RUNTIME_DOC` with guidance: only behind an explicit button ("Summarize",
  "Categorize"), show `ui.loading` while waiting, cache results in `ui.collection` or `kv` so reopening
  doesn't re-spend.
- New built-in skill `ai-triage`: paste or load rows, a "Categorize with AI" button that calls
  `tembak.ask(..., { json: true })` in batches of ~50 rows, results saved with `ui.collection`, then a
  breakdown chart and table.

## Acceptance

- In the builder preview, an `ai-triage` app built from a feedback sheet categorizes rows and saves them;
  reopening shows saved results without new calls.
- Without a valid app token (e.g. a removed member) `/ask` returns 401/403 before any model call.
- Oversized data and rate-limit hits return friendly errors the app shows via `ui.error`.
- `pnpm typecheck` and `pnpm lint` pass.
