import { SAMPLE_DATASETS } from "@/lib/data/samples";
import type { Channel, Message, Source, Workspace } from "@/lib/types";
import { DEMO_WORKSPACE_ID, type Store } from "./types";

const SEED_UID_A = "seed-aisyah";
const SEED_UID_B = "seed-ben";

function sampleSource(workspaceId: string, key: string, now: number): Source {
  const ds = SAMPLE_DATASETS[key];
  const rows = ds.rows();
  return {
    id: `${workspaceId}-sample-${key}`,
    workspaceId,
    key,
    name: ds.name,
    kind: "sample",
    config: { kind: "sample", dataset: key },
    columns: Object.keys(rows[0] ?? {}),
    sample: rows.slice(0, 3),
    rowCount: rows.length,
    updatedAt: now,
    createdBy: "system",
  };
}

/** Creates the open Demo workspace on first boot and fills it if it's empty. */
export async function seed(store: Store): Promise<void> {
  if (!(await store.getWorkspace(DEMO_WORKSPACE_ID))) {
    const demo: Workspace = {
      id: DEMO_WORKSPACE_ID,
      slug: DEMO_WORKSPACE_ID,
      name: "Demo",
      createdAt: Date.now(),
      createdBy: "system",
      // Open workspaces don't use invite links, but the field is required.
      inviteToken: `demo-${crypto.randomUUID()}`,
      open: true,
    };
    await store.createWorkspace(demo);
  }
  if ((await store.listChannels(DEMO_WORKSPACE_ID)).length === 0) await seedDemoContent(store);
  const adopted = await store.adoptLegacyApps(DEMO_WORKSPACE_ID);
  if (adopted) console.log(`[store] moved ${adopted} pre-workspace apps into the demo`);
}

/** The curated demo: channels, a conversation that sets up the dashboard request, and sample data. */
export async function seedDemoContent(store: Store): Promise<void> {
  const workspaceId = DEMO_WORKSPACE_ID;
  const now = Date.now();
  const channels: Channel[] = [
    { id: "general", workspaceId, name: "general", topic: "Company-wide chatter", createdAt: now - 9e6, createdBy: "system" },
    { id: "marketing", workspaceId, name: "marketing", topic: "Q4 campaign: spend, sign-ups, creative", createdAt: now - 8e6, createdBy: "system" },
    { id: "ops", workspaceId, name: "ops", topic: "Support, sales ops, and everything in between", createdAt: now - 7e6, createdBy: "system" },
  ];
  for (const c of channels) await store.createChannel(c);

  const aisyah = { kind: "user" as const, uid: SEED_UID_A, name: "Aisyah" };
  const ben = { kind: "user" as const, uid: SEED_UID_B, name: "Ben" };
  const convo: Array<[typeof aisyah, string, string]> = [
    [aisyah, "general", "Morning all ☕ reminder that the all-hands moved to Thursday 10am."],
    [ben, "general", "Thanks! Tip: tag @tembak in any channel when you need a quick tool built."],
    [aisyah, "marketing", "How's the Q4 campaign tracking? Leadership wants numbers by Friday."],
    [ben, "marketing", "Spend is up about 6% week over week. Google Ads and LinkedIn are carrying sign-ups, TikTok is cheap but doesn't convert much."],
    [aisyah, "marketing", "Is all of that in the campaign sheet? Spend, clicks, sign-ups per channel per week?"],
    [ben, "marketing", "Yep, weekly by channel since early August. Honestly I just need cost per sign-up by channel and a trend line, I'm tired of pivot tables."],
    [aisyah, "marketing", "Same. Would be great to have something we can just open on Friday instead of a 40-tab spreadsheet."],
    [ben, "ops", "Support queue is spiking on login issues again, about 30% of tickets this week."],
  ];
  let t = now - 3.6e6;
  for (const [author, channelId, text] of convo) {
    t += 60_000 + Math.floor(Math.random() * 120_000);
    const msg: Message = {
      id: `seed-${channelId}-${t}`,
      workspaceId,
      channelId,
      createdAt: t,
      author,
      text,
      mentionsAgent: /@tembak\b/i.test(text),
    };
    await store.addMessage(msg);
  }

  for (const key of Object.keys(SAMPLE_DATASETS)) {
    await store.upsertSource(sampleSource(workspaceId, key, now));
  }
}

/** A new team workspace starts with #general only. */
export async function seedWorkspace(store: Store, workspaceId: string, createdBy: string): Promise<Channel> {
  const general: Channel = {
    id: "general",
    workspaceId,
    name: "general",
    topic: "Talk it through, then tag @tembak",
    createdAt: Date.now(),
    createdBy,
  };
  await store.createChannel(general);
  return general;
}
