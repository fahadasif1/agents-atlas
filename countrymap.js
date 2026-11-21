/* UK agents map: Leaflet + clustering. Shows who is nearby (by distance) for the visible area or a searched postcode. */
(() => {
"use strict";
const A = () => window.__atlas;
const rad = d => d * Math.PI / 180;
function makeCountryMap(cfg) {
const P = cfg.key; // id prefix
let fitted = false, map, cluster, rows = [], places = [], ready = null, ref = null, refLabel = "", pin = null, ring = null, tiles = null, sel = null, timer = 0;
const F = { type: "all", email: false };
const $ = s => document.querySelector("#" + P + s);
const R = cfg.unit === "km" ? 6371 : 3958.8, U = cfg.unit === "km" ? "km" : "mi";
const miles = (a, b, c, d) => { const x = rad(c - a), y = rad(d - b), h = Math.sin(x / 2) ** 2 + Math.cos(rad(a)) * Math.cos(rad(c)) * Math.sin(y / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
const isPerson = r => r.type === "Individual";
const theme = () => document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");

function toRow(a, c) {
  const g = k => a[c.indexOf(k)] || "";
  return { id: g("Record ID"), name: g("Display Name") || g("Affiliated Agency") || g("Contact Person") || "(unnamed)", type: g("Record Type"), addr: g("Office Address"), city: g("City"),
    phone: g("Phone"), email: g("Public Email"), web: g("Website"), contact: g("Contact Person"), aff: g("Affiliated Agency"), pc: g("Postcode"),
    lat: +g("lat"), lng: +g("lng"), prec: g("prec"), area: g("area") };
}

function setTiles() {
  if (!tiles) tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).addTo(map);
  $("Map").classList.toggle("dark", theme() !== "light");
}

function visible() {
  return rows.filter(r => (F.type === "all" || (F.type === "individual" ? isPerson(r) : !isPerson(r))) && (!F.email || r.email));
}

function paintMarkers() {
  cluster.clearLayers();
  const ms = visible().map(r => {
    const m = L.circleMarker([r.lat, r.lng], { radius: 7, weight: 1.5, color: "#0b1220", fillColor: r.prec === "city" ? "#fbbf24" : "#2dd4bf", fillOpacity: .95 });
    m.on("click", () => select(r, false)); r._m = m; return m;
  });
  cluster.addLayers(ms);
}

function el(...a) { return A().el(...a); }

function detail(r, d) {
  const lines = [];
  if (r.addr) lines.push(el("div", { class: "uk-addr" }, r.addr));
  if (r.prec === "city") lines.push(el("div", { class: "uk-note" }, cfg.cityNote(r)));
  if (r.prec === "area") lines.push(el("div", { class: "uk-note" }, "Approximate: placed in " + r.area + " from the address; the exact building isn't geocoded."));
  if (r.contact) lines.push(el("div", {}, "Contact: ", r.contact));
  if (r.aff) lines.push(el("div", {}, "Agency: ", r.aff));
  const acts = [];
  if (r.phone) acts.push(el("a", { class: "btn small", href: "tel:" + r.phone.replace(/[^+\d]/g, "") }, r.phone));
  if (r.email) acts.push(el("a", { class: "btn small", href: "mailto:" + r.email.split(/[;,\s]+/)[0] }, "Email"));
  const w = r.web && A().safeUrl(r.web); if (w) acts.push(el("a", { class: "btn small", href: w, target: "_blank", rel: "noopener noreferrer" }, "Website"));
  acts.push(el("a", { class: "btn small", target: "_blank", rel: "noopener noreferrer", href: `https://www.google.com/maps/dir/?api=1&destination=${r.lat},${r.lng}` }, "Directions"));
  return el("div", { class: "uk-detail" }, ...lines, el("div", { class: "uk-acts" }, ...acts));
}

function card(r) {
  const d = r._d;
  const c = el("div", { class: "uk-card" + (sel === r ? " on" : ""), tabindex: "0", role: "button" },
    el("div", { class: "uk-row1" }, el("b", {}, r.name), el("span", { class: "uk-dist" }, d == null ? "" : (d < 0.1 ? "<0.1" : d.toFixed(1)) + " " + U)),
    el("div", { class: "uk-row2" }, el("span", { class: "uk-pc" }, cfg.cardPlace(r)), r.prec !== "postcode" ? el("span", { class: "tag" }, "approx.") : "", isPerson(r) ? el("span", { class: "tag" }, "person") : "",
      r.email ? el("span", { class: "tag ok" }, "email") : ""));
  if (sel === r) c.append(detail(r));
  const go = () => select(r, true);
  c.addEventListener("click", e => { if (!e.target.closest("a")) go(); });
  c.addEventListener("keydown", e => { if (e.key === "Enter" && e.target === c) go(); });
  return c;
}

let shown = [];
function refresh() {
  if (!map) return;
  const b = map.getBounds(), c = ref || map.getCenter(); const [la, ln] = Array.isArray(c) ? c : [c.lat, c.lng];
  const inView = visible().filter(r => b.contains([r.lat, r.lng]));
  inView.forEach(r => r._d = miles(la, ln, r.lat, r.lng));
  inView.sort((x, y) => x._d - y._d);
  shown = inView; const top = inView.slice(0, 80);
  const f = A().fmt;
  $("Sum").textContent = !inView.length ? "No agents in this part of the map. Zoom out or search elsewhere."
    : `${f(inView.length)} agent${inView.length === 1 ? "" : "s"} in view · nearest to ${ref ? refLabel : "the map centre"}` + (inView.length > top.length ? ` · showing ${top.length}` : "");
  const list = $("List"); list.innerHTML = ""; top.forEach(r => list.append(card(r)));
  if (sel) list.querySelector(".uk-card.on")?.scrollIntoView({ block: "nearest" });
}
const later = () => { clearTimeout(timer); timer = setTimeout(refresh, 120); };

function select(r, fly) {
  sel = r; if (fly) map.flyTo([r.lat, r.lng], Math.max(map.getZoom(), 15), { duration: .6 });
  L.popup({ closeButton: false, offset: [0, -4] }).setLatLng([r.lat, r.lng]).setContent(el("div", { class: "uk-pop" }, el("b", {}, r.name), el("div", {}, cfg.cardPlace(r)))).openOn(map);
  refresh();
}

function setRef(lat, lng, label, zoom) {
  ref = [lat, lng]; refLabel = label; sel = null;
  if (pin) map.removeLayer(pin); if (ring) map.removeLayer(ring);
  pin = L.marker(ref, { icon: L.divIcon({ className: "uk-pin", html: "<span></span>", iconSize: [22, 22], iconAnchor: [11, 11] }), keyboard: false }).addTo(map);
  ring = L.circle(ref, { radius: cfg.ringM, color: "#fb7185", weight: 1.5, dashArray: "5 5", fill: false }).addTo(map);
  map.flyTo(ref, zoom || 12, { duration: .7 }); map.once("moveend", refresh); refresh();
}

async function search(q) {
  q = q.trim().replace(/\s+/g, " "); if (!q) return;
  $("Sum").textContent = "Searching…";
  const hit = await cfg.search(q, places, rows);
  if (hit) return setRef(hit.lat, hit.lng, hit.label, hit.zoom);
  $("Sum").textContent = cfg.notFound;
}

function locate() {
  if (!navigator.geolocation) return A().toast("Location isn't available in this browser");
  navigator.geolocation.getCurrentPosition(p => setRef(p.coords.latitude, p.coords.longitude, "your location", 13), () => A().toast("Location permission was declined"), { timeout: 10000 });
}

function emails(list) { return [...new Set(list.flatMap(r => r.email.split(/[;,\s]+/)).map(e => e.trim().toLowerCase()).filter(e => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)))]; }

function exportCsv() {
  if (!shown.length) return A().toast("Nothing in view to export");
  const cols = ["Name", "Type", "Postcode", "Address", "City", "Phone", "Email", "Website", "Contact", "Distance (" + U + ")", "Location precision"];
  const csv = [cols, ...shown.map(r => [r.name, r.type, r.pc, r.addr, r.city, r.phone, r.email, r.web, r.contact, r._d.toFixed(2), r.prec])].map(l => l.map(A().csvCell).join(",")).join("\r\n");
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv" })), download: cfg.key + "-agents-nearby.csv" });
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

function init() {
  map = L.map(P + "Map", { zoomControl: true, minZoom: cfg.minZoom, maxBounds: cfg.maxBounds, maxBoundsViscosity: .8, preferCanvas: true });
  map.fitBounds(cfg.bounds);
  setTiles();
  new MutationObserver(setTiles).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  cluster = L.markerClusterGroup({ maxClusterRadius: 45, showCoverageOnHover: false, spiderfyOnMaxZoom: true, disableClusteringAtZoom: 18 });
  map.addLayer(cluster);
  map.on("moveend", later);
  map.on("click", () => { if (sel) { sel = null; map.closePopup(); refresh(); } });
  $("Search").addEventListener("submit", e => { e.preventDefault(); search($("Q").value); });
  $("Locate").addEventListener("click", locate);
  $("Type").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; F.type = b.dataset.v; [...$("Type").children].forEach(x => x.classList.toggle("on", x === b)); paintMarkers(); refresh(); });
  $("Email").addEventListener("change", e => { F.email = e.target.checked; paintMarkers(); refresh(); });
  $("Copy").addEventListener("click", () => { const e = emails(shown); if (!e.length) return A().toast("No emails in view"); navigator.clipboard.writeText(e.join("; ")).then(() => A().toast(`Copied ${e.length} unique emails`), () => A().toast("Copy blocked by the browser")); });
  $("Csv").addEventListener("click", exportCsv);
}

return {
  async open() {
    if (!ready) ready = (async () => {
      $("Sum").textContent = "Loading agents…";
      const d = await A().getJSON("data/" + cfg.key + ".json"); rows = d.rows.map(a => toRow(a, d.cols)); places = d.places || [];
      init(); paintMarkers(); refresh();
    })().catch(err => { ready = null; $("Sum").textContent = "Could not load data (" + err.message + ")"; });
    await ready; if (map) setTimeout(() => { map.invalidateSize(); if (!fitted) { fitted = true; map.fitBounds(cfg.bounds); } refresh(); }, 50);
  }
};
}

function buildView(cfg) {
  const k = cfg.key, s = document.createElement("section");
  s.id = k + "View"; s.className = "ukview view"; s.hidden = true;
  s.innerHTML = `<aside class="ukpanel">
    <form id="${k}Search" class="uk-search" autocomplete="off">
      <input id="${k}Q" type="search" placeholder="${cfg.placeholder}" aria-label="Search">
      <button class="btn primary" type="submit">Find</button>
      <button class="btn" type="button" id="${k}Locate" title="Use my location">◎</button>
    </form>
    <div class="uk-filters">
      <div class="seg" id="${k}Type" role="group" aria-label="Record type"><button data-v="all" class="on">All</button><button data-v="agency">Agencies</button><button data-v="individual">People</button></div>
      <label class="chk"><input type="checkbox" id="${k}Email"> Has email</label>
    </div>
    <div class="uk-sum" id="${k}Sum"></div>
    <div class="uk-list" id="${k}List"></div>
    <div class="uk-foot"><button class="btn small" id="${k}Copy">Copy emails</button><button class="btn small" id="${k}Csv">Export these CSV</button></div>
  </aside>
  <div class="ukmapwrap"><div id="${k}Map"></div></div>`;
  document.getElementById("app").append(s);
}

const jget = async u => { try { const r = await fetch(u); return r.ok ? (await r.json()).result : null; } catch { return null; } };
const CONFIGS = {
  uk: { key: "uk", unit: "mi", ringM: 4828, minZoom: 5, bounds: [[49.9, -7.8], [58.9, 1.8]], maxBounds: [[48, -13], [62.5, 4.5]],
    placeholder: "Postcode or town, e.g. M1 1AE", notFound: "Couldn't find that postcode or place. Try e.g. LE1 6TP, SW1A or Leicester.",
    cardPlace: r => r.pc || r.city || "—", cityNote: r => "No postcode on record: pin shown at the centre of " + (r.city || "the town") + ".",
    async search(q) {
      const c = q.toUpperCase().replace(/\s/g, ""); let res;
      if (/^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/.test(c) && (res = await jget("https://api.postcodes.io/postcodes/" + c))) return { lat: res.latitude, lng: res.longitude, label: res.postcode, zoom: 14 };
      if (/^[A-Z]{1,2}\d[A-Z\d]?$/.test(c) && (res = await jget("https://api.postcodes.io/outcodes/" + c)) && res.latitude) return { lat: res.latitude, lng: res.longitude, label: res.outcode, zoom: 12 };
      const pl = await jget("https://api.postcodes.io/places?limit=1&q=" + encodeURIComponent(q));
      return pl && pl[0] && pl[0].latitude ? { lat: pl[0].latitude, lng: pl[0].longitude, label: pl[0].name_1, zoom: 12 } : null;
    } },
  pk: { key: "pk", unit: "km", ringM: 5000, minZoom: 4, bounds: [[23.5, 60.8], [37.2, 77.2]], maxBounds: [[8, 42], [52, 96]],
    placeholder: "City or area, e.g. Gulberg Lahore, F-7 Islamabad", notFound: "No match. Try a city (Lahore, Karachi), an area (DHA Karachi) or an agent's name.",
    cardPlace: r => r.area || r.city || "—", cityNote: r => "Only the city is known: pin is spread around " + (r.city || "the city") + ", not the real location.",
    async search(q, places, rows) {
      const n = q.toLowerCase().replace(/[,]/g, " ").split(/\s+/).filter(Boolean);
      const score = p => { const t = p[0].toLowerCase().replace(/,/g, " "); return n.every(w => t.includes(w)) ? t.length : 1e9; };
      const best = places.map(p => [score(p), p]).filter(x => x[0] < 1e9).sort((a, b) => a[0] - b[0])[0];
      if (best) return { lat: best[1][1], lng: best[1][2], label: best[1][0], zoom: best[1][3] };
      const r = rows.find(r => n.every(w => r.name.toLowerCase().includes(w)));
      return r ? { lat: r.lat, lng: r.lng, label: r.name, zoom: 15 } : null;
    } }
};
window.COUNTRYMAPS = {};
for (const c of Object.values(CONFIGS)) { buildView(c); window.COUNTRYMAPS[c.key] = makeCountryMap(c); }
})();
