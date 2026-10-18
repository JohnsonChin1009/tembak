import type { Row } from "@/lib/types";

/**
 * A generic dashboard that adapts to any tabular data, built on the tembak.ui kit.
 * Used by the mock agent and as the fallback when Gemini fails, so the demo always
 * produces something real. It doubles as the kit's reference page.
 */
export function dashboardTemplate(input: {
  title: string;
  description: string;
  summary: string;
  accent: string;
  sourceKey: string | null;
  sampleRows: Row[];
  note?: string;
}): string {
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
  const cfg = JSON.stringify({
    sourceKey: input.sourceKey,
    sample: input.sourceKey ? [] : input.sampleRows,
    accent: input.accent,
    title: input.title,
  }).replace(/</g, "\\u003c");

  return `<!doctype html>
<!-- tembak:summary: ${esc(input.summary)} -->
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(input.title)}</title>
</head>
<body class="tk">
<div class="tk-page">
  <header class="tk-header">
    <div>
      <div class="tk-row"><h1 class="tk-title">${esc(input.title)}</h1><span id="sample" class="tk-badge" hidden>Sample data</span></div>
      <p class="tk-sub">${esc(input.description)}</p>
    </div>
    <div class="tk-row"><div id="filter"></div><button id="export" class="tk-btn">Export CSV</button></div>
  </header>
  ${input.note ? `<p class="tk-card tk-muted" style="margin-bottom:16px">${esc(input.note)}</p>` : ""}
  <div id="state"></div>
  <main id="content" class="tk-stack" hidden>
    <section id="kpis"></section>
    <section class="tk-cols-3">
      <div class="tk-card tk-span-2"><h2 class="tk-card-title" id="trend-title"></h2><div id="trend"></div></div>
      <div class="tk-card"><h2 class="tk-card-title" id="bar-title"></h2><div id="bars"></div></div>
    </section>
    <section class="tk-card"><h2 class="tk-card-title">Details</h2><div id="table"></div></section>
  </main>
  <p class="tk-foot">Built with Tembak</p>
</div>
<script>
const CFG = ${cfg};
const ui = tembak.ui;
ui.theme({ accent: CFG.accent });
const label = ui.format.label;
const AVG_RE = /hour|rate|ratio|score|csat|nps|avg|average|percent|pct|time|days|age|rating|progress/i;
const op = (c) => (AVG_RE.test(c) ? "avg" : "sum");
const aggLabel = (c) => (AVG_RE.test(c) ? "Avg " + label(c).toLowerCase() : label(c));
const CONV = [/signup|sign_up/i, /conversion/i, /lead/i, /order/i, /won|deal/i, /revenue|sales|amount/i, /estimate|points/i];
const pick = (cols, patterns) => { for (const p of patterns) { const hit = cols.find((c) => p.test(c)); if (hit) return hit; } return null; };

function analyze(rows) {
  const cols = Object.keys(rows[0] || {});
  const numeric = cols.filter((c) => rows.every((r) => r[c] == null || typeof r[c] === "number"));
  const dateCol = cols.find((c) => /date|week|day|month|created|time|_at$/i.test(c) && !numeric.includes(c) && rows.some((r) => r[c]))
    || cols.find((c) => rows.every((r) => typeof r[c] === "string" && /^\\d{4}-\\d{2}(-\\d{2})?/.test(r[c])));
  const catCol = cols.find((c) => c !== dateCol && !numeric.includes(c) && new Set(rows.map((r) => r[c])).size <= 12 && new Set(rows.map((r) => r[c])).size > 1);
  const metrics = numeric.filter((c) => !/id$|^id|year|^number$/i.test(c));
  return { cols, dateCol, catCol, metrics };
}

function render(rows, meta) {
  const m = meta.metrics;
  const spend = pick(m, [/spend|cost/i]);
  const conv = pick(m, CONV);
  const tiles = [];
  if (spend && conv && spend !== conv) {
    const s = ui.sum(rows, spend), v = ui.sum(rows, conv);
    tiles.push({ label: label(spend), value: s, format: "currency" }, { label: label(conv), value: v },
      { label: "Cost per " + label(conv).replace(/s$/i, "").toLowerCase(), value: v ? s / v : null, format: "currency" });
    const other = m.find((c) => c !== spend && c !== conv);
    if (other) tiles.push({ label: aggLabel(other), value: op(other) === "avg" ? ui.avg(rows, other) : ui.sum(rows, other), format: (v) => ui.format.auto(other, v) });
  } else {
    for (const c of m.slice(0, 3)) tiles.push({ label: aggLabel(c), value: op(c) === "avg" ? ui.avg(rows, c) : ui.sum(rows, c), format: (v) => ui.format.auto(c, v) });
  }
  if (tiles.length < 4) tiles.unshift({ label: "Records", value: rows.length, format: "number" });
  ui.kpis("#kpis", tiles.slice(0, 4));

  const metric = pick(m, [...CONV, /click/i]) || m[0];
  const fmt = (v) => ui.format.auto(metric || "", v);
  if (meta.dateCol) {
    const many = new Set(rows.map((r) => r[meta.dateCol])).size > 45;
    document.getElementById("trend-title").textContent = (metric ? aggLabel(metric) : "Records") + " over time" + (meta.catCol ? " by " + label(meta.catCol).toLowerCase() : "");
    ui.chart("#trend", { type: "line", data: rows, x: meta.dateCol, y: metric, agg: metric ? op(metric) : "count", series: meta.catCol, bucket: many ? "week" : undefined, format: fmt, height: 280 });
  } else {
    document.getElementById("trend-title").textContent = (metric ? aggLabel(metric) : "Records") + (meta.catCol ? " by " + label(meta.catCol).toLowerCase() : "");
    ui.chart("#trend", { type: "bar", data: rows, x: meta.catCol || meta.cols[0], y: metric, agg: metric ? op(metric) : "count", format: fmt, height: 280 });
  }

  const cat = meta.catCol;
  if (cat) {
    const ratio = spend && metric && spend !== metric;
    const grouped = ui.group(rows, cat, [metric, spend].filter(Boolean), "sum").map((g) => ({ ...g, value: ratio ? (g[metric] ? g[spend] / g[metric] : 0) : (metric ? g[metric] : g.count) }));
    document.getElementById("bar-title").textContent = ratio
      ? label(spend) + " per " + label(metric).replace(/s$/i, "").toLowerCase() + " by " + label(cat).toLowerCase()
      : (metric ? aggLabel(metric) : "Records") + " by " + label(cat).toLowerCase();
    ui.chart("#bars", { type: "hbar", data: grouped, x: cat, y: "value", format: ratio ? "currency" : fmt });
  } else {
    document.getElementById("bar-title").textContent = "Records";
    ui.kpis("#bars", [{ label: "Rows", value: rows.length, format: "number" }]);
  }
  ui.table("#table", rows, { pageSize: 25 });
}

(async function main() {
  const state = document.getElementById("state");
  ui.loading(state, "Loading data…");
  try {
    let rows;
    if (CFG.sourceKey) rows = await tembak.data(CFG.sourceKey);
    else { rows = CFG.sample; document.getElementById("sample").hidden = false; }
    if (!rows.length) return ui.empty(state, "No data yet.");
    const meta = analyze(rows);
    state.remove();
    document.getElementById("content").hidden = false;
    const apply = (value) => render(value ? rows.filter((r) => String(r[meta.catCol]) === value) : rows, meta);
    if (meta.catCol) ui.select("#filter", { label: label(meta.catCol), all: true, options: ui.uniq(rows, meta.catCol), onChange: apply });
    document.getElementById("export").onclick = () => ui.download(CFG.title.toLowerCase().replace(/[^a-z0-9]+/g, "-") + ".csv", rows);
    apply("");
  } catch (e) {
    ui.error(state, e);
  }
})();
</script>
</body>
</html>`;
}
