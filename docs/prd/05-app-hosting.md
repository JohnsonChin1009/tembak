# PRD 05: App hosting and publish

## Goal

One click turns a version into a live URL anyone can open, served from Google Cloud.

## Publish

- `POST /api/apps/:id/publish {version}` sets `publishedVersion` and returns `{url}`.
- `POST /api/apps/:id/unpublish` clears it (the URL returns a friendly 404 page).
- On first publish the agent posts in the channel: "🚀 **Title** is live at <url>".
- Slug: `kebab(title)-<4 random base36 chars>`, assigned at app creation and stable across versions.

## Serving `/a/:slug`

Route handler (not a page) returns the published version's HTML with:

- the runtime shim injected right after `<head>`
- `Content-Security-Policy: sandbox allow-scripts allow-forms allow-popups allow-modals allow-downloads`,
  which gives the document an opaque origin even at top level, so it can't use workspace cookies
- `Cache-Control: public, max-age=30`
- `X-Robots-Tag: noindex`

If `APPS_URL` has a different host from `APP_URL`, the proxy serves only `/a/*`,
`/api/public/*`, and `/_next/static` on the apps host (everything else 404s),
and the workspace host redirects `/a/*` to the apps host. With one domain
everything still works thanks to the CSP sandbox.

`GET /a/:slug?v=:n` is allowed for signed-in members only (to share drafts). This is a stretch goal.

## Runtime shim

Injected as an inline `<script>` that defines `window.tembak`:

```js
window.tembak = {
  appId, version,
  data: (key) => fetch(`${API}/api/public/data/${appId}/${key}`).then(r => r.ok ? r.json() : Promise.reject(...)),
}
```

`API` is the absolute `APPS_URL` (the iframe preview uses `srcdoc`, so relative URLs won't resolve).
The data endpoint responds with `Access-Control-Allow-Origin: *` and never uses cookies.
It only serves sources the app declared in `sourceKeys`.

## Acceptance

- Published URL renders in a fresh incognito window.
- `document.cookie` inside the app is empty, and `fetch('/api/apps')` from the app gets a 401.
- Unpublished or unknown slug returns a branded 404.
