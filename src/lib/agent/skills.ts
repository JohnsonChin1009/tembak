import "server-only";
import { getStore } from "@/lib/store";
import type { Skill } from "@/lib/types";

// Built-in recipes. The agent sees only "name: description" for each skill and
// loads the body on demand (load_skill), or passes the name to build_app so the
// builder gets the full recipe. Workspace skills with the same name override these.

export type SkillDef = Pick<Skill, "name" | "description" | "body">;

export const BUILTIN_SKILLS: SkillDef[] = [
  {
    name: "kpi-dashboard",
    description: "Metrics dashboard: KPI tiles, a trend, a breakdown, and a detail table",
    body: `Layout: header (title, one-line description, a category filter via ui.select, an "Export CSV" button via ui.download), then ui.kpis with 3-4 tiles, then a .tk-cols-3 row with a line chart (span 2) and an hbar breakdown, then a .tk-card with ui.table.
Metrics: put the number the team asked about first. Ratios (cost per X = spend / X) are computed from sums, never averaged per row. Use format "currency" for money and "percent" for 0..1 ratios.
Trend: ui.chart type "line", x = the date column, bucket "week" if there are more than ~45 distinct dates, series = the main category only if it has <= 6 values.
Filter: re-render everything from the filtered rows on change.
Share to channel: add a "Share to channel" button in the header that tembak.post()s a 2-3 line summary of what's on screen (the filter in use and the headline KPIs).`,
  },
  {
    name: "tracker",
    description: "Shared list people add to and update (tasks, requests, incidents) saved with kv",
    body: `Use const items = ui.collection("items") for persistence (shared by everyone who opens the app).
Layout: header with counts per status as ui.kpis, a ui.form to add an item (wide title field, a status select, an owner field of type "member", a date if relevant), then a ui.segmented status filter and a ui.table.
Created by: save created_by = (await tembak.me()).name on each new item. Add a "Mine" filter (owner or created_by equals me().name).
Table: columns with render functions for a status badge (.tk-badge), the owner via ui.avatar(null, { name: owner }, { name: true }), and row actions (a small .tk-btn-ghost "Done"/"Delete" calling items.update / items.remove, then re-render).
Seed: if the collection is empty on first load and the conversation mentions concrete items, add them once so the tracker isn't empty.`,
  },
  {
    name: "signup-form",
    description: "Public form that collects responses (RSVPs, volunteers, requests) plus a responses view",
    body: `Use const responses = ui.collection("responses").
Layout: ui.tabs with "Sign up" (a centered .tk-card max-width 560px with ui.form; after submit show a thank-you message and a "Submit another" button) and "Responses" (ui.kpis with total and per-option counts, then ui.table with an Export CSV action via ui.download).
Validate required fields with the form's required flags. Never ask for passwords or payment details.`,
  },
  {
    name: "kanban",
    description: "Board with columns (To do, Doing, Done) and cards people move, saved with kv",
    body: `Use const cards = ui.collection("cards"); each card has title, column, owner, due, created_by.
Layout: header with an add-card ui.form (title, column select, owner field of type "member"; save created_by = (await tembak.me()).name), then a CSS grid of columns (.tk-cols-3 or repeat(n, minmax(220px,1fr)) with horizontal scroll on mobile). Each column is a .tk-card listing cards; each card shows title, the owner with a small ui.avatar, due date and "←"/"→" .tk-btn-ghost buttons to move it (cards.update then re-render). Show the count per column in the column title.`,
  },
  {
    name: "report",
    description: "Printable one-page summary with headline numbers and a short narrative",
    body: `Layout: a single .tk-page with max-width 820px. Header with title, date range, and a "Print" button (window.print()). ui.kpis for 3-4 headline numbers, then 2 small charts, then a "Highlights" list written from the data (top movers, best/worst category), then a compact table.
Add @media print CSS: hide buttons, remove card shadows, avoid page breaks inside cards.
Share to channel: add a "Share to channel" button next to Print that tembak.post()s a 2-3 line summary (date range, the headline numbers, the top highlight).`,
  },
  {
    name: "linear-sprint-board",
    description: "Engineering view of Linear issues: progress by state, assignee load, and what's late",
    body: `Data from a Linear issues source: identifier, title, state, state_type (backlog, unstarted, started, completed, canceled), priority (0 none, 1 urgent .. 4 low), priority_label, assignee, team, project, cycle, labels, estimate, created_at, completed_at, due_date, url.
KPIs: open issues (state_type not completed/canceled), completed in the last 14 days, overdue (due_date < today and open), urgent+high open.
Charts: hbar of open issues by assignee; bar of issues by state (ordered backlog, unstarted, started, completed); line of completed per week (x completed_at, bucket "week", agg "count").
Table: open issues sorted by priority then due_date; render identifier as a link to url (target _blank).
Filters: team and cycle via ui.select.`,
  },
  {
    name: "notion-content-calendar",
    description: "Calendar and pipeline for a Notion content database (posts, campaigns, launches)",
    body: `Data from a Notion source: a title column, usually a status/select column, a date column, owners (people, comma separated), tags (multi-select, comma separated), and notion_url.
Views via ui.tabs: "This month" (a 7-column CSS grid month calendar placing titles on their date; days outside the month muted), "Pipeline" (columns per status listing titles), "All" (ui.table, title rendered as a link to notion_url).
KPIs: scheduled this week, in progress, published this month.`,
  },
];

/** Built-ins merged with the workspace's own skills (same name overrides). */
export async function workspaceSkills(workspaceId: string): Promise<SkillDef[]> {
  const own = await (await getStore()).listSkills(workspaceId);
  const names = new Set(own.map((s) => s.name));
  return [...own, ...BUILTIN_SKILLS.filter((s) => !names.has(s.name))].sort((a, b) => a.name.localeCompare(b.name));
}

export function skillIndex(skills: SkillDef[]): string {
  return skills.map((s) => `- ${s.name}: ${s.description}`).join("\n");
}
