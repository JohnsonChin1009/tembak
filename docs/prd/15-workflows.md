# PRD 15: Scheduled workflows

Depends on PRD 03/10 (agent harness, `startAgentRun`), PRD 06 (sources), PRD 08 (workspaces).

## Goal

Let a team ask Tembak to do something on a schedule, in plain words:

> @tembak can you help me create a workflow to summarize all tickets from Linear every Monday 0800 GMT+8?

Tembak saves a workflow, confirms the schedule and first run, and from then on posts the result in
the channel without anyone asking. A workflow is a **scheduled @tembak mention**: the same harness,
tools, and context as a live run, triggered by a clock instead of a person.

## Why a separate cron service

Cloud Run only runs while serving a request and scales to zero, so `setInterval` or `node-cron`
inside Next.js won't fire reliably. Cloud Scheduler pings `/api/cron/tick` every minute instead.

The main `tembak` service runs with `--no-cpu-throttling` (instance-based billing) because chat
starts agent runs with `after()`. Pinging it every minute would keep an instance alive around the
clock. So the tick goes to **`tembak-cron`**: the same image as a second, private service with
request-based billing (`--cpu-throttling`). The tick awaits its runs inside the request, so it
doesn't need always-on CPU, and an empty tick costs a fraction of a second.

```
Cloud Scheduler "tembak-tick" (every minute, OIDC + x-cron-secret)
        │
        ▼
Cloud Run "tembak-cron" (same image, private, billed per request)
   POST /api/cron/tick
   ├─ find due workflows (Firestore, nextRunAt <= now)
   ├─ claim each one (transaction moves nextRunAt forward)
   └─ startAgentRun(..., { scheduled: true }) → reply in the channel (live via SSE on "tembak")
```

## Data

Top-level `workflows/{id}` (like `apps`), so one single-field query finds due runs across all
workspaces without a composite index:

```ts
type Workflow = {
  id: string;
  workspaceId: string;
  channelId: string;
  prompt: string;            // the task for each run, 1-1,000 chars
  schedule: WorkflowSchedule;
  tz: string;                // IANA; "GMT+8" becomes "Etc/GMT-8"; default WORKFLOW_DEFAULT_TZ
  createdBy: string;         // uid; the workflow is removed if they leave the workspace
  createdByName: string;
  createdAt: number;
  nextRunAt: number;         // ms epoch
  failures: number;          // failed runs in a row
  lastRun?: { at: number; status: "done" | "error"; messageId: string };
};

type WorkflowSchedule =
  | { every: "hour" }
  | { every: "day" | "weekday"; at: string }               // "08:00"
  | { every: "week"; day: "mon" | ... | "sun"; at: string };
```

Presets instead of cron strings: Gemini fills them reliably, they read back plainly ("Every Monday
at 08:00 (GMT+8)"), and they rule out every-minute schedules. Schedule math lives in
`src/lib/workflows.ts` (`nextRun`, `normalizeTz`, `normalizeTime`, `describeSchedule`) and uses
`Intl` only, no date library.

Store: `listWorkflows`, `getWorkflow`, `upsertWorkflow`, `updateWorkflow`, `deleteWorkflow`,
`listDueWorkflows(now, limit)`, `claimWorkflow(id, expectedNextRunAt, next)`. Clearing or deleting a
workspace deletes its workflows.

## Agent tools

- `create_workflow { prompt, every, day?, at?, timezone? }`: saves a workflow for the current
  channel, created by whoever tagged Tembak. The agent checks `list_sources` first and asks people
  to connect missing data instead of saving a workflow that can't work.
- `list_workflows {}`: id, task, schedule, channel, creator, next and last run.
- `delete_workflow { id }`: "@tembak stop the Linear summary". To change one, delete and recreate.

The agent prompt now includes the current UTC time, so tasks like "last 7 days" resolve correctly.

## Tick endpoint

`POST /api/cron/tick`:

- Auth: `x-cron-secret` must equal `CRON_SECRET` (timing-safe compare). Outside production it
  defaults to `dev`; in production without the secret the endpoint is disabled. That's the case on
  the main service. `/api/cron/` is a public prefix in `src/proxy.ts`. The cron service is also
  private (`run.invoker` for the runtime service account only).
- Loads up to 5 due workflows and claims each one in a transaction. A lost claim is skipped, so
  overlapping ticks never double-run.
- Removes workflows whose channel is gone or whose creator left (`canUseWorkspaceApps`), with a note
  in the channel.
- Posts "⏰ Scheduled by Name: *task*", then runs `startAgentRun` with an unsaved trigger (the
  creator as author, the task as text), awaited.
- Records `lastRun`. After 3 failures in a row it removes the workflow and says so in the channel.
- Outside production, `?now=<ms>` runs as if it were that time (local testing, demos).
- Returns `{ ran, skipped, failed }`.

## Scheduled runs are read-only

`toolsFor(state)` gives a scheduled run only `list_sources`, `query_source`, `list_apps`, and
`load_skill`, and `runTool` refuses anything else. A schedule can't build or publish apps or create
more schedules. Its only output is the reply in the channel. The prompt tells the agent nobody is
waiting to answer questions.

## Limits

- 5 workflows per workspace.
- Hourly at most (the presets enforce it).
- Runs use `GEMINI_FAST_MODEL` like every agent turn.

## Setup

- `scripts/setup-gcp.sh` enables `cloudscheduler.googleapis.com` and creates the `CRON_SECRET` secret.
  Re-run it once on an existing project.
- `scripts/deploy.sh`, when `CRON_SECRET` exists: deploys `tembak-cron` from the main service's
  image, grants the runtime service account `run.invoker` on it, and creates or updates the
  `tembak-tick` Cloud Scheduler job.
- `scripts/cleanup-schedulers.sh` runs at the end of every deploy and deletes any other
  scheduler job that targets `/api/cron/tick` (all of them, `tembak-tick` included, when
  `CRON_SECRET` is gone). `--dry-run` lists without deleting.
- Deleting a channel deletes its workflows; resetting the demo or deleting a workspace deletes
  all of the workspace's workflows.
- Local: `curl -X POST -H "x-cron-secret: dev" "localhost:3000/api/cron/tick?now=<ms>"`. The mock
  agent creates a workflow when a message says "workflow", "schedule", or "remind" plus a time
  ("every monday 0800 GMT+8").

## Later

- Workflows section in workspace settings: list, pause, run now, last run.
- Write steps (`sheets.appendRow`, `linear.createIssue`) behind an explicit "Enable writes" by the creator.
- Event triggers ("when a row is added to the sheet").

## Acceptance

- "@tembak every weekday at 9am, post a one-line summary of sign-ups from the Q4 sheet" creates a
  workflow; the reply names the schedule and first run in the workflow's time zone.
- A tick at the due time posts the header and a finished reply, live over SSE; two concurrent ticks
  produce one run.
- A wrong or missing `x-cron-secret` returns 401.
- A scheduled run can't build or publish an app.
- "@tembak stop the sign-ups summary" deletes it.
- `pnpm typecheck` and `pnpm lint` pass.
