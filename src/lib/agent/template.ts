import type { Row } from "@/lib/types";

/**
 * A generic, good-looking dashboard that adapts to any tabular data.
 * Used by the mock agent and as the fallback when Gemini fails, so the
 * demo always produces something real.
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
  }).replace(/</g, "\\u003c");

  return `<!doctype html>
<!-- tembak:summary: ${esc(input.summary)} -->
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(input.title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
<script src="https://cdn.tailwindcss.com"></script>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
<style>
  body { font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
  :root { --accent: ${input.accent}; }
  .accent-bg { background: var(--accent); }
  .accent-text { color: var(--accent); }
  th[data-col] { cursor: pointer; user-select: none; }
</style>
</head>
<body class="min-h-screen bg-[#fafaf9] text-slate-800">
  <div class="mx-auto max-w-6xl px-4 py-8 sm:px-6">
    <header class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <div class="flex items-center gap-2">
          <span class="inline-block h-2.5 w-2.5 rounded-full accent-bg"></span>
          <h1 class="text-2xl font-semibold tracking-tight text-slate-900">${esc(input.title)}</h1>
          <span id="sample-badge" class="hidden rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">Sample data</span>
        </div>
        <p class="mt-1 text-sm text-slate-500">${esc(input.description)}</p>
      </div>
      <div class="flex items-center gap-2">
        <label for="filter" class="text-sm text-slate-500" id="filter-label">Filter</label>
        <select id="filter" class="rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-300"></select>
      </div>
    </header>
    ${input.note ? `<p class="mt-4 rounded-lg border border-stone-200 bg-white px-4 py-2 text-sm text-slate-600">${esc(input.note)}</p>` : ""}

    <div id="state" class="mt-10 text-center text-sm text-slate-500">Loading data…</div>

    <main id="content" class="hidden">
      <section id="kpis" class="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4"></section>
      <section class="mt-6 grid gap-4 lg:grid-cols-5">
        <div class="rounded-xl border border-stone-200 bg-white p-5 shadow-sm lg:col-span-3">
          <h2 id="trend-title" class="text-sm font-medium text-slate-600"></h2>
          <div class="mt-4 h-72"><canvas id="trend"></canvas></div>
        </div>
        <div class="rounded-xl border border-stone-200 bg-white p-5 shadow-sm lg:col-span-2">
          <h2 id="bar-title" class="text-sm font-medium text-slate-600"></h2>
          <div class="mt-4 h-72"><canvas id="bars"></canvas></div>
        </div>
      </section>
      <section class="mt-6 overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
        <div class="flex items-center justify-between border-b border-stone-200 px-5 py-3">
          <h2 class="text-sm font-medium text-slate-600">Details</h2>
          <input id="search" placeholder="Search…" class="w-40 rounded-md border border-stone-200 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 sm:w-56" />
        </div>
        <div class="max-h-[420px] overflow-auto">
          <table class="w-full text-sm">
            <thead id="thead" class="sticky top-0 bg-stone-50 text-left text-xs uppercase tracking-wide text-slate-500"></thead>
            <tbody id="tbody" class="divide-y divide-stone-100"></tbody>
          </table>
        </div>
      </section>
      <p class="mt-6 text-center text-xs text-slate-400">Built with Tembak</p>
    </main>
  </div>

<script>
const CFG = ${cfg};
const nf = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });
const money = new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const money2 = new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const label = (k) => k.replace(/_/g, " ").replace(/\\b\\w/g, (c) => c.toUpperCase());
const isMoney = (k) => /spend|cost|revenue|amount|price|budget|sales/i.test(k);
const fmt = (k, v) => typeof v === "number" ? (isMoney(k) ? money.format(v) : nf.format(v)) : (v ?? "—");
const PALETTE = [CFG.accent, "#64748b", "#a8a29e", "#0ea5e9", "#f59e0b", "#10b981", "#ec4899"];
let rows = [], filtered = [], sortCol = null, sortDir = -1, charts = [];

async function load() {
  if (CFG.sourceKey) {
    if (!window.tembak) throw new Error("Data runtime unavailable");
    return await window.tembak.data(CFG.sourceKey);
  }
  document.getElementById("sample-badge").classList.remove("hidden");
  return CFG.sample;
}

function analyze(data) {
  const cols = Object.keys(data[0] || {});
  const numeric = cols.filter((c) => data.every((r) => r[c] == null || typeof r[c] === "number"));
  const dateCol = cols.find((c) => /date|week|day|month|created|time/i.test(c) && !numeric.includes(c))
    || cols.find((c) => data.every((r) => typeof r[c] === "string" && /^\\d{4}-\\d{2}(-\\d{2})?/.test(r[c])));
  const catCol = cols.find((c) => c !== dateCol && !numeric.includes(c) && new Set(data.map((r) => r[c])).size <= 12);
  const metrics = numeric.filter((c) => !/id$|^id|year/i.test(c));
  return { cols, numeric, dateCol, catCol, metrics };
}

function sum(data, c) { return data.reduce((a, r) => a + (typeof r[c] === "number" ? r[c] : 0), 0); }
const AVG_RE = /hour|rate|ratio|score|csat|nps|avg|average|percent|pct|time|days|age|rating/i;
// Totals for counts and money; averages for durations, scores, and rates.
function agg(data, c) {
  if (!AVG_RE.test(c)) return sum(data, c);
  const vals = data.map((r) => r[c]).filter((v) => typeof v === "number");
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
}
const aggLabel = (c) => (AVG_RE.test(c) ? "Avg " + label(c).toLowerCase() : label(c));

function pick(metrics, patterns) {
  for (const p of patterns) { const hit = metrics.find((c) => p.test(c)); if (hit) return hit; }
  return null;
}
const CONV = [/signup|sign_up/i, /conversion/i, /lead/i, /order/i, /won|deal/i, /revenue|sales|amount/i];

function renderKpis(meta) {
  const el = document.getElementById("kpis");
  const m = meta.metrics;
  const spend = pick(m, [/spend|cost/i]);
  const conv = pick(m, CONV);
  const tiles = [];
  if (spend && conv && spend !== conv) {
    const s = sum(filtered, spend), v = sum(filtered, conv);
    tiles.push([label(spend), fmt(spend, s)], [label(conv), fmt(conv, v)],
      ["Cost per " + label(conv).replace(/s$/i, "").toLowerCase(), v ? money2.format(s / v) : "—"]);
    const other = m.find((c) => c !== spend && c !== conv);
    if (other) tiles.push([aggLabel(other), fmt(other, agg(filtered, other))]);
  } else {
    for (const c of m.slice(0, 4)) tiles.push([aggLabel(c), fmt(c, agg(filtered, c))]);
  }
  if (tiles.length < 4) tiles.unshift(["Records", nf.format(filtered.length)]);
  el.innerHTML = tiles.slice(0, 4).map(([k, v], i) => \`
    <div class="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
      <p class="text-xs font-medium uppercase tracking-wide text-slate-500">\${k}</p>
      <p class="mt-2 text-2xl font-semibold tracking-tight \${i === 0 ? "accent-text" : "text-slate-900"}">\${v}</p>
    </div>\`).join("");
}

function renderCharts(meta) {
  charts.forEach((c) => c.destroy());
  charts = [];
  Chart.defaults.font.family = "Inter, ui-sans-serif, system-ui";
  Chart.defaults.color = "#64748b";
  const metric = pick(meta.metrics, [...CONV, /click/i]) || meta.metrics[0];
  const second = pick(meta.metrics, [/spend|cost/i]) || metric;
  if (!metric) return;

  if (meta.dateCol) {
    const dates = [...new Set(filtered.map((r) => r[meta.dateCol]))].sort();
    const groups = meta.catCol ? [...new Set(filtered.map((r) => r[meta.catCol]))] : [null];
    const datasets = groups.slice(0, 7).map((g, i) => ({
      label: g ?? label(metric),
      data: dates.map((d) => agg(filtered.filter((r) => r[meta.dateCol] === d && (g == null || r[meta.catCol] === g)), metric)),
      borderColor: PALETTE[i % PALETTE.length], backgroundColor: PALETTE[i % PALETTE.length] + "22",
      tension: 0.35, borderWidth: i === 0 ? 2.5 : 1.5, pointRadius: 0, fill: groups.length === 1,
    }));
    document.getElementById("trend-title").textContent = aggLabel(metric) + " over time" + (meta.catCol ? " by " + label(meta.catCol).toLowerCase() : "");
    charts.push(new Chart(document.getElementById("trend"), {
      type: "line", data: { labels: dates, datasets },
      options: { responsive: true, maintainAspectRatio: false, interaction: { mode: "index", intersect: false },
        plugins: { legend: { display: datasets.length > 1, position: "bottom", labels: { boxWidth: 10, usePointStyle: true } } },
        scales: { x: { grid: { display: false } }, y: { grid: { color: "#f1f5f9" }, ticks: { callback: (v) => nf.format(v) } } } },
    }));
  } else {
    document.getElementById("trend-title").textContent = label(metric);
  }

  const cat = meta.catCol;
  if (cat) {
    const cats = [...new Set(filtered.map((r) => r[cat]))];
    const ratio = second !== metric;
    const values = cats.map((c) => {
      const sub = filtered.filter((r) => r[cat] === c);
      return ratio ? (sum(sub, metric) ? sum(sub, second) / sum(sub, metric) : 0) : agg(sub, metric);
    });
    const order = cats.map((c, i) => [c, values[i]]).sort((a, b) => b[1] - a[1]);
    document.getElementById("bar-title").textContent = ratio
      ? label(second) + " per " + label(metric).replace(/s$/i, "").toLowerCase() + " by " + label(cat).toLowerCase()
      : aggLabel(metric) + " by " + label(cat).toLowerCase();
    charts.push(new Chart(document.getElementById("bars"), {
      type: "bar",
      data: { labels: order.map((o) => o[0]), datasets: [{ data: order.map((o) => o[1]), backgroundColor: order.map((_, i) => i === 0 ? CFG.accent : "#cbd5e1"), borderRadius: 6 }] },
      options: { indexAxis: "y", responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false },
        tooltip: { callbacks: { label: (c) => ratio ? money2.format(c.raw) : nf.format(c.raw) } } },
        scales: { x: { grid: { color: "#f1f5f9" }, ticks: { callback: (v) => ratio ? money.format(v) : nf.format(v) } }, y: { grid: { display: false } } } },
    }));
  }
}

function renderTable(meta) {
  const q = document.getElementById("search").value.toLowerCase();
  let data = filtered.filter((r) => !q || Object.values(r).some((v) => String(v).toLowerCase().includes(q)));
  if (sortCol) data = [...data].sort((a, b) => (a[sortCol] > b[sortCol] ? 1 : a[sortCol] < b[sortCol] ? -1 : 0) * sortDir);
  document.getElementById("thead").innerHTML = "<tr>" + meta.cols.map((c) =>
    \`<th data-col="\${c}" class="px-4 py-2.5 font-medium \${meta.numeric.includes(c) ? "text-right" : ""}">\${label(c)}\${sortCol === c ? (sortDir > 0 ? " ↑" : " ↓") : ""}</th>\`).join("") + "</tr>";
  document.getElementById("tbody").innerHTML = data.slice(0, 500).map((r) => "<tr class=\\"hover:bg-stone-50\\">" + meta.cols.map((c) =>
    \`<td class="whitespace-nowrap px-4 py-2 \${meta.numeric.includes(c) ? "text-right tabular-nums" : ""}">\${fmt(c, r[c])}</td>\`).join("") + "</tr>").join("")
    || \`<tr><td class="px-4 py-8 text-center text-slate-400" colspan="\${meta.cols.length}">No matching rows</td></tr>\`;
  document.querySelectorAll("th[data-col]").forEach((th) => th.onclick = () => {
    const c = th.dataset.col; sortDir = sortCol === c ? -sortDir : -1; sortCol = c; renderTable(meta);
  });
}

(async function main() {
  const state = document.getElementById("state");
  try {
    rows = await load();
    if (!rows.length) { state.textContent = "No data yet."; return; }
    const meta = analyze(rows);
    const sel = document.getElementById("filter");
    if (meta.catCol) {
      document.getElementById("filter-label").textContent = label(meta.catCol);
      sel.innerHTML = "<option value=\\"\\">All</option>" + [...new Set(rows.map((r) => r[meta.catCol]))].map((v) => \`<option>\${v}</option>\`).join("");
    } else { sel.style.display = "none"; document.getElementById("filter-label").style.display = "none"; }
    const apply = () => {
      filtered = sel.value ? rows.filter((r) => String(r[meta.catCol]) === sel.value) : rows;
      renderKpis(meta); renderCharts(meta); renderTable(meta);
    };
    sel.onchange = apply;
    document.getElementById("search").oninput = () => renderTable(meta);
    state.remove();
    document.getElementById("content").classList.remove("hidden");
    apply();
  } catch (e) {
    state.innerHTML = '<span class="text-rose-600">Couldn\\'t load data: ' + (e && e.message ? e.message : e) + "</span>";
  }
})();
</script>
</body>
</html>`;
}
