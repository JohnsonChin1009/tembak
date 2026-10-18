// tembak.ui: a tiny component kit injected into every generated app (see runtime.ts).
// Generated apps call these instead of hand-writing CSS, charts, and tables, which
// cuts output tokens and keeps apps consistent. No network dependencies: charts are
// inline SVG, so it works in the sandboxed preview and under the published CSP.
//
// The JS below is shipped as a string. Keep it ES2017 and free of template literals
// (no backticks or dollar-brace) so it can live inside this TypeScript template.

export const UI_KIT_CSS = `
.tk{--tk-accent:#4f46e5;--tk-bg:#fafaf9;--tk-card:#fff;--tk-border:#e7e5e4;--tk-text:#1c1917;--tk-muted:#78716c;--tk-faint:#a8a29e;--tk-good:#15803d;--tk-bad:#dc2626;--tk-radius:14px;margin:0;background:var(--tk-bg);color:var(--tk-text);font:14px/1.5 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;-webkit-font-smoothing:antialiased}
.tk.tk-dark{--tk-bg:#0c0a09;--tk-card:#1c1917;--tk-border:#2e2a27;--tk-text:#f5f5f4;--tk-muted:#a8a29e;--tk-faint:#78716c}
.tk *,.tk *::before,.tk *::after{box-sizing:border-box}
.tk [hidden]{display:none!important}
.tk h1,.tk h2,.tk h3,.tk p{margin:0}
.tk-page{max-width:1180px;margin:0 auto;padding:28px 20px 56px}
.tk-header{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:16px;margin-bottom:20px}
.tk-title{font-size:24px;font-weight:650;letter-spacing:-.02em;line-height:1.2}
.tk-sub{color:var(--tk-muted);margin-top:4px}
.tk-stack{display:flex;flex-direction:column;gap:16px}
.tk-row{display:flex;flex-wrap:wrap;align-items:center;gap:10px}
.tk-grid{display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(min(100%,var(--tk-min,320px)),1fr))}
.tk-cols-2,.tk-cols-3{display:grid;gap:16px;grid-template-columns:repeat(2,minmax(0,1fr))}
.tk-cols-3{grid-template-columns:repeat(3,minmax(0,1fr))}
.tk-span-2{grid-column:span 2}
@media (max-width:760px){.tk-cols-2,.tk-cols-3{grid-template-columns:minmax(0,1fr)}.tk-span-2{grid-column:auto}}
.tk-card{background:var(--tk-card);border:1px solid var(--tk-border);border-radius:var(--tk-radius);padding:18px;min-width:0;box-shadow:0 1px 2px rgba(0,0,0,.03)}
.tk-card-title{font-size:13px;font-weight:600;color:var(--tk-muted);margin-bottom:12px}
.tk-muted{color:var(--tk-muted)}
.tk-badge{display:inline-flex;align-items:center;gap:4px;border-radius:999px;padding:2px 9px;font-size:12px;font-weight:500;background:color-mix(in srgb,var(--tk-accent) 12%,transparent);color:var(--tk-accent)}
.tk-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:36px;padding:0 14px;border-radius:10px;border:1px solid var(--tk-border);background:var(--tk-card);color:var(--tk-text);font:inherit;font-weight:550;cursor:pointer;transition:filter .15s,background .15s}
.tk-btn:hover{filter:brightness(.97)}
.tk-btn:disabled{opacity:.55;cursor:default}
.tk-btn-primary{background:var(--tk-accent);border-color:transparent;color:#fff}
.tk-btn-ghost{background:transparent;border-color:transparent;color:var(--tk-muted)}
.tk-input,.tk-select,.tk-textarea{height:36px;width:100%;padding:0 10px;border-radius:10px;border:1px solid var(--tk-border);background:var(--tk-card);color:var(--tk-text);font:inherit;outline:none}
.tk-textarea{height:auto;min-height:84px;padding:8px 10px;resize:vertical}
.tk-input:focus,.tk-select:focus,.tk-textarea:focus{border-color:var(--tk-accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--tk-accent) 18%,transparent)}
.tk-field{display:flex;flex-direction:column;gap:5px;font-size:13px;font-weight:500;color:var(--tk-muted)}
.tk-check{display:flex;align-items:center;gap:8px;font-size:14px;color:var(--tk-text)}
.tk-form{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(min(100%,200px),1fr));align-items:end}
.tk-form .tk-wide{grid-column:1/-1}
.tk-inline{display:inline-flex;align-items:center;gap:8px;font-size:13px;color:var(--tk-muted)}
.tk-inline .tk-select{width:auto;min-width:140px}
.tk-seg{display:inline-flex;padding:3px;border-radius:10px;background:color-mix(in srgb,var(--tk-text) 6%,transparent)}
.tk-seg button{border:0;background:transparent;color:var(--tk-muted);font:inherit;font-size:13px;font-weight:550;padding:5px 12px;border-radius:8px;cursor:pointer}
.tk-seg button[aria-pressed=true]{background:var(--tk-card);color:var(--tk-text);box-shadow:0 1px 2px rgba(0,0,0,.08)}
.tk-kpis{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(min(100%,150px),1fr))}
.tk-kpi{background:var(--tk-card);border:1px solid var(--tk-border);border-radius:var(--tk-radius);padding:16px}
.tk-kpi-label{font-size:12px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--tk-muted)}
.tk-kpi-value{margin-top:6px;font-size:26px;font-weight:650;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.tk-kpi:first-child .tk-kpi-value{color:var(--tk-accent)}
.tk-kpi-foot{margin-top:4px;font-size:12px;color:var(--tk-muted)}
.tk-up{color:var(--tk-good)}.tk-down{color:var(--tk-bad)}
.tk-chart{position:relative;width:100%}
.tk-chart svg{display:block;width:100%;overflow:visible}
.tk-chart text{fill:var(--tk-muted);font-size:11px;font-family:inherit}
.tk-legend{display:flex;flex-wrap:wrap;gap:6px 14px;margin-top:10px;font-size:12px;color:var(--tk-muted)}
.tk-legend span{display:inline-flex;align-items:center;gap:6px}
.tk-legend i{width:9px;height:9px;border-radius:3px;display:inline-block}
.tk-tip{position:absolute;pointer-events:none;z-index:5;min-width:120px;padding:8px 10px;border-radius:10px;background:var(--tk-text);color:var(--tk-bg);font-size:12px;line-height:1.45;box-shadow:0 6px 20px rgba(0,0,0,.18);opacity:0;transition:opacity .1s;white-space:nowrap}
.tk-tip b{font-weight:600}
.tk-table-tools{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}
.tk-table-tools .tk-input{max-width:240px}
.tk-table-wrap{overflow:auto;border:1px solid var(--tk-border);border-radius:12px;max-height:var(--tk-table-h,520px)}
table.tk-table{width:100%;border-collapse:collapse;font-size:13px}
.tk-table th{position:sticky;top:0;background:color-mix(in srgb,var(--tk-card) 92%,var(--tk-text));text-align:left;font-weight:600;font-size:12px;color:var(--tk-muted);padding:9px 12px;white-space:nowrap;border-bottom:1px solid var(--tk-border);user-select:none}
.tk-table th[data-sort]{cursor:pointer}
.tk-table td{padding:9px 12px;border-bottom:1px solid var(--tk-border);white-space:nowrap;max-width:420px;overflow:hidden;text-overflow:ellipsis}
.tk-table tr:last-child td{border-bottom:0}
.tk-table tbody tr:hover{background:color-mix(in srgb,var(--tk-accent) 5%,transparent)}
.tk-table tr.tk-click{cursor:pointer}
.tk-num{text-align:right!important;font-variant-numeric:tabular-nums}
.tk-tabs{display:flex;gap:4px;border-bottom:1px solid var(--tk-border);margin-bottom:16px;overflow-x:auto}
.tk-tab{border:0;background:none;font:inherit;font-weight:550;color:var(--tk-muted);padding:9px 12px;border-bottom:2px solid transparent;margin-bottom:-1px;cursor:pointer;white-space:nowrap}
.tk-tab[aria-selected=true]{color:var(--tk-text);border-color:var(--tk-accent)}
.tk-state{padding:44px 16px;text-align:center;color:var(--tk-muted)}
.tk-state.tk-error{color:var(--tk-bad)}
.tk-spin{display:inline-block;width:16px;height:16px;border:2px solid var(--tk-border);border-top-color:var(--tk-accent);border-radius:50%;animation:tk-spin .7s linear infinite;vertical-align:-3px;margin-right:8px}
@keyframes tk-spin{to{transform:rotate(360deg)}}
.tk-foot{margin-top:28px;text-align:center;font-size:12px;color:var(--tk-faint)}
.tk-avatar{position:relative;display:inline-grid;place-items:center;flex:none;border-radius:50%;overflow:hidden;background:color-mix(in srgb,var(--tk-accent) 16%,var(--tk-card));color:var(--tk-accent);font-weight:650;line-height:1}
.tk-avatar img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.tk-person{display:inline-flex;align-items:center;gap:8px;vertical-align:middle}
`;

export const UI_KIT_JS = `(function(){
var T = window.tembak = window.tembak || {};
var doc = document;
function $(el){ return typeof el === "string" ? doc.querySelector(el) : el; }
function clear(el){ el = $(el); while (el.firstChild) el.removeChild(el.firstChild); return el; }
function h(tag, props){
  var el = doc.createElement(tag);
  props = props || {};
  Object.keys(props).forEach(function(k){
    var v = props[k];
    if (v == null || v === false) return;
    if (k === "class" || k === "className") el.className = v;
    else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
    else if (k === "text") el.textContent = v;
    else if (k === "html") el.innerHTML = v;
    else if (k.slice(0, 2) === "on" && typeof v === "function") el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k in el && k !== "list" && k !== "type") { try { el[k] = v; } catch (e) { el.setAttribute(k, v); } }
    else el.setAttribute(k, v === true ? "" : v);
  });
  for (var i = 2; i < arguments.length; i++) add(el, arguments[i]);
  return el;
}
function add(el, c){
  if (c == null || c === false) return;
  if (Array.isArray(c)) { c.forEach(function(x){ add(el, x); }); return; }
  el.appendChild(c.nodeType ? c : doc.createTextNode(String(c)));
}
var SVGNS = "http://www.w3.org/2000/svg";
function s(tag, attrs, text){
  var el = doc.createElementNS(SVGNS, tag);
  Object.keys(attrs || {}).forEach(function(k){ if (attrs[k] != null) el.setAttribute(k, attrs[k]); });
  if (text != null) el.textContent = text;
  return el;
}

// ---- formatting -------------------------------------------------------------
var nf = {};
function NF(opts){ var k = JSON.stringify(opts); return nf[k] || (nf[k] = new Intl.NumberFormat(undefined, opts)); }
var MONEY_RE = /spend|cost|revenue|amount|price|budget|sales|mrr|arr|income|profit|fee|salary|value_usd|usd/i;
var PCT_RE = /rate|ratio|pct|percent|share|conversion|ctr|margin/i;
var format = {
  number: function(v, d){ return typeof v === "number" ? NF({ maximumFractionDigits: d == null ? (Math.abs(v) < 10 ? 2 : 1) : d }).format(v) : (v == null ? "—" : String(v)); },
  compact: function(v){ return typeof v === "number" ? NF({ notation: "compact", maximumFractionDigits: 1 }).format(v) : String(v); },
  currency: function(v, cur){ return typeof v === "number" ? NF({ style: "currency", currency: cur || T.currency || "USD", maximumFractionDigits: Math.abs(v) < 100 ? 2 : 0 }).format(v) : (v == null ? "—" : String(v)); },
  percent: function(v, d){ return typeof v === "number" ? NF({ style: "percent", maximumFractionDigits: d == null ? 1 : d }).format(v) : (v == null ? "—" : String(v)); },
  date: function(v){ if (!v) return "—"; var dt = new Date(v); return isNaN(dt) ? String(v) : dt.toLocaleDateString(undefined, { day: "numeric", month: "short", year: String(v).length > 7 && dt.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined }); },
  auto: function(key, v){
    if (typeof v !== "number") return v == null || v === "" ? "—" : (typeof v === "boolean" ? (v ? "Yes" : "No") : String(v));
    if (MONEY_RE.test(key)) return format.currency(v);
    if (PCT_RE.test(key) && Math.abs(v) <= 1) return format.percent(v);
    return format.number(v);
  },
  label: function(k){ return String(k).replace(/_/g, " ").replace(/^./, function(c){ return c.toUpperCase(); }); }
};
function fmtWith(f, key){
  if (typeof f === "function") return f;
  if (f && format[f]) return function(v){ return format[f](v); };
  return function(v){ return format.auto(key || "", v); };
}

// ---- data helpers -------------------------------------------------------------
function num(v){ return typeof v === "number" && isFinite(v) ? v : 0; }
function sum(rows, col){ return rows.reduce(function(a, r){ return a + num(r[col]); }, 0); }
function avg(rows, col){ var n = rows.filter(function(r){ return typeof r[col] === "number"; }); return n.length ? sum(n, col) / n.length : 0; }
function agg(rows, col, op){
  if (op === "count" || !col) return rows.length;
  if (op === "avg") return avg(rows, col);
  if (op === "min" || op === "max") { var vs = rows.map(function(r){ return r[col]; }).filter(function(v){ return typeof v === "number"; }); return vs.length ? Math[op].apply(null, vs) : 0; }
  return sum(rows, col);
}
function groupBy(rows, key){
  var m = new Map();
  rows.forEach(function(r){ var k = typeof key === "function" ? key(r) : r[key]; k = k == null || k === "" ? "(none)" : k; if (!m.has(k)) m.set(k, []); m.get(k).push(r); });
  return m;
}
function group(rows, by, metrics, op){
  metrics = metrics ? [].concat(metrics) : [];
  var out = [];
  groupBy(rows, by).forEach(function(list, k){
    var o = {}; o[typeof by === "string" ? by : "group"] = k; o.count = list.length;
    metrics.forEach(function(c){ o[c] = agg(list, c, op); });
    out.push(o);
  });
  return out;
}
function uniq(rows, col){ var seen = new Set(); rows.forEach(function(r){ if (r[col] != null && r[col] !== "") seen.add(r[col]); }); return Array.from(seen); }
function byWeek(v){ var d = new Date(v); if (isNaN(d)) return v; var day = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - day); return d.toISOString().slice(0, 10); }
function byMonth(v){ return v ? String(v).slice(0, 7) : v; }

// ---- theme ------------------------------------------------------------------
function theme(opts){
  opts = opts || {};
  var b = doc.body; b.classList.add("tk");
  if (opts.accent) b.style.setProperty("--tk-accent", opts.accent);
  if (opts.dark) b.classList.add("tk-dark");
  if (opts.currency) T.currency = opts.currency;
}

// ---- states -----------------------------------------------------------------
function loading(el, text){ clear(el).appendChild(h("div", { class: "tk-state" }, h("span", { class: "tk-spin" }), text || "Loading…")); }
function error(el, err){ clear(el).appendChild(h("div", { class: "tk-state tk-error" }, "Couldn't load this: " + (err && err.message ? err.message : String(err || "unknown error")))); }
function empty(el, text){ clear(el).appendChild(h("div", { class: "tk-state" }, text || "Nothing here yet.")); }
// A person from tembak.me()/members(): photo, or initials when there's none or it fails.
// Pass el = null to just get the node (e.g. from a table render function).
function avatar(el, person, o){
  o = o || {}; person = person || {};
  var size = o.size || 28, name = String(person.name || "?");
  var initials = name.trim().split(/\\s+/).slice(0, 2).map(function(w){ return w.charAt(0).toUpperCase(); }).join("") || "?";
  var pic = h("span", { class: "tk-avatar", title: name, style: { width: size + "px", height: size + "px", fontSize: Math.round(size * 0.4) + "px" } }, initials);
  if (person.photoUrl) { var img = h("img", { src: person.photoUrl, alt: "", referrerPolicy: "no-referrer", onerror: function(){ img.remove(); } }); pic.appendChild(img); }
  var node = o.name ? h("span", { class: "tk-person" }, pic, h("span", null, name)) : pic;
  if (el) clear(el).appendChild(node);
  return node;
}

// ---- KPI tiles -----------------------------------------------------------------
function kpis(el, items){
  el = clear(el); el.classList.add("tk-kpis");
  items.forEach(function(it){
    var f = fmtWith(it.format, it.label);
    var foot = null;
    if (typeof it.delta === "number" && isFinite(it.delta)) {
      var up = it.delta >= 0;
      var good = it.invert ? !up : up;
      foot = h("div", { class: "tk-kpi-foot" }, h("span", { class: good ? "tk-up" : "tk-down" }, (up ? "▲ " : "▼ ") + format.percent(Math.abs(it.delta))), it.hint ? " " + it.hint : "");
    } else if (it.hint) foot = h("div", { class: "tk-kpi-foot" }, it.hint);
    el.appendChild(h("div", { class: "tk-kpi" }, h("div", { class: "tk-kpi-label" }, it.label), h("div", { class: "tk-kpi-value" }, typeof it.value === "number" ? f(it.value) : (it.value == null ? "—" : String(it.value))), foot));
  });
  return el;
}

// ---- charts -----------------------------------------------------------------
var PALETTE = ["var(--tk-accent)", "#0ea5e9", "#f59e0b", "#10b981", "#ec4899", "#8b5cf6", "#64748b", "#ef4444"];
function niceMax(v){ if (v <= 0) return 1; var p = Math.pow(10, Math.floor(Math.log10(v))); var n = v / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p; }
function niceMin(v){ return v >= 0 ? 0 : -niceMax(-v); }
function chartData(o){
  var rows = o.data || [];
  var ys = [].concat(o.y || []);
  var op = o.agg || (ys.length ? "sum" : "count");
  var xs = [], series = [];
  var keyX = function(r){ var v = typeof o.x === "function" ? o.x(r) : r[o.x]; if (o.bucket === "week") v = byWeek(v); if (o.bucket === "month") v = byMonth(v); return v == null || v === "" ? "(none)" : v; };
  var byX = groupBy(rows, keyX);
  xs = Array.from(byX.keys());
  if (o.series) {
    var names = uniq(rows, o.series);
    series = names.map(function(n){ return { name: String(n), values: xs.map(function(x){ return agg(byX.get(x).filter(function(r){ return r[o.series] === n; }), ys[0], op); }) }; });
  } else if (ys.length) {
    series = ys.map(function(y){ return { name: o.labels && o.labels[y] || format.label(y), values: xs.map(function(x){ return agg(byX.get(x), y, op); }) }; });
  } else {
    series = [{ name: "Count", values: xs.map(function(x){ return byX.get(x).length; }) }];
  }
  var idx = xs.map(function(_, i){ return i; });
  var sort = o.sort || (o.type === "line" || o.type === "area" ? "x" : "value");
  if (sort === "x") idx.sort(function(a, b){ return xs[a] > xs[b] ? 1 : xs[a] < xs[b] ? -1 : 0; });
  else if (sort === "value") idx.sort(function(a, b){ return total(b) - total(a); });
  function total(i){ return series.reduce(function(t, sr){ return t + sr.values[i]; }, 0); }
  var limit = o.limit || (o.type === "donut" ? 6 : o.type === "line" || o.type === "area" ? 0 : 12);
  var other = null;
  if (limit && idx.length > limit) {
    var rest = idx.slice(limit - (o.type === "donut" ? 1 : 0));
    idx = idx.slice(0, limit - (o.type === "donut" ? 1 : 0));
    if (o.type === "donut") other = series.map(function(sr){ return rest.reduce(function(t, i){ return t + sr.values[i]; }, 0); });
  }
  var out = { xs: idx.map(function(i){ return xs[i]; }), series: series.map(function(sr){ return { name: sr.name, values: idx.map(function(i){ return sr.values[i]; }) }; }) };
  if (other) { out.xs.push("Other"); out.series.forEach(function(sr, k){ sr.values.push(other[k]); }); }
  if (series.length > 8) out.series = out.series.slice(0, 8);
  return out;
}
function colorOf(o, i){ return (o.colors && o.colors[i]) || PALETTE[i % PALETTE.length]; }
function tipFor(el){ var t = el.querySelector(".tk-tip"); if (!t) { t = h("div", { class: "tk-tip" }); el.appendChild(t); } return t; }
function showTip(el, tip, x, y, html){ tip.innerHTML = html; tip.style.opacity = "1"; var w = el.clientWidth; var tw = tip.offsetWidth; tip.style.left = Math.max(0, Math.min(w - tw, x - tw / 2)) + "px"; tip.style.top = Math.max(0, y - tip.offsetHeight - 10) + "px"; }
function hideTip(tip){ tip.style.opacity = "0"; }
function esc(v){ return String(v).replace(/[&<>"]/g, function(c){ return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
function xLabel(o, x){ if (o.xFormat) return fmtWith(o.xFormat)(x); return /^\\d{4}-\\d{2}(-\\d{2})?/.test(String(x)) ? format.date(x) : String(x); }

function chart(el, o){
  el = $(el);
  var render = function(){ drawChart(el, o); };
  render();
  if (!el.__tkObs && window.ResizeObserver) {
    var lastW = el.clientWidth;
    el.__tkObs = new ResizeObserver(function(){ if (Math.abs(el.clientWidth - lastW) > 4) { lastW = el.clientWidth; render(); } });
    el.__tkObs.observe(el);
  }
  return { update: function(next){ Object.assign(o, next); render(); } };
}
function drawChart(el, o){
  clear(el); el.classList.add("tk-chart");
  var d = chartData(o);
  if (!d.xs.length) { empty(el, o.empty || "No data to chart."); return; }
  var type = o.type || "bar";
  var W = Math.max(260, el.clientWidth || 600), H = o.height || 260;
  var f = fmtWith(o.format, [].concat(o.y || [""])[0]);
  var svg = s("svg", { viewBox: "0 0 " + W + " " + H, height: H, role: "img", "aria-label": o.title || "Chart" });
  el.appendChild(svg);
  var tip = tipFor(el);
  if (type === "donut") { drawDonut(el, svg, o, d, W, H, f, tip); }
  else if (type === "hbar") { drawHbar(svg, o, d, W, H, f, tip, el); }
  else { drawXY(svg, o, d, W, H, f, tip, el, type); }
  if (d.series.length > 1 || type === "donut") {
    var names = type === "donut" ? d.xs : d.series.map(function(sr){ return sr.name; });
    el.appendChild(h("div", { class: "tk-legend" }, names.map(function(n, i){ return h("span", null, h("i", { style: { background: colorOf(o, i) } }), xLabel(o, n)); })));
  }
}
function drawXY(svg, o, d, W, H, f, tip, el, type){
  var all = []; d.series.forEach(function(sr){ all = all.concat(sr.values); });
  var max = niceMax(Math.max.apply(null, all.concat([0]))), min = niceMin(Math.min.apply(null, all.concat([0])));
  var left = 8 + Math.max.apply(null, [max, min].map(function(v){ return format.compact(v).length; })) * 6.5, right = 10, top = 10, bottom = 26;
  var pw = W - left - right, ph = H - top - bottom;
  var y = function(v){ return top + ph - (v - min) / (max - min) * ph; };
  for (var t = 0; t <= 4; t++) {
    var v = min + (max - min) * t / 4;
    svg.appendChild(s("line", { x1: left, x2: W - right, y1: y(v), y2: y(v), stroke: "var(--tk-border)", "stroke-dasharray": t === 0 && min === 0 ? null : "3 4" }));
    svg.appendChild(s("text", { x: left - 6, y: y(v) + 4, "text-anchor": "end" }, format.compact(v)));
  }
  var n = d.xs.length, band = pw / n;
  var every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(pw / 70))));
  d.xs.forEach(function(x, i){ if (i % every === 0) svg.appendChild(s("text", { x: left + band * i + band / 2, y: H - 8, "text-anchor": "middle" }, xLabel(o, x).slice(0, 14))); });
  if (type === "line" || type === "area") {
    var px = function(i){ return left + band * i + band / 2; };
    d.series.forEach(function(sr, k){
      var c = colorOf(o, k);
      var pts = sr.values.map(function(v, i){ return px(i) + "," + y(v); });
      if (d.series.length === 1 || type === "area") svg.appendChild(s("path", { d: "M" + px(0) + "," + y(Math.max(min, 0)) + " L" + pts.join(" L") + " L" + px(n - 1) + "," + y(Math.max(min, 0)) + " Z", fill: c, "fill-opacity": .1 }));
      svg.appendChild(s("polyline", { points: pts.join(" "), fill: "none", stroke: c, "stroke-width": k === 0 ? 2.5 : 1.75, "stroke-linejoin": "round", "stroke-linecap": "round" }));
      if (n <= 40) sr.values.forEach(function(v, i){ svg.appendChild(s("circle", { cx: px(i), cy: y(v), r: 2.5, fill: c })); });
    });
  } else {
    var gw = band * .72, bw = gw / d.series.length;
    d.series.forEach(function(sr, k){
      sr.values.forEach(function(v, i){
        var x0 = left + band * i + (band - gw) / 2 + bw * k, y0 = y(Math.max(v, 0)), y1 = y(Math.min(v, 0));
        svg.appendChild(s("rect", { x: x0 + 1, y: y0, width: Math.max(1, bw - 2), height: Math.max(1, y1 - y0), rx: 4, fill: colorOf(o, d.series.length > 1 ? k : 0), "fill-opacity": d.series.length > 1 || i === 0 || !o.highlightTop ? 1 : .55 }));
      });
    });
  }
  d.xs.forEach(function(x, i){
    var hit = s("rect", { x: left + band * i, y: top, width: band, height: ph, fill: "transparent" });
    hit.addEventListener("mousemove", function(){
      showTip(el, tip, left + band * i + band / 2, top + 4, "<b>" + esc(xLabel(o, x)) + "</b>" + d.series.map(function(sr, k){ return "<br>" + (d.series.length > 1 ? esc(sr.name) + ": " : "") + esc(f(sr.values[i])); }).join(""));
    });
    hit.addEventListener("mouseleave", function(){ hideTip(tip); });
    svg.appendChild(hit);
  });
}
function drawHbar(svg, o, d, W, H, f, tip, el){
  var vals = d.series[0].values, n = d.xs.length;
  var rowH = Math.max(22, Math.min(34, (H - 8) / n));
  H = rowH * n + 8; svg.setAttribute("viewBox", "0 0 " + W + " " + H); svg.setAttribute("height", H);
  var labelW = Math.min(W * .38, 8 + Math.max.apply(null, d.xs.map(function(x){ return xLabel(o, x).length; })) * 6.6);
  var valW = 64, pw = W - labelW - valW;
  var max = Math.max.apply(null, vals.concat([0])) || 1;
  d.xs.forEach(function(x, i){
    var yy = 4 + i * rowH, v = vals[i], w = Math.max(2, v / max * pw);
    svg.appendChild(s("text", { x: labelW - 8, y: yy + rowH / 2 + 4, "text-anchor": "end" }, xLabel(o, x).slice(0, 26)));
    var bar = s("rect", { x: labelW, y: yy + 4, width: w, height: rowH - 8, rx: 5, fill: colorOf(o, 0), "fill-opacity": i === 0 ? 1 : .6 });
    svg.appendChild(bar);
    svg.appendChild(s("text", { x: labelW + w + 6, y: yy + rowH / 2 + 4, style: "fill:var(--tk-text);font-weight:600" }, f(v)));
    bar.addEventListener("mousemove", function(){ showTip(el, tip, labelW + w / 2, yy, "<b>" + esc(xLabel(o, x)) + "</b><br>" + esc(f(v))); });
    bar.addEventListener("mouseleave", function(){ hideTip(tip); });
  });
}
function drawDonut(el, svg, o, d, W, H, f, tip){
  var vals = d.series[0].values, tot = vals.reduce(function(a, b){ return a + Math.max(0, b); }, 0) || 1;
  var r = Math.min(W, H) / 2 - 6, cx = W / 2, cy = H / 2, inner = r * .62, a0 = -Math.PI / 2;
  vals.forEach(function(v, i){
    var a1 = a0 + Math.max(0, v) / tot * Math.PI * 2;
    var large = a1 - a0 > Math.PI ? 1 : 0;
    var p = function(rad, a){ return (cx + rad * Math.cos(a)) + "," + (cy + rad * Math.sin(a)); };
    var path = a1 - a0 >= Math.PI * 2 - 1e-6
      ? "M" + p(r, 0) + " A" + r + "," + r + " 0 1 1 " + p(r, Math.PI) + " A" + r + "," + r + " 0 1 1 " + p(r, 0) + " M" + p(inner, 0) + " A" + inner + "," + inner + " 0 1 0 " + p(inner, Math.PI) + " A" + inner + "," + inner + " 0 1 0 " + p(inner, 0) + "Z"
      : "M" + p(r, a0) + " A" + r + "," + r + " 0 " + large + " 1 " + p(r, a1) + " L" + p(inner, a1) + " A" + inner + "," + inner + " 0 " + large + " 0 " + p(inner, a0) + "Z";
    var seg = s("path", { d: path, fill: colorOf(o, i), "fill-rule": "evenodd", stroke: "var(--tk-card)", "stroke-width": 2 });
    var mid = (a0 + a1) / 2, label = d.xs[i];
    seg.addEventListener("mousemove", function(){ showTip(el, tip, cx + r * .8 * Math.cos(mid), cy + r * .8 * Math.sin(mid), "<b>" + esc(xLabel(o, label)) + "</b><br>" + esc(f(v)) + " · " + esc(format.percent(Math.max(0, v) / tot))); });
    seg.addEventListener("mouseleave", function(){ hideTip(tip); });
    svg.appendChild(seg);
    a0 = a1;
  });
  svg.appendChild(s("text", { x: cx, y: cy - 2, "text-anchor": "middle", style: "fill:var(--tk-text);font-size:18px;font-weight:650" }, f(tot)));
  svg.appendChild(s("text", { x: cx, y: cy + 16, "text-anchor": "middle" }, o.centerLabel || "Total"));
}

// ---- table ------------------------------------------------------------------
function table(el, rows, o){
  el = clear(el); o = o || {};
  var cols = (o.columns || Object.keys(rows[0] || {})).map(function(c){ return typeof c === "string" ? { key: c } : c; });
  cols.forEach(function(c){ c.label = c.label || format.label(c.key); c.fmt = c.render ? null : fmtWith(c.format, c.key); c.numeric = c.align ? c.align === "right" : rows.length > 0 && rows.every(function(r){ return r[c.key] == null || typeof r[c.key] === "number"; }); });
  var state = { q: "", sort: o.sort || null, dir: o.desc === false ? 1 : -1, shown: o.pageSize || 50 };
  var tools = h("div", { class: "tk-table-tools" });
  var showSearch = o.search != null ? o.search : rows.length > 8;
  var count = h("span", { class: "tk-muted", style: { fontSize: "12px" } });
  if (showSearch) tools.appendChild(h("input", { class: "tk-input", type: "search", placeholder: o.searchPlaceholder || "Search…", oninput: function(e){ state.q = e.target.value.toLowerCase(); state.shown = o.pageSize || 50; draw(); } }));
  tools.appendChild(count);
  if (o.actions) add(tools, o.actions);
  var wrap = h("div", { class: "tk-table-wrap" });
  var more = h("button", { class: "tk-btn tk-btn-ghost", style: { marginTop: "8px" }, onclick: function(){ state.shown += o.pageSize || 50; draw(); } }, "Show more");
  el.appendChild(tools); el.appendChild(wrap); el.appendChild(more);
  function draw(){
    var data = rows.filter(function(r){ return !state.q || cols.some(function(c){ return String(r[c.key] == null ? "" : r[c.key]).toLowerCase().indexOf(state.q) >= 0; }); });
    if (state.sort) data = data.slice().sort(function(a, b){ var x = a[state.sort], y = b[state.sort]; return (x == null ? 1 : y == null ? -1 : x > y ? 1 : x < y ? -1 : 0) * state.dir; });
    count.textContent = data.length === rows.length ? rows.length + " rows" : data.length + " of " + rows.length + " rows";
    var head = h("tr", null, cols.map(function(c){
      return h("th", { class: c.numeric ? "tk-num" : "", "data-sort": o.sortable === false ? null : c.key, onclick: o.sortable === false ? null : function(){ state.dir = state.sort === c.key ? -state.dir : -1; state.sort = c.key; draw(); } }, c.label + (state.sort === c.key ? (state.dir > 0 ? " ↑" : " ↓") : ""));
    }));
    var body = h("tbody");
    data.slice(0, state.shown).forEach(function(r){
      body.appendChild(h("tr", { class: o.onRowClick ? "tk-click" : "", onclick: o.onRowClick ? function(){ o.onRowClick(r); } : null }, cols.map(function(c){
        var cell = c.render ? c.render(r[c.key], r) : c.fmt(r[c.key]);
        return h("td", { class: c.numeric ? "tk-num" : "", title: typeof cell === "string" && cell.length > 40 ? cell : null }, cell);
      })));
    });
    if (!data.length) body.appendChild(h("tr", null, h("td", { colspan: cols.length, class: "tk-state", style: { padding: "28px" } }, o.empty || (rows.length ? "No matching rows" : "No rows yet"))));
    clear(wrap).appendChild(h("table", { class: "tk-table" }, h("thead", null, head), body));
    more.style.display = data.length > state.shown ? "" : "none";
  }
  draw();
  return { update: function(next){ rows = next; draw(); } };
}

// ---- inputs -----------------------------------------------------------------
function opts(list){ return (list || []).map(function(x){ return typeof x === "object" ? x : { value: x, label: String(x) }; }); }
function select(el, o){
  el = $(el);
  var sel = h("select", { class: "tk-select", onchange: function(){ o.onChange && o.onChange(sel.value); } },
    o.all ? h("option", { value: "" }, o.all === true ? "All" : o.all) : null,
    opts(o.options).map(function(x){ return h("option", { value: x.value, selected: String(x.value) === String(o.value) }, x.label); }));
  clear(el).appendChild(o.label ? h("label", { class: "tk-inline" }, o.label, sel) : sel);
  return sel;
}
function segmented(el, o){
  el = clear(el);
  var wrap = h("div", { class: "tk-seg", role: "group" });
  var value = o.value;
  opts(o.options).forEach(function(x){
    var b = h("button", { type: "button", "aria-pressed": String(String(x.value) === String(value)), onclick: function(){ value = x.value; wrap.querySelectorAll("button").forEach(function(n){ n.setAttribute("aria-pressed", String(n === b)); }); o.onChange && o.onChange(x.value); } }, x.label);
    wrap.appendChild(b);
  });
  el.appendChild(wrap);
  return wrap;
}
// Selects keep values that aren't (yet) among their options, e.g. a member picked before the list loads.
function setSelect(sel, v){
  v = v == null ? "" : String(v);
  if (v && !Array.prototype.some.call(sel.options, function(x){ return x.value === v; })) sel.appendChild(h("option", { value: v }, v));
  sel.value = v;
}
// "member" field: a select of workspace members (value = their name). Without the
// runtime there's no member list, so it's a plain text input there.
function memberInput(fd){
  if (!T.members) return h("input", { class: "tk-input", type: "text", name: fd.name, placeholder: fd.placeholder || "Name", required: !!fd.required });
  var sel = h("select", { class: "tk-select", name: fd.name, required: !!fd.required }, h("option", { value: "" }, fd.required ? "Choose…" : ""));
  T.members().then(function(list){
    var cur = sel.value;
    list.forEach(function(m){ if (!Array.prototype.some.call(sel.options, function(x){ return x.value === m.name; })) sel.appendChild(h("option", { value: m.name }, m.name)); });
    sel.value = cur;
  }).catch(function(err){ console.error(err); });
  return sel;
}
function form(el, o){
  el = clear(el);
  var f = h("form", { class: "tk-form", novalidate: false });
  var inputs = {};
  (o.fields || []).forEach(function(fd){
    var t = fd.type || "text", input;
    if (t === "select") input = h("select", { class: "tk-select", name: fd.name, required: !!fd.required }, fd.required ? null : h("option", { value: "" }, ""), opts(fd.options).map(function(x){ return h("option", { value: x.value }, x.label); }));
    else if (t === "textarea") input = h("textarea", { class: "tk-textarea", name: fd.name, placeholder: fd.placeholder || "", required: !!fd.required });
    else if (t === "checkbox") input = h("input", { type: "checkbox", name: fd.name });
    else if (t === "member") input = memberInput(fd);
    else input = h("input", { class: "tk-input", type: t, name: fd.name, placeholder: fd.placeholder || "", required: !!fd.required, step: t === "number" ? (fd.step || "any") : null, min: fd.min, max: fd.max });
    if (fd.value != null) { if (t === "checkbox") input.checked = !!fd.value; else if (t === "member" && input.tagName === "SELECT") setSelect(input, fd.value); else input.value = fd.value; }
    inputs[fd.name] = { el: input, type: t };
    f.appendChild(t === "checkbox" ? h("label", { class: "tk-check" + (fd.wide ? " tk-wide" : "") }, input, fd.label || format.label(fd.name)) : h("label", { class: "tk-field" + (fd.wide || t === "textarea" ? " tk-wide" : "") }, fd.label || format.label(fd.name), input));
  });
  var btn = h("button", { class: "tk-btn tk-btn-primary", type: "submit" }, o.submitLabel || "Save");
  f.appendChild(h("div", null, btn));
  function values(){ var v = {}; Object.keys(inputs).forEach(function(k){ var i = inputs[k]; v[k] = i.type === "checkbox" ? i.el.checked : i.type === "number" ? (i.el.value === "" ? null : Number(i.el.value)) : i.el.value; }); return v; }
  f.addEventListener("submit", function(e){
    e.preventDefault();
    btn.disabled = true;
    Promise.resolve(o.onSubmit && o.onSubmit(values())).then(function(keep){ if (keep !== false) f.reset(); }).catch(function(err){ console.error(err); }).then(function(){ btn.disabled = false; });
  });
  el.appendChild(f);
  return { el: f, values: values, reset: function(){ f.reset(); }, set: function(v){ Object.keys(v).forEach(function(k){ if (inputs[k]) { if (inputs[k].type === "checkbox") inputs[k].el.checked = !!v[k]; else if (inputs[k].type === "member" && inputs[k].el.tagName === "SELECT") setSelect(inputs[k].el, v[k]); else inputs[k].el.value = v[k] == null ? "" : v[k]; } }); } };
}
function tabs(el, list){
  el = clear(el);
  var bar = h("div", { class: "tk-tabs", role: "tablist" });
  var panels = list.map(function(){ return h("div", { role: "tabpanel", hidden: true }); });
  var done = list.map(function(){ return false; });
  function pick(i){
    bar.querySelectorAll(".tk-tab").forEach(function(b, j){ b.setAttribute("aria-selected", String(i === j)); });
    panels.forEach(function(p, j){ p.hidden = i !== j; });
    if (!done[i]) { done[i] = true; list[i].render(panels[i]); }
  }
  list.forEach(function(t, i){ bar.appendChild(h("button", { class: "tk-tab", role: "tab", type: "button", onclick: function(){ pick(i); } }, t.label)); });
  el.appendChild(bar); panels.forEach(function(p){ el.appendChild(p); });
  if (list.length) pick(0);
  return { select: pick };
}

// ---- persistence and export ---------------------------------------------------------
function collection(key){
  var cache = null;
  function load(){ return cache ? Promise.resolve(cache) : T.kv.get(key).then(function(v){ cache = Array.isArray(v) ? v : []; return cache; }); }
  function save(){ return T.kv.set(key, cache).then(function(){ return cache; }); }
  return {
    all: function(){ return load().then(function(l){ return l.slice(); }); },
    add: function(item){ return load().then(function(l){ var it = Object.assign({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), created_at: new Date().toISOString() }, item); l.push(it); return save().then(function(){ return it; }); }); },
    update: function(id, patch){ return load().then(function(l){ l.forEach(function(it, i){ if (it.id === id) l[i] = Object.assign({}, it, patch); }); return save(); }); },
    remove: function(id){ return load().then(function(l){ cache = l.filter(function(it){ return it.id !== id; }); return save(); }); },
    replace: function(items){ cache = items.slice(); return save(); }
  };
}
function download(filename, rows){
  var cols = Object.keys(rows[0] || {});
  var cell = function(v){ v = v == null ? "" : String(v); return /[",\\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  var csv = [cols.join(",")].concat(rows.map(function(r){ return cols.map(function(c){ return cell(r[c]); }).join(","); })).join("\\n");
  var a = h("a", { href: URL.createObjectURL(new Blob([csv], { type: "text/csv" })), download: filename || "data.csv" });
  doc.body.appendChild(a); a.click(); a.remove();
}

T.ui = { h: h, clear: clear, theme: theme, format: format, kpis: kpis, chart: chart, table: table, select: select, segmented: segmented, form: form, avatar: avatar, tabs: tabs, loading: loading, error: error, empty: empty, collection: collection, download: download, sum: sum, avg: avg, group: group, uniq: uniq, week: byWeek, month: byMonth };
})();`;
