# PRD 04: Builder panel

## Goal

The "AI Studio" moment: a right-hand panel that shows the app running, right
next to the conversation that produced it.

## Behavior

- Opens when a user clicks **Open** on an app card, or automatically for the
  user who triggered a build when it completes.
- URL reflects state: `/c/:channelId?app=:appId&v=:n` (shareable, survives reload).
- Header: app title, version switcher (v1...vN, newest default), status pill (Draft or Published),
  buttons: **Publish** / **Update live** (when viewing a newer version than the live one), **Copy link**, **Open**, close.
- Tabs: **Preview** (default) | **Code** (read-only, monospace, line numbers, copy button).
- Device toggle: desktop (fill) | mobile (390px frame).
- Preview: `<iframe sandbox="allow-scripts allow-forms allow-popups allow-modals" srcdoc=...>`.
  `allow-same-origin` is never set. The runtime shim (PRD 05) is injected so
  `tembak.data()` works in preview against the same data proxy.
- Footer: "Request changes" input. It posts to the channel as the user with `@tembak` and `appRef`,
  so the revision is visible to the team.
- While a revision for this app is building, show a progress overlay with the agent's status line.
- Resizable split (drag handle) between the chat and the panel. Width is remembered in localStorage.
- Below 1024px wide the panel becomes a full-screen sheet.

## API

| Method | Path | Result |
|---|---|---|
| GET | `/api/apps` | `App[]` (sidebar "Apps" section) |
| GET | `/api/apps/:id` | `App` plus version list (number, createdAt, summary) |
| GET | `/api/apps/:id/versions/:n` | `{html, ...meta}` |

```ts
App { id, slug, title, channelId, createdBy, createdAt, updatedAt,
      latestVersion: number, publishedVersion?: number, sourceKeys: string[] }
AppVersion { n, html, summary, prompt, createdAt, createdBy, model }
```

## Acceptance

- Clicking an app card opens the preview in under 300ms (HTML is fetched once and cached per version).
- Switching versions swaps the iframe without a page reload.
- Generated code can't read `document.cookie` of the workspace or call `/api/*` with credentials (opaque origin).
