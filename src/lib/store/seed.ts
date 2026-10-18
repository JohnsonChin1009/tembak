import { SAMPLE_DATASETS } from "@/lib/data/samples";
import { GETTING_STARTED_CHANNEL } from "@/lib/onboarding";
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

/**
 * A new team workspace: #general with a welcome, #getting-started with a short
 * example conversation that sets up the first build, and one sample data source.
 */
export async function seedWorkspace(store: Store, workspaceId: string, createdBy: string): Promise<void> {
  const now = Date.now();
  await store.createChannel({
    id: "general",
    workspaceId,
    name: "general",
    topic: "Talk it through, then tag @tembak",
    createdAt: now - 2,
    createdBy,
  });
  await store.createChannel({
    id: GETTING_STARTED_CHANNEL,
    workspaceId,
    name: "getting-started",
    topic: "Your first build, step by step",
    createdAt: now - 1,
    createdBy,
  });

  await store.addMessage({
    id: `welcome-${workspaceId}`,
    workspaceId,
    channelId: "general",
    createdAt: now - 60_000,
    author: { kind: "agent" },
    text:
      "👋 Hi, I'm **Tembak**. Your team talks things through here, and when there's enough context, " +
      "tag **@tembak** and I'll build the tool you need: a dashboard, a tracker, a form. You can publish it to a link in one click.\n\n" +
      "Head to **#getting-started** for a one-minute first build. Tembak works best with your team, so bring them in:",
    mentionsAgent: false,
    status: "done",
    action: "invite",
  });

  const maya = { kind: "user" as const, uid: "example-maya", name: "Maya (example)" };
  const sam = { kind: "user" as const, uid: "example-sam", name: "Sam (example)" };
  const convo: Array<[typeof maya, string]> = [
    [maya, "Leadership keeps asking which ad channel gives us the cheapest sign-ups. Can we get that without another spreadsheet?"],
    [sam, "The weekly numbers are already connected as “Sample: Q4 campaign”. Cost per sign-up by channel plus a trend line would cover it."],
  ];
  let t = now - 50_000;
  for (const [author, text] of convo) {
    t += 10_000;
    await store.addMessage({
      id: `example-${workspaceId}-${t}`,
      workspaceId,
      channelId: GETTING_STARTED_CHANNEL,
      createdAt: t,
      author,
      text,
      mentionsAgent: false,
    });
  }

  await store.upsertSource({ ...sampleSource(workspaceId, "campaign", now), name: "Sample: Q4 campaign" });
}
