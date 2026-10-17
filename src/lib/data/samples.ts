import type { Row } from "@/lib/types";

// Deterministic PRNG so sample data is stable across restarts and instances.
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function weekLabel(start: Date, i: number) {
  const d = new Date(start.getTime() + i * 7 * 86400000);
  return d.toISOString().slice(0, 10);
}

function campaign(): Row[] {
  const rnd = mulberry32(42);
  const channels = [
    { channel: "Google Ads", base: 4200, cpc: 1.8, cvr: 0.06 },
    { channel: "Meta", base: 3600, cpc: 1.1, cvr: 0.04 },
    { channel: "TikTok", base: 2100, cpc: 0.7, cvr: 0.025 },
    { channel: "LinkedIn", base: 2800, cpc: 4.2, cvr: 0.09 },
    { channel: "Email", base: 400, cpc: 0.15, cvr: 0.11 },
  ];
  const start = new Date("2026-08-03T00:00:00Z");
  const rows: Row[] = [];
  for (let w = 0; w < 10; w++) {
    for (const c of channels) {
      const ramp = 1 + w * 0.06;
      const spend = Math.round(c.base * ramp * (0.85 + rnd() * 0.3));
      const clicks = Math.round((spend / c.cpc) * (0.9 + rnd() * 0.2));
      const impressions = Math.round(clicks * (28 + rnd() * 30));
      const signups = Math.round(clicks * c.cvr * (0.8 + rnd() * 0.4));
      rows.push({
        week: weekLabel(start, w),
        channel: c.channel,
        spend,
        impressions,
        clicks,
        signups,
      });
    }
  }
  return rows;
}

function sales(): Row[] {
  const rnd = mulberry32(7);
  const reps = ["Aisyah", "Ben", "Chen Wei", "Divya", "Elliot"];
  const stages = ["Prospect", "Qualified", "Proposal", "Negotiation", "Won", "Lost"];
  const companies = [
    "Kopi Labs", "Batik & Co", "Nusantara Freight", "Petaling Digital", "Rimba Foods",
    "Selat Health", "Tanjung Energy", "Ubin Studios", "Vista Retail", "Warisan Bank",
    "Xinyi Motors", "Yarra Analytics", "Zenith Travel", "Awan Cloud", "Bukit Builders",
    "Cendana Media", "Delima Pharma", "Embun Water", "Fajar Logistics", "Gemilang Edu",
  ];
  return companies.map((company, i) => ({
    deal: `D-${1040 + i}`,
    company,
    owner: reps[Math.floor(rnd() * reps.length)],
    stage: stages[Math.floor(rnd() * stages.length)],
    amount: Math.round((5 + rnd() * 95) * 1000),
    close_date: `2026-${String(10 + Math.floor(rnd() * 3)).padStart(2, "0")}-${String(1 + Math.floor(rnd() * 28)).padStart(2, "0")}`,
  }));
}

function support(): Row[] {
  const rnd = mulberry32(99);
  const cats = ["Billing", "Login", "Bug", "Feature request", "Onboarding"];
  const pris = ["Low", "Medium", "High", "Urgent"];
  const statuses = ["Open", "Pending", "Solved"];
  const rows: Row[] = [];
  for (let i = 0; i < 60; i++) {
    const day = 1 + Math.floor(rnd() * 17);
    rows.push({
      ticket: `T-${8800 + i}`,
      created: `2026-10-${String(day).padStart(2, "0")}`,
      category: cats[Math.floor(rnd() * cats.length)],
      priority: pris[Math.floor(rnd() ** 1.6 * pris.length)],
      status: statuses[Math.floor(rnd() * statuses.length)],
      first_response_hours: Math.round(rnd() * 30 * 10) / 10,
      csat: rnd() > 0.3 ? 1 + Math.floor(rnd() * 5) : null,
    });
  }
  return rows;
}

export const SAMPLE_DATASETS: Record<string, { name: string; rows: () => Row[] }> = {
  campaign: { name: "Q4 campaign performance (weekly, by channel)", rows: campaign },
  sales: { name: "Sales pipeline", rows: sales },
  support: { name: "Support tickets (October)", rows: support },
};
