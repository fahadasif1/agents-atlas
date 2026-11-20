/* Agents Atlas — map + records + actions + export. No build step; plain JS + d3. */
(() => {
"use strict";
const CFG = window.AGENTS_CONFIG || {};
const STATUSES = CFG.STATUSES || ["Not contacted"];
const $ = (s, r = document) => r.querySelector(s);
const el = (tag, props = {}, ...kids) => { const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) { if (k === "class") e.className = v; else if (k === "html") e.innerHTML = v; else if (k.startsWith("on")) e.addEventListener(k.slice(2), v); else if (v !== false && v != null) e.setAttribute(k, v === true ? "" : v); }
  kids.flat().forEach(c => e.append(c?.nodeType ? c : document.createTextNode(c ?? ""))); return e; };
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = n => n.toLocaleString("en-GB");
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const safeUrl = u => { try { const x = new URL(/^https?:\/\//i.test(u) ? u : "https://" + u); return /^https?:$/.test(x.protocol) ? x.href : ""; } catch { return ""; } };
const store = { get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };

/* ---------- theme ---------- */
const root = document.documentElement;
const savedTheme = store.get("agents.theme", null); if (savedTheme) root.dataset.theme = savedTheme;
$("#themeBtn").onclick = () => { const cur = root.dataset.theme || (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
  const nx = cur === "dark" ? "light" : "dark"; root.dataset.theme = nx; store.set("agents.theme", nx); if (S.map) drawMap(); };

/* ---------- constants ---------- */
const REGION_COLOR = { "Asia": "#2dd4bf", "Oceania": "#fbbf24", "Europe": "#60a5fa", "Africa": "#fb7185", "Middle East & North Africa": "#a78bfa",
  "Latin America & Caribbean": "#fb923c", "North America": "#4ade80", "Unclassified": "#8fa0c0" };
const REGION_VIEW = { // lon/lat boxes used to zoom
  "Asia": [[60, -11], [146, 52]], "Oceania": [[110, -48], [180, 2]], "Europe": [[-12, 35], [45, 70]], "Africa": [[-20, -36], [52, 16]],
  "Middle East & North Africa": [[-14, 11], [64, 42]], "Latin America & Caribbean": [[-118, -56], [-58, 28]], "North America": [[-170, 14], [-52, 72]] };
const ATLAS_ALIAS = { "United States of America": "United States", "Dem. Rep. Congo": "DR Congo", "Congo": "Republic of the Congo", "Côte d'Ivoire": "Ivory Coast",
  "Bosnia and Herz.": "Bosnia and Herzegovina", "Dominican Rep.": "Dominican Republic", "eSwatini": "Eswatini", "N. Cyprus": "Cyprus", "Macedonia": "North Macedonia",
  "Trinidad and Tobago": "Trinidad and Tobago", "Kosovo": "Kosovo", "W. Sahara": null, "Somaliland": "Somalia", "Cape Verde": "Cape Verde" };
const DOTS = { "Hong Kong": [114.17, 22.32], "Macau": [113.55, 22.2], "Singapore": [103.82, 1.35], "Malta": [14.4, 35.9], "Maldives": [73.5, 3.2], "Mauritius": [57.55, -20.25],
  "Bahrain": [50.55, 26.05], "Seychelles": [55.45, -4.65], "Cape Verde": [-23.6, 15.1], "Bermuda": [-64.75, 32.3], "Cayman Islands": [-81.25, 19.3], "British Virgin Islands": [-64.6, 18.4],
  "US Virgin Islands": [-64.9, 18.35], "Jersey": [-2.13, 49.2], "Guernsey": [-2.58, 49.45], "Isle of Man": [-4.55, 54.23], "Barbados": [-59.55, 13.18], "Samoa": [-172.1, -13.75],
  "Tonga": [-175.2, -21.2], "Singapore ": [103.82, 1.35], "Puerto Rico": [-66.5, 18.2], "Bahamas": [-77.4, 25.0], "Brunei": [114.7, 4.5], "Gambia": [-15.4, 13.45], "Kosovo": [20.9, 42.6],
  "Jamaica": [-77.3, 18.1], "Hong Kong ": [114.17, 22.32], "New Caledonia": [165.6, -21.3], "Vanuatu": [167.7, -16.2], "Fiji": [178.0, -17.8], "Solomon Islands": [160.2, -9.6] };

/* ---------- state ---------- */
const S = { manifest: null, byCountry: new Map(), cache: new Map(), map: null,
  scope: null, rows: [], view: [], colIdx: {}, sort: null, sel: new Set(), open: null,
  filt: { q: "", type: "all", email: false, phone: false, web: false, star: false, status: "", dest: "", country: "" },
  cols: null, widths: store.get("agents.widths", {}), actions: store.get("agents.actions.v1", {}), dirty: store.get("agents.dirty.v1", {}) };

/* ---------- access key (data files are AES-GCM encrypted; the key never leaves the browser) ---------- */
let KEY = null;
const te = new TextEncoder();
const b64 = { enc: u => btoa(String.fromCharCode(...u)), dec: s => Uint8Array.from(atob(s), c => c.charCodeAt(0)) };
async function deriveRaw(pass) {
  const salt = new Uint8Array(await fetch("data/salt.bin").then(r => r.arrayBuffer()));
  const base = await crypto.subtle.importKey("raw", te.encode(pass.trim()), "PBKDF2", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 250000, hash: "SHA-256" }, base, 256));
}
const importKey = raw => crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["decrypt"]);
async function getJSON(path) {
  const r = await fetch(path); if (!r.ok) throw new Error(r.status);
  const buf = new Uint8Array(await r.arrayBuffer());
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: buf.slice(0, 12) }, KEY, buf.slice(12));
  return JSON.parse(new TextDecoder().decode(pt));
}

/* ---------- boot ---------- */
function startApp(m) {
  S.manifest = m; m.countries.forEach(c => S.byCountry.set(c.country, c));
  const regs = regionTotals();
  $("#landingStats").textContent = `${fmt(m.total)} records · ${m.countries.length} countries · ${regs.length - (regs.find(r => r.name === "Unclassified") ? 1 : 0)} regions · ${fmt(m.countries.reduce((a, c) => a + c.email, 0))} with a public email`;
  renderCentre(m, regs); route();
}
async function tryKey(raw, remember) {
  KEY = await importKey(raw);
  let m; try { m = await getJSON("data/manifest.json"); } catch { KEY = null; throw new Error("bad key"); }
  if (remember) { try { localStorage.setItem("agents.k", b64.enc(raw)); } catch {} }
  $("#lock").hidden = true; document.body.classList.remove("locked"); startApp(m);
}
function showLock(msg) {
  document.body.classList.add("locked"); $("#lock").hidden = false; $("#lockMsg").textContent = msg || "";
  $("#lockKey").focus();
}
$("#lockForm").addEventListener("submit", async e => {
  e.preventDefault(); const btn = $("#lockGo"); btn.disabled = true; $("#lockMsg").textContent = "Checking…";
  try { await tryKey(await deriveRaw($("#lockKey").value), $("#lockRemember").checked); $("#lockKey").value = ""; }
  catch { $("#lockMsg").textContent = "That key didn't work."; $("#lockKey").select(); }
  btn.disabled = false;
});
$("#lockBtn").addEventListener("click", () => { try { localStorage.removeItem("agents.k"); } catch {} location.reload(); });
(async () => {
  let saved = null; try { saved = localStorage.getItem("agents.k"); } catch {}
  if (saved) { try { await tryKey(b64.dec(saved), false); return; } catch { try { localStorage.removeItem("agents.k"); } catch {} } }
  showLock();
})();
addEventListener("hashchange", route);

function renderCentre(m, regs) {
  $("#centre").hidden = false; const max = regs[0].n;
  $("#ccRegions .ccb").replaceChildren(...regs.map(r => el("a", { class: "bar-row", href: "#/r/" + encodeURIComponent(r.name), style: `--c:${REGION_COLOR[r.name]}` },
    el("span", {}, r.name), el("i", {}, el("b", { style: `width:${r.n / max * 100}%` })), el("em", {}, fmt(r.n)))));
  const sum = k => m.countries.reduce((a, c) => a + c[k], 0), pct = n => Math.round(n / m.total * 100);
  const cov = [["Public email", sum("email")], ["Phone", sum("phone")], ["Website", sum("web")]];
  $("#ccCoverage .ccb").replaceChildren(...cov.map(([l, n]) => el("div", { class: "bar-row", style: "--c:var(--teal)" }, el("span", {}, l), el("i", {}, el("b", { style: `width:${pct(n)}%` })), el("em", {}, pct(n) + "%"))),
    el("p", { class: "dim", style: "font-size:12px;margin:8px 0 0" }, `${fmt(sum("agencies"))} agencies/offices · ${fmt(sum("individuals"))} named individuals`));
  $("#ccTop .ccb").replaceChildren(...m.countries.slice(0, 8).map(c => el("a", { class: "bar-row", href: "#/c/" + encodeURIComponent(c.country), style: `--c:${REGION_COLOR[c.region]}` },
    el("span", {}, c.country), el("i", {}, el("b", { style: `width:${c.n / m.countries[0].n * 100}%` })), el("em", {}, fmt(c.n)))));
}
function regionTotals() {
  const m = new Map();
  S.manifest.countries.forEach(c => { const r = m.get(c.region) || { name: c.region, n: 0, email: 0, phone: 0, countries: [] };
    r.n += c.n; r.email += c.email; r.phone += c.phone; r.countries.push(c); m.set(c.region, r); });
  return [...m.values()].sort((a, b) => (a.name === "Unclassified") - (b.name === "Unclassified") || b.n - a.n);
}

/* ---------- routing ---------- */
function show(id) { for (const v of document.querySelectorAll(".view")) v.hidden = v.id !== id; closeDrawer(); }
function crumbs(parts) { const c = $("#crumbs"); c.innerHTML = "";
  parts.forEach((p, i) => { if (i) c.append(el("span", { class: "sep" }, "›")); c.append(p.href ? el("a", { href: p.href }, p.label) : el("span", { class: "cur" }, p.label)); }); }
window.__atlas = { el, getJSON, safeUrl, store, fmt, toast: m => toast(m), csvCell: v => csvCell(v) };
function route() {
  if (!S.manifest) return;
  const h = decodeURIComponent(location.hash.replace(/^#\/?/, ""));
  const [kind, ...rest] = h.split("/"); const name = rest.join("/");
  if (kind === "progress") { show("progressView"); crumbs([{ label: "World map", href: "#/map" }, { label: "Progress" }]); renderProgress(); }
  else if (kind === "uk") { show("ukView"); crumbs([{ label: "UK agents" }]); window.UKMAP.open(); }
  else if (kind === "map") { show("mapView"); crumbs([{ label: "Map" }]); renderMapView(); }
  else if (kind === "r" && name) { openScope({ type: "region", name }); }
  else if (kind === "c" && S.byCountry.has(name)) { openScope({ type: "country", name }); }
  else { location.replace("#/uk"); }
}

/* ---------- progress ---------- */
const PG = { data: null, f: { region: "", type: "", source: "" } };
async function renderProgress(force) {
  if (!PG.data || force) { try { PG.data = await getJSON("data/progress.json?t=" + Date.now()); } catch { $("#pgMeta").textContent = "Could not load data/progress.json"; return; } }
  const d = PG.data, ix = Object.fromEntries(d.cols.map((c, i) => [c, i]));
  $("#pgMeta").textContent = `Built ${d.built} · master CSV last changed ${d.source_modified} · ${fmt(d.total)} records`;
  $("#pgReload").onclick = () => renderProgress(true).then(() => toast("Progress reloaded"));
  const uniq = k => [...new Set(d.cube.map(r => r[ix[k]]))].sort();
  const sel = (key, label, opts) => { const s = el("select", { "aria-label": label, onchange: e => { PG.f[key] = e.target.value; renderProgress(); } }, el("option", { value: "" }, label), ...opts.map(o => el("option", { value: o }, o.length > 60 ? o.slice(0, 58) + "…" : o))); s.value = PG.f[key]; return s; };
  $("#pgFilters").replaceChildren(sel("region", "All regions", uniq("region")), sel("type", "All record types", uniq("type")), sel("source", "All source lists", uniq("source")),
    el("button", { class: "btn link", onclick: () => { PG.f = { region: "", type: "", source: "" }; renderProgress(); } }, "Reset filters"));
  const rows = d.cube.filter(r => (!PG.f.region || r[ix.region] === PG.f.region) && (!PG.f.type || r[ix.type] === PG.f.type) && (!PG.f.source || r[ix.source] === PG.f.source));
  const sum = (rs, k) => rs.reduce((a, r) => a + r[ix[k]], 0), n = sum(rows, "n") || 1, pct = (a, b) => Math.round(a / (b || 1) * 1000) / 10;
  const kp = [["Records", fmt(sum(rows, "n"))], ["Country assigned", pct(sum(rows, "classified"), n) + "%"], ["Still unclassified", fmt(sum(rows, "n") - sum(rows, "classified"))],
    ["Public email", pct(sum(rows, "email"), n) + "%"], ["Phone", pct(sum(rows, "phone"), n) + "%"], ["Website", pct(sum(rows, "web"), n) + "%"], ["Named contact", pct(sum(rows, "contact"), n) + "%"]];
  $("#pgKpis").replaceChildren(...kp.map(([l, v]) => el("div", { class: "kpi" }, el("span", {}, l), el("b", {}, v))));
  const group = key => { const m = new Map(); rows.forEach(r => { const a = m.get(r[ix[key]]) || { n: 0, c: 0, e: 0, p: 0, w: 0 }; a.n += r[ix.n]; a.c += r[ix.classified]; a.e += r[ix.email]; a.p += r[ix.phone]; a.w += r[ix.web]; m.set(r[ix[key]], a); }); return [...m.entries()].sort((x, y) => y[1].n - x[1].n); };
  const bar = (l, v, tot, c) => el("div", { class: "bar-row", style: `--c:${c}` }, el("span", { title: l }, l), el("i", {}, el("b", { style: `width:${v / tot * 100}%` })), el("em", {}, fmt(v)));
  $("#pgBasis").replaceChildren(...group("basis").map(([l, a]) => bar(l, a.n, n, l === "Unclassified" ? "var(--rose)" : "var(--teal)")));
  $("#pgRegion").replaceChildren(...group("region").map(([l, a]) => el("div", { class: "bar-row", style: `--c:${REGION_COLOR[l] || "#888"}` }, el("span", {}, l), el("i", {}, el("b", { style: `width:${a.c / a.n * 100}%` })), el("em", {}, pct(a.c, a.n) + "% of " + fmt(a.n)))));
  const t = el("table", { class: "ptable" }, el("thead", {}, el("tr", {}, ...["Source list", "Records", "Country assigned", "Email", "Phone", "Website"].map(h => el("th", {}, h)))),
    el("tbody", {}, ...group("source").slice(0, 80).map(([l, a]) => el("tr", {}, el("td", { title: l }, l), el("td", { class: "mono" }, fmt(a.n)),
      el("td", {}, el("span", { class: "mini" }, el("b", { style: `width:${a.c / a.n * 100}%` })), " " + pct(a.c, a.n) + "%"), el("td", { class: "mono" }, pct(a.e, a.n) + "%"), el("td", { class: "mono" }, pct(a.p, a.n) + "%"), el("td", { class: "mono" }, pct(a.w, a.n) + "%")))));
  $("#pgSources").replaceChildren(t);
}

/* ---------- map ---------- */
let world = null;
async function renderMapView() { renderRail(); if (!world) { world = await fetch("vendor/world-110m.json").then(r => r.json()); } drawMap(); }
function canonName(n) { return n in ATLAS_ALIAS ? ATLAS_ALIAS[n] : n; }
function drawMap() {
  const svg = d3.select("#map"); svg.selectAll("*").remove();
  const node = svg.node(); const W = node.clientWidth || 900, H = node.clientHeight || 600;
  svg.attr("viewBox", `0 0 ${W} ${H}`);
  const feats = topojson.feature(world, world.objects.countries).features.filter(f => f.properties.name !== "Antarctica");
  const proj = d3.geoNaturalEarth1().fitExtent([[10, 10], [W - 10, H - 10]], { type: "FeatureCollection", features: feats });
  const path = d3.geoPath(proj);
  const max = d3.max(S.manifest.countries, c => c.n);
  const style = getComputedStyle(root); const base = style.getPropertyValue("--map0").trim();
  const fill = c => { const t = Math.pow(Math.log(c.n + 1) / Math.log(max + 1), .8); return d3.interpolateRgb(base, REGION_COLOR[c.region] || "#888")(.25 + .75 * t); };
  const g = svg.append("g");
  const tip = $("#tip");
  const showTip = (ev, c) => { tip.hidden = false; tip.innerHTML = `<b>${esc(c.country)}</b><span class="mono">${esc(c.region)}</span><br>${fmt(c.n)} records · ${fmt(c.email)} emails<br><span class="mono">click to open</span>`;
    const r = $(".stage").getBoundingClientRect(); tip.style.left = Math.min(ev.clientX - r.left + 14, r.width - 220) + "px"; tip.style.top = Math.min(ev.clientY - r.top + 14, r.height - 90) + "px"; };
  const matched = new Set();
  g.selectAll("path").data(feats).join("path").attr("d", path).attr("class", "land")
    .each(function (f) { const nm = canonName(f.properties.name); const c = nm && S.byCountry.get(nm); const p = d3.select(this);
      if (c) { matched.add(nm); p.classed("has", true).attr("fill", fill(c)).attr("data-region", c.region).attr("tabindex", 0).attr("role", "link").attr("aria-label", `${c.country}: ${c.n} records`)
        .on("mousemove", ev => showTip(ev, c)).on("mouseleave", () => tip.hidden = true).on("click", () => location.hash = "#/c/" + encodeURIComponent(c.country))
        .on("keydown", ev => { if (ev.key === "Enter") location.hash = "#/c/" + encodeURIComponent(c.country); }); }
      else p.attr("fill", base); });
  const rad = d3.scaleSqrt().domain([1, max]).range([4, 16]);
  g.selectAll("circle").data(S.manifest.countries.filter(c => !matched.has(c.country) && DOTS[c.country] && proj(DOTS[c.country]))).join("circle").attr("class", "dot")
    .attr("cx", c => proj(DOTS[c.country])[0]).attr("cy", c => proj(DOTS[c.country])[1]).attr("r", c => rad(c.n)).attr("fill", c => REGION_COLOR[c.region]).attr("data-region", c => c.region)
    .on("mousemove", (ev, c) => showTip(ev, c)).on("mouseleave", () => tip.hidden = true).on("click", (ev, c) => location.hash = "#/c/" + encodeURIComponent(c.country));
  const zoom = d3.zoom().scaleExtent([1, 14]).on("zoom", ev => g.attr("transform", ev.transform)); svg.call(zoom);
  S.map = { svg, zoom, proj, W, H, g };
  $("#resetZoom").onclick = () => svg.transition().duration(500).call(zoom.transform, d3.zoomIdentity);
  $("#legend").innerHTML = "<div style='margin-bottom:4px'>Shade = number of records (log scale)</div>" +
    regionTotals().filter(r => r.name !== "Unclassified").map(r => `<div class="row"><i style="background:${REGION_COLOR[r.name]}"></i>${esc(r.name)}</div>`).join("");
}
function zoomToRegion(name) {
  const m = S.map; if (!m) return; const box = REGION_VIEW[name]; if (!box) return;
  const [[x0, y0], [x1, y1]] = [m.proj(box[0]), m.proj(box[1])]; const xa = Math.min(x0, x1), xb = Math.max(x0, x1), ya = Math.min(y0, y1), yb = Math.max(y0, y1);
  const k = Math.min(10, .85 / Math.max((xb - xa) / m.W, (yb - ya) / m.H));
  m.svg.transition().duration(650).call(m.zoom.transform, d3.zoomIdentity.translate(m.W / 2, m.H / 2).scale(k).translate(-(xa + xb) / 2, -(ya + yb) / 2));
}
function highlightRegion(name) { d3.selectAll("#map .land.has, #map .dot").classed("dim", function () { return name && this.getAttribute("data-region") !== name; }); }
function renderRail() {
  const rail = $("#rail"); rail.innerHTML = ""; const regs = regionTotals(); const max = regs[0].n;
  rail.append(el("h3", {}, "Regions"));
  regs.forEach(r => {
    const c = REGION_COLOR[r.name];
    const card = el("div", { class: "rg", style: `--c:${c}`, tabindex: 0, role: "button", "aria-label": `${r.name}: ${r.n} records` });
    card.innerHTML = `<div class="r1"><span class="nm"><i class="sw"></i>${esc(r.name)}</span><span class="n">${fmt(r.n)}</span></div>
      <div class="bar"><i style="width:${Math.max(2, r.n / max * 100)}%"></i></div>
      <div class="meta"><span>${r.countries.length} countries</span><span>${fmt(r.email)} emails</span><span>${fmt(r.phone)} phones</span></div>
      <div class="subs"></div>`;
    const subs = $(".subs", card);
    r.countries.slice(0, 12).forEach(ct => subs.append(el("div", { class: "ct", onclick: ev => { ev.stopPropagation(); location.hash = "#/c/" + encodeURIComponent(ct.country); } }, el("span", {}, ct.country), el("span", {}, fmt(ct.n)))));
    if (r.countries.length > 12) subs.append(el("div", { class: "dim", style: "padding:4px 2px;font-size:12px" }, `+ ${r.countries.length - 12} more, filter inside the region view`));
    subs.append(el("button", { class: "btn primary small openall", onclick: ev => { ev.stopPropagation(); location.hash = "#/r/" + encodeURIComponent(r.name); } }, `Open all ${fmt(r.n)} records →`));
    const act = () => { const was = card.classList.contains("open"); rail.querySelectorAll(".rg.open").forEach(x => x.classList.remove("open")); if (!was) { card.classList.add("open"); zoomToRegion(r.name); highlightRegion(r.name); } else { highlightRegion(null); S.map && S.map.svg.transition().duration(500).call(S.map.zoom.transform, d3.zoomIdentity); } };
    card.addEventListener("click", act); card.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); act(); } });
    card.addEventListener("dblclick", () => location.hash = "#/r/" + encodeURIComponent(r.name));
    card.addEventListener("mouseenter", () => { if (!rail.querySelector(".rg.open")) highlightRegion(r.name); }); card.addEventListener("mouseleave", () => { if (!rail.querySelector(".rg.open")) highlightRegion(null); });
    rail.append(card);
  });
  rail.append(el("p", { class: "dim", style: "font-size:12px;margin:12px 4px" }, "Click a region to zoom and preview countries. Double-click, or use the button, to open its records. Click any country on the map to open it directly."));
}

/* ---------- data loading ---------- */
async function loadCountry(name) {
  if (S.cache.has(name)) return S.cache.get(name);
  const c = S.byCountry.get(name); const j = await getJSON("data/" + c.file);
  const rows = j.rows.map(a => ({ a, country: name, region: c.region, id: a[0] })); rows.cols = j.cols; S.cache.set(name, rows); return rows;
}
async function loadMany(names, onProg) {
  const out = new Array(names.length); let done = 0, i = 0;
  await Promise.all(Array.from({ length: 6 }, async () => { while (i < names.length) { const k = i++; out[k] = await loadCountry(names[k]); onProg && onProg(++done, names.length); } }));
  return out;
}

/* ---------- data view ---------- */
const COLDEFS = [
  { k: "Display Name", label: "Name", w: 250, def: 1, grp: "Identity" }, { k: "Record Type", label: "Type", w: 120, def: 1, grp: "Identity" },
  { k: "Country", label: "Country", w: 140, def: 1, grp: "Location" }, { k: "City", label: "City", w: 130, def: 1, grp: "Location" },
  { k: "Public Email", label: "Email", w: 250, def: 1, grp: "Contact" }, { k: "Phone", label: "Phone", w: 160, def: 1, grp: "Contact" },
  { k: "Website", label: "Website", w: 210, def: 1, grp: "Contact" }, { k: "Contact Person", label: "Contact person", w: 160, def: 1, grp: "Contact" },
  { k: "_status", label: "Status", w: 130, def: 1, grp: "Workflow" }, { k: "_star", label: "★", w: 44, def: 1, grp: "Workflow", noexp: 1 },
  { k: "Affiliated Agency", label: "Affiliated agency", w: 190, grp: "Identity" }, { k: "Region", label: "Region", w: 150, grp: "Location" }, { k: "Subregion", label: "Subregion", w: 150, grp: "Location" },
  { k: "Listed Region", label: "State / province", w: 130, grp: "Location" }, { k: "Office Address", label: "Office address", w: 300, grp: "Location" }, { k: "Office Country", label: "Office country", w: 130, grp: "Location" },
  { k: "All Markets", label: "All markets", w: 200, grp: "Location" }, { k: "Other Public Emails", label: "Other emails", w: 220, grp: "Contact" },
  { k: "Recruitment Destination", label: "Destination", w: 160, grp: "Source" }, { k: "Source Type", label: "Source type", w: 260, grp: "Source" }, { k: "Source URL", label: "Source URL", w: 240, grp: "Source" },
  { k: "Source Checked Date", label: "Checked", w: 110, grp: "Source" }, { k: "Data Completeness", label: "Completeness", w: 220, grp: "Source" }, { k: "Quality Score", label: "Quality (0-7)", w: 100, grp: "Source" },
  { k: "Individual Role Evidence", label: "Role evidence", w: 220, grp: "Identity" }, { k: "Group/Legal Name", label: "Legal name", w: 200, grp: "Identity" }, { k: "Trading Name", label: "Trading name", w: 180, grp: "Identity" },
  { k: "Additional Source URLs", label: "Other sources", w: 240, grp: "Source" }, { k: "Record ID", label: "Record ID", w: 100, grp: "Identity", mono: 1 },
  { k: "_note", label: "Note", w: 220, grp: "Workflow" }, { k: "_tags", label: "Tags", w: 150, grp: "Workflow" }, { k: "_owner", label: "Owner", w: 130, grp: "Workflow" },
];
const ROW_H = 38;
const getV = (row, k) => { // value for column key
  if (k === "Country") return row.country; if (k === "Region") return row.region;
  if (k === "Subregion") return S.byCountry.get(row.country)?.subregion || "";
  if (k[0] === "_") { const a = S.actions[row.id] || {}; return k === "_status" ? (a.s || "Not contacted") : k === "_star" ? (a.f ? "★" : "") : k === "_note" ? (a.n || "") : k === "_tags" ? (a.t || []).join(", ") : (a.o || ""); }
  const i = S.colIdx[k]; return i == null ? "" : row.a[i];
};

async function openScope(scope) {
  show("dataView"); S.scope = scope; S.sel = new Set(); S.open = null; S.sort = null;
  S.filt = { q: "", type: "all", email: false, phone: false, web: false, star: false, status: "", dest: "", country: "" };
  const isRegion = scope.type === "region";
  const regs = regionTotals(); const reg = isRegion ? regs.find(r => r.name === scope.name) : null; const ctry = !isRegion ? S.byCountry.get(scope.name) : null;
  if (isRegion && !reg) { location.hash = "#/map"; return; }
  const region = isRegion ? scope.name : ctry.region;
  crumbs([{ label: "World map", href: "#/map" }, isRegion ? { label: scope.name } : { label: region, href: "#/r/" + encodeURIComponent(region) }, ...(isRegion ? [] : [{ label: scope.name }])]);
  $("#dvTitle").textContent = scope.name; $("#dvTitle").style.color = REGION_COLOR[region];
  $("#dvSub").textContent = isRegion ? `${reg.countries.length} countries · ${fmt(reg.n)} records` : `${region} · ${fmt(ctry.n)} records`;
  S.cols = store.get("agents.cols." + (isRegion ? "r" : "c"), null) || COLDEFS.filter(c => c.def && !(c.k === "Country" && !isRegion && false)).map(c => c.k);
  $("#q").value = ""; $("#grid").classList.add("is-loading"); $("#gridLoading").hidden = false; $("#gridLoading").textContent = "Loading records…"; $("#gridEmpty").hidden = true;
  $("#gridRows").innerHTML = ""; $("#gridSpacer").style.height = "0px"; renderChips(null);
  const names = isRegion ? reg.countries.map(c => c.country) : [scope.name];
  const myScope = scope;
  const sets = await loadMany(names, (d, t) => { if (S.scope === myScope) $("#gridLoading").textContent = `Loading records… ${d}/${t} countries`; });
  if (S.scope !== myScope) return;
  S.colIdx = {}; sets[0].cols.forEach((c, i) => S.colIdx[c] = i);
  S.rows = sets.flat(); $("#gridLoading").hidden = true;
  S.rows.forEach(r => r._s = null);
  renderChips(isRegion ? reg : null); renderToolbar(); applyFilters();
}

function renderChips(reg) {
  const box = $("#dvChips"); box.innerHTML = ""; if (!reg) return;
  box.append(el("button", { class: "chip" + (!S.filt.country ? " on" : ""), onclick: () => { S.filt.country = ""; renderChips(reg); applyFilters(); } }, "All countries"));
  reg.countries.forEach(c => box.append(el("button", { class: "chip" + (S.filt.country === c.country ? " on" : ""), onclick: () => { S.filt.country = S.filt.country === c.country ? "" : c.country; renderChips(reg); applyFilters(); } }, c.country, el("span", { class: "n" }, fmt(c.n)))));
}

function renderToolbar() {
  const seg = $("#typeSeg"); seg.innerHTML = "";
  [["all", "All"], ["agency", "Agencies"], ["individual", "Individuals"]].forEach(([k, l]) => seg.append(el("button", { class: S.filt.type === k ? "on" : "", onclick: () => { S.filt.type = k; renderToolbar(); applyFilters(); } }, l)));
  const f = $("#tbFilters"); f.innerHTML = "";
  [["email", "Has email"], ["phone", "Has phone"], ["web", "Has website"], ["star", "★ Starred"]].forEach(([k, l]) => f.append(el("button", { class: "tog" + (S.filt[k] ? " on" : ""), "aria-pressed": S.filt[k], onclick: () => { S.filt[k] = !S.filt[k]; renderToolbar(); applyFilters(); } }, l)));
  const st = el("select", { "aria-label": "Status", onchange: e => { S.filt.status = e.target.value; applyFilters(); } }, el("option", { value: "" }, "Any status"), ...STATUSES.map(s => el("option", { value: s }, s)));
  st.value = S.filt.status; f.append(st);
  const dests = [...new Set(S.rows.map(r => getV(r, "Recruitment Destination")).filter(Boolean))].sort();
  const ds = el("select", { "aria-label": "Destination", onchange: e => { S.filt.dest = e.target.value; applyFilters(); } }, el("option", { value: "" }, "Any destination"), ...dests.slice(0, 60).map(s => el("option", { value: s }, s)));
  ds.value = S.filt.dest; f.append(ds);
}
$("#q").addEventListener("input", debounce(e => { S.filt.q = e.target.value; applyFilters(); }, 160));
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

function searchStr(r) { return r._s ??= [r.country, ...["Display Name", "City", "Public Email", "Phone", "Contact Person", "Affiliated Agency", "Office Address", "Website", "Other Public Emails", "Trading Name", "Group/Legal Name", "Record ID"].map(k => getV(r, k))].join(" \u0001 ").toLowerCase(); }
function applyFilters() {
  const f = S.filt; const toks = f.q.toLowerCase().split(/\s+/).filter(Boolean);
  const isInd = r => getV(r, "Record Type") === "Individual";
  let v = S.rows.filter(r => {
    if (f.country && r.country !== f.country) return false;
    if (f.type === "agency" && isInd(r)) return false; if (f.type === "individual" && !isInd(r)) return false;
    if (f.email && !getV(r, "Public Email")) return false; if (f.phone && !getV(r, "Phone")) return false; if (f.web && !getV(r, "Website")) return false;
    if (f.star && !S.actions[r.id]?.f) return false;
    if (f.status && getV(r, "_status") !== f.status) return false;
    if (f.dest && !getV(r, "Recruitment Destination").split(";").map(x => x.trim()).includes(f.dest)) return false;
    if (toks.length) { const s = searchStr(r); for (const t of toks) if (!s.includes(t)) return false; }
    return true;
  });
  S.view = v; sortView(); renderGrid(true); updateStatus(); updateSelBar();
}
const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });
function sortView() {
  if (!S.sort) return; const { k, dir } = S.sort;
  const keyed = S.view.map(r => [getV(r, k), r]);
  keyed.sort((a, b) => { const x = a[0], y = b[0]; if (!x && y) return 1; if (x && !y) return -1; return dir * collator.compare(x, y); });
  S.view = keyed.map(x => x[1]);
}
function updateStatus() {
  const cnt = S.view.length; const withE = S.view.reduce((a, r) => a + (getV(r, "Public Email") ? 1 : 0), 0);
  $("#statusline").innerHTML = `<span>${fmt(cnt)} of ${fmt(S.rows.length)} records shown · ${fmt(withE)} with email</span><span>${S.sync.label}</span>`;
}

/* grid */
function colList() { return S.cols.map(k => COLDEFS.find(c => c.k === k)).filter(Boolean); }
const colW = c => S.widths[c.k] || c.w;
function renderHead() {
  const h = $("#gridHead"); h.innerHTML = ""; const inner = el("div", { style: "display:flex;min-width:100%", id: "headInner" });
  const chk = el("div", { class: "gc chk", style: "width:42px" }, el("input", { type: "checkbox", "aria-label": "Select all filtered records", id: "selAll",
    onchange: e => { if (e.target.checked) S.view.forEach(r => S.sel.add(r.id)); else S.sel.clear(); renderRows(); updateSelBar(); } }));
  inner.append(chk);
  colList().forEach(c => { const th = el("div", { class: "gh" + (S.sort?.k === c.k ? " sorted" : ""), style: `width:${colW(c)}px`, title: "Click to sort", onclick: () => {
      S.sort = S.sort?.k === c.k ? (S.sort.dir === 1 ? { k: c.k, dir: -1 } : null) : { k: c.k, dir: 1 }; applyFilters(); } }, c.label + (S.sort?.k === c.k ? (S.sort.dir === 1 ? " ↑" : " ↓") : ""));
    const rs = el("span", { class: "rs", onclick: e => e.stopPropagation(), onmousedown: e => { e.preventDefault(); e.stopPropagation(); const x0 = e.clientX, w0 = colW(c);
      const mv = ev => { S.widths[c.k] = Math.max(60, w0 + ev.clientX - x0); th.style.width = S.widths[c.k] + "px"; };
      const up = () => { removeEventListener("mousemove", mv); removeEventListener("mouseup", up); store.set("agents.widths", S.widths); renderGrid(false); }; addEventListener("mousemove", mv); addEventListener("mouseup", up); } });
    th.append(rs); inner.append(th); });
  h.append(inner);
}
function totalW() { return 42 + colList().reduce((a, c) => a + colW(c), 0); }
function renderGrid(resetScroll) {
  renderHead(); const body = $("#gridBody");
  $("#gridSpacer").style.height = S.view.length * ROW_H + "px"; $("#gridSpacer").style.width = totalW() + "px";
  $("#gridRows").style.width = totalW() + "px"; $("#gridEmpty").hidden = S.view.length > 0;
  if (resetScroll) body.scrollTop = 0; renderRows();
}
let raf = 0;
$("#gridBody").addEventListener("scroll", () => { $("#headInner").style.transform = `translateX(${-$("#gridBody").scrollLeft}px)`; cancelAnimationFrame(raf); raf = requestAnimationFrame(renderRows); });
function cell(r, c) {
  const v = getV(r, c.k); const d = el("div", { class: "gc" + (c.mono ? " mono" : ""), style: `width:${colW(c)}px`, title: v });
  if (!v && c.k !== "_status") return d;
  if (c.k === "Public Email") { d.append(el("a", { href: "mailto:" + v.split(/[;,\s]/)[0], onclick: e => e.stopPropagation() }, v)); }
  else if (c.k === "Website") { const u = safeUrl(v); d.append(u ? el("a", { href: u, target: "_blank", rel: "noopener noreferrer", onclick: e => e.stopPropagation() }, v.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")) : v); }
  else if (c.k === "Source URL") { const u = safeUrl(v); d.append(u ? el("a", { href: u, target: "_blank", rel: "noopener noreferrer", onclick: e => e.stopPropagation() }, v.replace(/^https?:\/\/(www\.)?/, "")) : v); }
  else if (c.k === "Phone") { d.append(el("a", { href: "tel:" + v.replace(/[^\d+]/g, ""), onclick: e => e.stopPropagation() }, v)); }
  else if (c.k === "_status") { d.append(el("span", { class: "st s-" + slug(v).replace(/-/g, "") }, v)); }
  else if (c.k === "_star") { d.append(el("button", { class: "star" + (S.actions[r.id]?.f ? " on" : ""), "aria-label": "Star", onclick: e => { e.stopPropagation(); setAction([r.id], { f: !S.actions[r.id]?.f }); } }, "★")); }
  else if (c.k === "Display Name") { d.style.fontWeight = 600; d.textContent = v; }
  else d.textContent = v;
  return d;
}
function renderRows() {
  const body = $("#gridBody"), box = $("#gridRows"); const top = body.scrollTop, hgt = body.clientHeight;
  const a = Math.max(0, Math.floor(top / ROW_H) - 6), b = Math.min(S.view.length, Math.ceil((top + hgt) / ROW_H) + 6);
  const frag = document.createDocumentFragment(); const cl = colList(); let last = null;
  for (let i = a; i < b; i++) { const r = S.view[i]; const on = S.sel.has(r.id);
    const row = el("div", { class: "gr" + (on ? " sel" : "") + (S.open === r.id ? " open" : ""), style: `top:${i * ROW_H}px;width:${totalW()}px`, "data-i": i, onclick: e => { if (e.target.closest("input,a,button")) return; openDrawer(r); } });
    const cb = el("input", { type: "checkbox", "aria-label": "Select record", onclick: e => { e.stopPropagation(); const sh = e.shiftKey && last != null;
      if (sh) { const [x, y] = [Math.min(last, i), Math.max(last, i)]; for (let j = x; j <= y; j++) e.target.checked ? S.sel.add(S.view[j].id) : S.sel.delete(S.view[j].id); }
      else e.target.checked ? S.sel.add(r.id) : S.sel.delete(r.id); lastSel = i; updateSelBar(); renderRows(); } });
    cb.checked = on; last = lastSel; row.append(el("div", { class: "gc chk" }, cb)); cl.forEach(c => row.append(cell(r, c))); frag.append(row); }
  box.replaceChildren(frag);
  const all = $("#selAll"); if (all) { all.checked = S.view.length > 0 && S.sel.size >= S.view.length && S.view.every(r => S.sel.has(r.id)); all.indeterminate = !all.checked && S.sel.size > 0; }
}
let lastSel = null;

/* selection bar + bulk actions */
const rowsById = () => { if (!S._byId || S._byIdFor !== S.rows) { S._byId = new Map(S.rows.map(r => [r.id, r])); S._byIdFor = S.rows; } return S._byId; };
const selRows = () => { const m = rowsById(); return [...S.sel].map(id => m.get(id)).filter(Boolean); };
function updateSelBar() {
  const n = S.sel.size; $("#selbar").hidden = !n; if (!n) return;
  $("#selCount").textContent = `${fmt(n)} selected` + (n < S.view.length ? ` of ${fmt(S.view.length)} shown` : "");
  const box = $("#selActions"); box.innerHTML = "";
  if (n < S.view.length) box.append(el("button", { class: "btn small", onclick: () => { S.view.forEach(r => S.sel.add(r.id)); renderRows(); updateSelBar(); } }, `Select all ${fmt(S.view.length)}`));
  const st = el("select", { "aria-label": "Set status for selected", onchange: e => { if (e.target.value) { setAction([...S.sel], { s: e.target.value }); toast(`Status set on ${fmt(n)} records`); } e.target.value = ""; } },
    el("option", { value: "" }, "Set status…"), ...STATUSES.map(s => el("option", { value: s }, s)));
  box.append(st,
    el("button", { class: "btn small", onclick: () => { setAction([...S.sel], { f: true }); toast("Starred"); } }, "★ Star"),
    el("button", { class: "btn small", onclick: bulkTag }, "Add tag"),
    el("button", { class: "btn small", onclick: bulkOwner }, "Assign owner"),
    el("button", { class: "btn small", onclick: bulkNote }, "Add note"),
    el("button", { class: "btn small", onclick: copyEmails }, "Copy emails"),
    el("button", { class: "btn small", onclick: mailAll }, "Email (BCC)"),
    el("button", { class: "btn small primary", onclick: () => openExport("selected") }, "Export selected"));
}
$("#selClear").onclick = () => { S.sel.clear(); renderRows(); updateSelBar(); };
const emailsOf = rows => [...new Set(rows.flatMap(r => getV(r, "Public Email").split(/[;,\s]+/)).map(e => e.trim()).filter(e => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)))];
function copyEmails() { const e = emailsOf(selRows()); if (!e.length) return toast("No emails in selection"); navigator.clipboard.writeText(e.join("; ")).then(() => toast(`Copied ${fmt(e.length)} unique emails`), () => toast("Copy blocked by the browser")); }
function mailAll() { const e = emailsOf(selRows()); if (!e.length) return toast("No emails in selection"); const chunk = e.slice(0, 40); location.href = "mailto:?bcc=" + encodeURIComponent(chunk.join(",")); if (e.length > 40) toast(`Opened first 40 of ${fmt(e.length)}: mail links are length-limited. Use Copy emails for the rest.`); }
function promptModal(title, label, cb, ph = "") { const inp = el("input", { type: "text", placeholder: ph, style: "width:100%" });
  openModal(el("div", { class: "mbox" }, el("h2", {}, title), el("label", { class: "field" }, el("span", {}, label), inp),
    el("div", { class: "mfoot" }, el("button", { class: "btn", onclick: closeModal }, "Cancel"), el("button", { class: "btn primary", onclick: () => { if (inp.value.trim()) { cb(inp.value.trim()); closeModal(); } } }, "Apply")))); setTimeout(() => inp.focus(), 30);
  inp.addEventListener("keydown", e => { if (e.key === "Enter") { if (inp.value.trim()) { cb(inp.value.trim()); closeModal(); } } }); }
function bulkTag() { promptModal("Add tag", "Tag (added to every selected record)", t => { const ids = [...S.sel]; const patch = {}; ids.forEach(id => { const cur = S.actions[id]?.t || []; patch[id] = { t: [...new Set([...cur, t])] }; }); setActionEach(patch); toast(`Tagged ${fmt(ids.length)}`); }, "e.g. priority, uk-visit"); }
function bulkOwner() { promptModal("Assign owner", "Owner name", o => { setAction([...S.sel], { o }); toast("Owner assigned"); }); }
function bulkNote() { promptModal("Add note", "Note (appended to existing notes)", t => { const ids = [...S.sel]; const patch = {}; const stamp = new Date().toISOString().slice(0, 10); ids.forEach(id => { const cur = S.actions[id]?.n; patch[id] = { n: (cur ? cur + "\n" : "") + `[${stamp}] ${t}` }; }); setActionEach(patch); toast(`Note added to ${fmt(ids.length)}`); }); }

/* ---------- actions store + sync ---------- */
S.sync = { label: CFG.SYNC_URL ? "Sync: connecting…" : "Saved in this browser only" };
function paintSync() { const p = $("#syncpill"); p.textContent = S.sync.pill || (CFG.SYNC_URL ? "Sheet sync" : "Local only"); p.className = "pill " + (S.sync.cls || ""); p.title = S.sync.label; if (S.rows.length) updateStatus(); }
function persist() { store.set("agents.actions.v1", S.actions); store.set("agents.dirty.v1", S.dirty); }
function setAction(ids, patch) { const m = {}; ids.forEach(id => m[id] = patch); setActionEach(m); }
function setActionEach(map) {
  const now = new Date().toISOString();
  for (const [id, patch] of Object.entries(map)) { const cur = { ...(S.actions[id] || {}), ...patch, u: now }; if (!cur.s || cur.s === "Not contacted") delete cur.s; if (!cur.f) delete cur.f; if (!cur.t?.length) delete cur.t; if (!cur.n) delete cur.n; if (!cur.o) delete cur.o;
    if (Object.keys(cur).length <= 1) delete S.actions[id]; else S.actions[id] = cur; S.dirty[id] = now; }
  persist(); renderRows(); updateSelBar(); if (S.filt.status || S.filt.star) applyFilters(); if (S.open) refreshDrawer(); scheduleSync();
}
let syncT = 0; function scheduleSync() { if (!CFG.SYNC_URL) return; clearTimeout(syncT); S.sync = { pill: "Syncing…", cls: "warn", label: "Saving to Google Sheet…" }; paintSync(); syncT = setTimeout(pushSync, 1500); }
async function pushSync() {
  const ids = Object.keys(S.dirty); if (!ids.length) return;
  const batch = ids.map(id => ({ id, ...(S.actions[id] || { deleted: true }), ...(S.actions[id] ? {} : { u: S.dirty[id] }) }));
  try {
    for (let i = 0; i < batch.length; i += 500) { const res = await fetch(CFG.SYNC_URL, { method: "POST", headers: { "Content-Type": "text/plain" }, body: JSON.stringify({ key: CFG.SYNC_KEY, upsert: batch.slice(i, i + 500) }) });
      const j = await res.json(); if (!j.ok) throw new Error(j.error || "sync failed"); }
    ids.forEach(id => { if (S.dirty[id]) delete S.dirty[id]; }); persist(); S.sync = { pill: "Synced", cls: "ok", label: "All changes saved to Google Sheet" };
  } catch (e) { S.sync = { pill: "Sync failed", cls: "warn", label: "Sync failed, will retry: " + e.message }; setTimeout(scheduleSync, 15000); }
  paintSync();
}
async function pullSync() {
  if (!CFG.SYNC_URL) { paintSync(); return; }
  try { const j = await fetch(CFG.SYNC_URL + (CFG.SYNC_URL.includes("?") ? "&" : "?") + "key=" + encodeURIComponent(CFG.SYNC_KEY || "")).then(r => r.json()); if (!j.ok) throw new Error(j.error);
    for (const a of j.actions) { const mine = S.actions[a.id]; if (S.dirty[a.id]) continue; if (!mine || (a.u || "") > (mine.u || "")) S.actions[a.id] = { s: a.s, f: a.f, t: a.t, n: a.n, o: a.o, u: a.u }; }
    persist(); S.sync = { pill: "Synced", cls: "ok", label: "Loaded latest from Google Sheet" }; if (Object.keys(S.dirty).length) scheduleSync(); if (S.rows.length) { renderRows(); } }
  catch (e) { S.sync = { pill: "Offline", cls: "warn", label: "Could not reach sync endpoint: " + e.message }; }
  paintSync();
}
pullSync();

/* ---------- drawer ---------- */
function openDrawer(r) { S.open = r.id; refreshDrawer(); renderRows(); }
function closeDrawer() { const d = $("#drawer"); if (d && !d.hidden) { d.hidden = true; S.open = null; if (S.rows.length) renderRows(); } }
function refreshDrawer() {
  const r = rowsById().get(S.open); const d = $("#drawer"); if (!r) { d.hidden = true; return; } d.hidden = false;
  const a = S.actions[r.id] || {}; const email = getV(r, "Public Email"); const web = safeUrl(getV(r, "Website")); const src = safeUrl(getV(r, "Source URL"));
  d.innerHTML = ""; const prevFocus = document.activeElement;
  d.append(el("button", { class: "btn ghost x", "aria-label": "Close", onclick: closeDrawer }, "✕"), el("h2", {}, getV(r, "Display Name") || "(unnamed record)"),
    el("div", { class: "dim mono" }, `${r.id} · ${getV(r, "Record Type")}`),
    el("div", { class: "tags" }, el("span", { class: "chip" }, r.country), el("span", { class: "chip" }, r.region), ...(a.t || []).map(t => el("span", { class: "chip on" }, t))));
  const qa = el("div", { class: "qa" });
  if (email) { qa.append(el("a", { class: "btn small", href: "mailto:" + email.split(/[;,\s]/)[0] }, "Email"), el("button", { class: "btn small", onclick: () => navigator.clipboard.writeText(email).then(() => toast("Email copied")) }, "Copy email")); }
  if (web) qa.append(el("a", { class: "btn small", href: web, target: "_blank", rel: "noopener noreferrer" }, "Open website ↗"));
  if (src) qa.append(el("a", { class: "btn small", href: src, target: "_blank", rel: "noopener noreferrer" }, "View source ↗"));
  d.append(qa, el("h3", {}, "Workflow"));
  const sel = el("select", { onchange: e => setAction([r.id], { s: e.target.value }) }, ...STATUSES.map(s => el("option", { value: s }, s))); sel.value = a.s || "Not contacted";
  const own = el("input", { type: "text", value: a.o || "", placeholder: "Who owns this?", onchange: e => setAction([r.id], { o: e.target.value.trim() }) });
  const tags = el("input", { type: "text", value: (a.t || []).join(", "), placeholder: "comma, separated", onchange: e => setAction([r.id], { t: e.target.value.split(",").map(x => x.trim()).filter(Boolean) }) });
  const note = el("textarea", { placeholder: "Notes (saved when you click away)", onchange: e => setAction([r.id], { n: e.target.value.trim() }) }); note.value = a.n || "";
  d.append(el("label", { class: "field" }, el("span", {}, "Status"), sel), el("label", { class: "field" }, el("span", {}, "Owner"), own), el("label", { class: "field" }, el("span", {}, "Tags"), tags), el("label", { class: "field" }, el("span", {}, "Notes"), note),
    el("button", { class: "btn small", onclick: () => setAction([r.id], { f: !a.f }) }, a.f ? "★ Starred (click to unstar)" : "☆ Star this record"));
  if (a.u) d.append(el("div", { class: "dim mono", style: "margin-top:8px;font-size:11px" }, "Last changed " + a.u.replace("T", " ").slice(0, 16) + " UTC"));
  d.append(el("h3", {}, "Details")); const dl = el("dl");
  const skip = new Set(["Display Name", "Record Type", "Record ID", "Contact Status"]);
  const fields = ["Public Email", "Phone", "Contact Person", "Affiliated Agency", "Website", "City", "Listed Region", "Office Address", "Office Country", "All Markets", "Recruitment Destination", "Other Public Emails", "Trading Name", "Group/Legal Name", "Individual Role Evidence", "Source Type", "Source URL", "Additional Source URLs", "Source Checked Date", "Data Completeness", "Quality Score"];
  fields.forEach(k => { if (skip.has(k)) return; const v = getV(r, k); if (!v) return; const dd = el("dd"); if (/URL|Website/.test(k) && safeUrl(v.split(/[\s;|]+/)[0])) { v.split(/[\s;|]+/).filter(Boolean).slice(0, 8).forEach(u => { const sf = safeUrl(u); dd.append(sf ? el("div", {}, el("a", { href: sf, target: "_blank", rel: "noopener noreferrer" }, u)) : el("div", {}, u)); }); } else dd.textContent = v; dl.append(el("dt", {}, k), dd); });
  d.append(dl); if (prevFocus && d.contains(prevFocus) === false) {/* keep focus where it was */}
}
document.addEventListener("keydown", e => { if (e.key === "Escape") { if (!$("#modal").hidden) closeModal(); else closeDrawer(); } });

/* ---------- columns modal ---------- */
$("#colsBtn").onclick = () => {
  const groups = [...new Set(COLDEFS.map(c => c.grp))]; const sel = new Set(S.cols);
  const body = el("div"); groups.forEach(g => { const grid = el("div", { class: "colgrid" }); COLDEFS.filter(c => c.grp === g).forEach(c => grid.append(el("label", {}, el("input", { type: "checkbox", checked: sel.has(c.k), onchange: e => e.target.checked ? sel.add(c.k) : sel.delete(c.k) }), c.label)));
    body.append(el("div", { class: "msec" }, el("h4", {}, g), grid)); });
  openModal(el("div", { class: "mbox" }, el("h2", {}, "Columns"), el("p", { class: "sub" }, "Choose what the table shows. Drag column edges to resize."), body,
    el("div", { class: "mfoot" }, el("button", { class: "btn", onclick: () => { S.cols = COLDEFS.filter(c => c.def).map(c => c.k); store.set("agents.cols." + (S.scope.type === "region" ? "r" : "c"), S.cols); closeModal(); renderGrid(false); } }, "Reset"),
      el("button", { class: "btn primary", onclick: () => { S.cols = COLDEFS.filter(c => sel.has(c.k)).map(c => c.k); store.set("agents.cols." + (S.scope.type === "region" ? "r" : "c"), S.cols); closeModal(); renderGrid(false); } }, "Apply"))));
};

/* ---------- export ---------- */
$("#exportBtn").onclick = () => openExport(S.sel.size ? "selected" : "filtered");
function csvCell(v) { v = String(v ?? ""); if (/^[=@]/.test(v)) v = "'" + v; return /[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
function openExport(initScope) {
  const opt = { scope: initScope, cols: new Set(COLDEFS.filter(c => c.def && !c.noexp).map(c => c.k)), needEmail: false, dedupe: false, bom: true, name: slug(S.scope.name) + "-agents" };
  opt.cols.add("Record ID");
  const filtered = S.filt.q || S.filt.type !== "all" || S.filt.email || S.filt.phone || S.filt.web || S.filt.star || S.filt.status || S.filt.dest || S.filt.country;
  const scopes = [["selected", `Selected records`, S.sel.size], ["filtered", filtered ? "Current filtered view" : "Everything in this view", S.view.length], ...(filtered ? [["all", `All records in ${S.scope.name}`, S.rows.length]] : []), ["db", "Entire database (all regions)", S.manifest.total]];
  const mbox = el("div", { class: "mbox" }); const info = el("span", { class: "info" });
  const presets = { "Contact list": ["Display Name", "Record Type", "Country", "City", "Public Email", "Phone", "Website", "Contact Person"], "Emails only": ["Display Name", "Public Email"], "Everything": COLDEFS.filter(c => !c.noexp).map(c => c.k),
    "With workflow": ["Display Name", "Record Type", "Country", "City", "Public Email", "Phone", "Website", "_status", "_owner", "_tags", "_note"] };
  const render = async () => {
    mbox.innerHTML = ""; mbox.append(el("h2", {}, "Export CSV"), el("p", { class: "sub" }, "Choose which records and which columns. Opens cleanly in Excel and Google Sheets."));
    const radios = el("div", { class: "radios", role: "radiogroup" });
    scopes.forEach(([k, l, n]) => { const dis = k === "selected" && !n; radios.append(el("div", { class: "radio" + (opt.scope === k ? " on" : ""), role: "radio", "aria-checked": opt.scope === k, "aria-disabled": dis, tabindex: dis ? -1 : 0, onclick: () => { if (!dis) { opt.scope = k; render(); } }, onkeydown: e => { if (e.key === "Enter" && !dis) { opt.scope = k; render(); } } },
      el("input", { type: "radio", checked: opt.scope === k, disabled: dis, tabindex: -1 }), l, el("span", { class: "n" }, fmt(n) + " rows"))); });
    mbox.append(el("div", { class: "msec" }, el("h4", {}, "Records"), radios));
    const pr = el("div", { class: "mrow" }); Object.entries(presets).forEach(([n, ks]) => pr.append(el("button", { class: "btn small", onclick: () => { opt.cols = new Set(ks); render(); } }, n)));
    pr.append(el("button", { class: "btn small", onclick: () => { opt.cols = new Set(COLDEFS.filter(c => !c.noexp).map(c => c.k)); render(); } }, "Select all"), el("button", { class: "btn small", onclick: () => { opt.cols = new Set(); render(); } }, "None"));
    const colsBox = el("div"); [...new Set(COLDEFS.map(c => c.grp))].forEach(g => { const grid = el("div", { class: "colgrid" }); COLDEFS.filter(c => c.grp === g && !c.noexp).forEach(c => grid.append(el("label", {}, el("input", { type: "checkbox", checked: opt.cols.has(c.k), onchange: e => { e.target.checked ? opt.cols.add(c.k) : opt.cols.delete(c.k); info.textContent = `${opt.cols.size} columns`; } }), c.label))); colsBox.append(el("div", { style: "margin:8px 0" }, el("div", { class: "dim mono", style: "font-size:11px;margin-bottom:2px" }, g.toUpperCase()), grid)); });
    mbox.append(el("div", { class: "msec" }, el("h4", {}, "Columns"), pr, colsBox));
    const opts = el("div", { class: "colgrid" },
      el("label", {}, el("input", { type: "checkbox", checked: opt.needEmail, onchange: e => opt.needEmail = e.target.checked }), "Only rows with an email"),
      el("label", {}, el("input", { type: "checkbox", checked: opt.dedupe, onchange: e => opt.dedupe = e.target.checked }), "Remove duplicate emails"),
      el("label", {}, el("input", { type: "checkbox", checked: opt.bom, onchange: e => opt.bom = e.target.checked }), "Excel-safe encoding (UTF-8 BOM)"));
    const fn = el("input", { type: "text", value: opt.name, style: "width:260px", "aria-label": "File name", onchange: e => opt.name = e.target.value.replace(/[^\w.-]+/g, "-") || "agents" });
    mbox.append(el("div", { class: "msec" }, el("h4", {}, "Options"), opts, el("label", { class: "field", style: "margin-top:10px" }, el("span", {}, "File name"), fn)));
    info.textContent = `${opt.cols.size} columns`;
    mbox.append(el("div", { class: "mfoot" }, info, el("button", { class: "btn", onclick: closeModal }, "Cancel"),
      el("button", { class: "btn primary", id: "doExport", onclick: doExport }, "Download CSV")));
  };
  const doExport = async () => {
    if (!opt.cols.size) return toast("Pick at least one column");
    const btn = $("#doExport"); btn.disabled = true; btn.textContent = "Preparing…";
    let rows;
    if (opt.scope === "selected") rows = S.view.length === S.rows.length || S.sel.size ? selRows() : [];
    else if (opt.scope === "filtered") rows = S.view; else if (opt.scope === "all") rows = S.rows;
    else { const sets = await loadMany(S.manifest.countries.map(c => c.country), (d, t) => btn.textContent = `Loading ${d}/${t}…`); rows = sets.flat(); S.colIdx = S.colIdx; }
    if (opt.needEmail) rows = rows.filter(r => getV(r, "Public Email"));
    if (opt.dedupe) { const seen = new Set(); rows = rows.filter(r => { const e = getV(r, "Public Email").toLowerCase().trim(); if (!e) return true; if (seen.has(e)) return false; seen.add(e); return true; }); }
    const cols = COLDEFS.filter(c => opt.cols.has(c.k)); const lines = [cols.map(c => csvCell(c.label === "Email" ? "Public Email" : c.k[0] === "_" ? c.label : c.k)).join(",")];
    for (const r of rows) lines.push(cols.map(c => csvCell(c.k === "_tags" ? (S.actions[r.id]?.t || []).join("; ") : getV(r, c.k))).join(","));
    const blob = new Blob([(opt.bom ? "﻿" : "") + lines.join("\r\n") + "\r\n"], { type: "text/csv;charset=utf-8" });
    const a = el("a", { href: URL.createObjectURL(blob), download: `${opt.name}-${new Date().toISOString().slice(0, 10)}.csv` }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    closeModal(); toast(`Exported ${fmt(rows.length)} rows × ${cols.length} columns`);
  };
  openModal(mbox); render();
}

/* ---------- modal / toast ---------- */
function openModal(node) { const m = $("#modal"); m.innerHTML = ""; m.append(node); m.hidden = false; m.onclick = e => { if (e.target === m) closeModal(); }; }
function closeModal() { $("#modal").hidden = true; $("#modal").innerHTML = ""; }
let tt = 0; function toast(msg) { const t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(tt); tt = setTimeout(() => t.hidden = true, 3200); }
addEventListener("resize", debounce(() => { if (!$("#mapView").hidden && world) drawMap(); if (!$("#dataView").hidden) renderRows(); }, 200));
paintSync();
})();
