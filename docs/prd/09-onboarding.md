# PRD 09: Onboarding

## Goal

A first-time user understands what Tembak does and sees it build something
within about two minutes of signing in, without reading docs. The aha moment is
watching `@tembak` turn a conversation into a live app, so onboarding exists to
get people there fast.

Budget: about 2 to 3 hours. Builds on PRD 08 (workspaces).

## Principles

- **Do, don't tell.** One guided build beats a five-step tour.
- **Skippable everywhere.** Nothing blocks someone who already knows what they want.
- **Real product, real data.** The guided build uses a sample sheet and the real agent.

## Flow

### 1. `/new` (first sign-in, no workspaces)

- Heading: "Name your workspace". One focused field, placeholder "Acme Marketing", and a Create button.
- Under it, three short lines with icons that explain the product in one glance:
  "Chat with your team in channels" · "Tag @tembak to build an app from the conversation" ·
  "Publish it to a live link".
- Secondary: "Or explore the demo workspace →" (`/w/demo`).

### 2. New workspace seed

A new workspace starts with:

- `#general`, with one welcome message from Tembak: what it is, and how to invite people
  (with an "Invite people" button that opens the invite dialog).
- `#getting-started`, the guided channel (below). New workspaces land here, not in `#general`.
- One sample data source, **"Sample: Q4 campaign"** (the existing `campaign` sample dataset), so
  the first build has real-looking data.

### 3. `#getting-started` guided build

The channel opens with a short seeded conversation, two messages from "Tembak (example)"
written as if from teammates, that sets up a need, e.g. tracking campaign cost per sign-up.

Above the composer: a **suggestion chip** "@tembak make us a dashboard from the sample campaign data".
Clicking it fills the composer (it doesn't send). The user presses Enter.

While the agent works, a small **checklist card** pinned at the top of the channel shows progress:

1. Ask @tembak to build something ✓ (when the mention is sent)
2. Open the preview ✓ (when the builder panel opens)
3. Ask for a change ✓ (when a revision is requested)
4. Publish it ✓ (when the app is published)
5. Invite a teammate ✓ (when someone joins, or when the invite link is copied)

Each item has a one-line hint. The checklist collapses to "4 of 5 done" and can be
dismissed. Progress is stored per member (`Member.onboarding`), so teammates get
their own checklist.

### 4. Contextual hints (first time only)

Each shows once per member, dismissible, positioned next to the thing it explains:

- Builder panel first open: "This is a live preview. Ask for changes below, or switch to Code."
- Publish button before first publish: "Publishing gives anyone a link. You can unpublish anytime."
- Data section first open: "Connect a Google Sheet, Notion database, or Linear team, then ask @tembak to use it."

### 5. Empty states

Every empty screen says what it is and what to do next, with one action:

| Where | Copy | Action |
|---|---|---|
| Channel with no messages | "This is the start of #name. Describe what you need, then tag @tembak." | Suggestion chip |
| Apps list empty | "Apps built in this workspace show up here." | — |
| Data section empty | "Connect data so Tembak builds with your real numbers." | "Add data source" |
| Invite dialog, only member | "It's just you so far. Tembak works best with your team." | Copy link |

### 6. Joining by invite

After `/join/[token]`, the new member lands in `#general` with a one-time banner:
"You joined **Acme**. Here's what your team has built so far →" (opens the apps list),
plus the same checklist, minus "Invite a teammate".

## Data

```ts
Member.onboarding?: {
  dismissed?: boolean
  steps: { mention?: number; preview?: number; revise?: number; publish?: number; invite?: number }  // timestamps
  hints: string[]   // ids of hints already shown
}
```

`PATCH /api/w/[ws]/me/onboarding` with `{step?: string, hint?: string, dismissed?: boolean}`.
Steps are recorded client-side when the user does the thing (simple and good enough).

## Scope boundaries (parallel work)

PRD 10 is built at the same time. This module owns `/new`, workspace seeding,
the checklist, hints, empty states, and the join banner. It must not change
`src/lib/agent/**`, `src/lib/data/**`, `src/lib/runtime.ts`, or `src/components/data/data-dialog.tsx`.

## Acceptance

1. A brand-new user signs in, creates a workspace, and lands in `#getting-started` with the seeded
   conversation, the suggestion chip, and the checklist.
2. Clicking the chip and pressing Enter builds an app from the sample data (mock agent locally);
   checklist items 1 and 2 tick automatically.
3. Requesting a change and publishing tick items 3 and 4. Copying the invite link ticks 5.
4. Dismissing the checklist keeps it dismissed after reload; a second member has their own checklist.
5. Each contextual hint appears once and never again after dismissal.
6. Every empty state in the table renders with its copy and action.
7. A user joining by invite sees the join banner once.
8. The Demo workspace is unchanged (no checklist, no getting-started channel).
9. `pnpm typecheck`, `pnpm lint`, and `pnpm build` pass; desktop and 390px mobile have no horizontal scroll.

## Implementation notes

- The guided channel's example teammates are "Maya (example)" and "Sam (example)" rather than
  "Tembak (example)", so it reads as a real team conversation that is clearly a sample.
- The checklist shows in every channel of a team workspace until dismissed: expanded in
  `#getting-started`, collapsed elsewhere (so people who join by invite see it in `#general`).
- Hints show in every workspace, including the demo; the checklist and join banner don't.
  Hints are sequenced so only one is on screen at a time: builder, then publish, then data.
- "Invite a teammate" also counts as done once anyone else is a member.
- The data empty state reuses the section's existing "Connect a sheet or API" button as its action.
- Progress writes use a field-level merge (`steps.<id>`, `arrayUnion` for hints), so concurrent
  updates from two tabs don't overwrite each other. Other members never see your progress
  (it's stripped from `GET /api/w/[ws]`).
