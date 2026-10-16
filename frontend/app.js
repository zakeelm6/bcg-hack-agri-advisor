/* Farm Advisor: a device-style website. Few words, icons first, the land and the Copilot on the home page.
   English is the source language; i18n.js translates to French and Arabic (right to left) after each render.
   - API reads are cached in localStorage; if the network fails the last copy is shown with an offline banner.
   - Writes (tasks, photos, soil tests, offers) go into a queue and are replayed through /api/sync.
   - The Copilot can listen (browser speech recognition) and speak (browser speech synthesis). */
(() => {
const $app = document.getElementById("app");
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage full or blocked: keep running */ } };

/* ---------- languages ---------- */
const LANGS = {
  en: { label: "EN", dir: "ltr", speech: "en-US", locale: "en-GB", name: "English" },
  fr: { label: "FR", dir: "ltr", speech: "fr-FR", locale: "fr-FR", name: "Français" },
  ar: { label: "عربي", dir: "rtl", speech: "ar-MA", locale: "ar-MA-u-nu-latn", name: "العربية" },
};
let lang = (() => {
  try { const v = localStorage.getItem("fa_lang"); if (LANGS[v]) return v; } catch { /* storage blocked */ }
  const n = (navigator.language || "").toLowerCase(); return n.startsWith("fr") ? "fr" : n.startsWith("ar") ? "ar" : "en";
})();
const tt = s => (lang !== "en" && window.FA_I18N) ? window.FA_I18N.tt(lang, s) : s;
const lt = (en, fr, ar) => lang === "fr" ? fr : lang === "ar" ? ar : en;
const L = p => p + (p.includes("?") ? "&" : "?") + "lang=" + lang;
const SKEY = () => "c:/api/state?lang=" + lang;
function translateTree(root) {
  if (lang === "en" || !root) return;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), nodes = [];
  while (w.nextNode()) nodes.push(w.currentNode);
  for (const n of nodes) { const raw = n.nodeValue, t = raw.trim(); if (!t) continue; const out = tt(t); if (out !== t) n.nodeValue = raw.replace(t, out); }
  root.querySelectorAll("[placeholder],[aria-label],[title]").forEach(el => ["placeholder", "aria-label", "title"].forEach(a => { const v = el.getAttribute(a); if (v && tt(v) !== v) el.setAttribute(a, tt(v)); }));
}
const langSwitch = () => `<span class="lang" role="group" aria-label="Language">${Object.entries(LANGS).map(([k, v]) => `<button data-lang="${k}" class="${lang === k ? "on" : ""}" title="${v.name}">${v.label}</button>`).join("")}</span>`;

/* ---------- icons (24px stroke icons) ---------- */
const ICONS = {
  home: '<path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  tasks: '<rect x="4" y="5" width="16" height="16" rx="3"/><path d="M8 3v4M16 3v4M4 10h16"/>',
  sell: '<path d="M4 9h16l-1.5 10a2 2 0 0 1-2 1.7H7.5a2 2 0 0 1-2-1.7zM8 9l3-5M16 9l-3-5"/>',
  bell: '<path d="M6 17V11a6 6 0 1 1 12 0v6l1.5 2h-15zM10 21h4"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
  leaf: '<path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14M5 19c2-4 5-7 9-9"/>',
  pin: '<path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  walk: '<path d="M4 18c3-8 8-2 11-8s3-3 5-4"/><circle cx="4" cy="18" r="1.5"/><circle cx="20" cy="6" r="1.5"/>',
  search: '<circle cx="11" cy="11" r="6"/><path d="M16 16l4 4"/>',
  drop: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.5 4.5l2 2M17.5 17.5l2 2M19.5 4.5l-2 2M6.5 17.5l-2 2"/>',
  sack: '<path d="M8 4h8l2 4v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V8zM6 8h12"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  camera: '<rect x="3" y="7" width="18" height="13" rx="3"/><circle cx="12" cy="13.5" r="3.5"/><path d="M8 7l1.5-3h5L16 7"/>',
  cloudoff: '<path d="M7 18a4 4 0 0 1 0-8 5 5 0 0 1 9.6-1A4.5 4.5 0 0 1 17 18zM3 3l18 18"/>',
  cloud: '<path d="M7 18a4 4 0 0 1 0-8 5 5 0 0 1 9.6-1A4.5 4.5 0 0 1 17 18zM9 21l-1 2M13 21l-1 2M17 21l-1 2"/>',
  flask: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3"/>',
  truck: '<path d="M2 6h11v10H2zM13 10h4l3 3v3h-7z"/><circle cx="6" cy="18" r="1.6"/><circle cx="17" cy="18" r="1.6"/>',
  school: '<path d="M3 10l9-6 9 6M5 10v9h14v-9M10 19v-5h4v5"/>',
  coop: '<path d="M3 20V9l9-5 9 5v11M9 20v-6h6v6"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>',
  bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  speaker: '<path d="M4 9v6h4l5 4V5L8 9zM16.5 9a4 4 0 0 1 0 6M19 7a7 7 0 0 1 0 10"/>',
  mute: '<path d="M4 9v6h4l5 4V5L8 9zM17 9l4 6M21 9l-4 6"/>',
  send: '<path d="M4 12l16-8-6 16-3-7z"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14-4M4 4v4h4M4 13a8 8 0 0 0 14 4M20 20v-4h-4"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  chev: '<path d="M9 5l7 7-7 7"/>',
};
const ic = (n, size = 24, w = 2) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n] || ""}</svg>`;

/* ---------- state, API cache, offline queue ---------- */
let S = null;                     // /api/state
let offline = !navigator.onLine;
let route = location.hash || "#/";
const ui = { series: null, hideZones: {}, layer: "vigor", day: null, alertFilter: "all", result: null, photo: null, photoNotes: null, loc: null, locMsg: "", walking: null, walkWatch: null, search: "", searchMsg: "", soil: { zone: "A", ph: "", om: "", moisture: "" }, soilMsg: "", land: null };

async function fetchJson(path, opts = {}, ms = 7000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(path, { ...opts, signal: ctl.signal });
    if (!r.ok) throw new Error(path + " " + r.status);
    return await r.json();
  } finally { clearTimeout(t); }
}
async function getCached(path) {
  try {
    const j = await fetchJson(path);
    lsSet("c:" + path, { t: Date.now(), j });
    offline = false;
    return j;
  } catch {
    offline = true;
    const c = lsGet("c:" + path, null);
    return c ? c.j : null;
  }
}
const getQ = () => lsGet("fa_queue", []);
const setQ = q => lsSet("fa_queue", q);
let flushing = false;
async function flush(manual = false) {
  const q = getQ();
  if (!q.length || flushing) return;
  const wasOffline = offline;
  flushing = true;
  try {
    const j = await fetchJson("/api/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ actions: q }) }, 15000);
    const failed = j.results.filter(r => !r.ok).length;
    setQ([]);
    offline = false;
    await loadState();
    if (failed) toast(`${q.length - failed} updates sent, ${failed} refused by the server`);
    else if (manual || wasOffline) toast("Everything is synced");   // silent when already online: nothing to announce
  } catch { offline = true; }
  flushing = false;
  render();
}
function enqueue(type, payload) {
  const q = getQ(); q.push({ type, payload, ts: Date.now() }); setQ(q);
  applyLocal(type, payload);
  flush();
}
function applyLocal(type, p) {      // optimistic update so the screen reflects the action immediately
  if (!S) return;
  if (type === "task_status") { const t = S.tasks.find(x => x.id === p.task_id); if (t) t.status = p.status; }
  if (type === "soil_test") {
    const rec = { zone_code: p.zone_code, ph: p.ph ?? null, om_pct: p.om_pct ?? null, moisture: p.moisture ?? null, age_days: 0, pending: true };
    S.soil_tests = (S.soil_tests || []).filter(t => t.zone_code !== p.zone_code).concat(rec);
    const z = S.zones.find(x => x.code === p.zone_code); if (z) z.soil_test = rec;
  }
  if (type === "offer_accept") { const c = lsGet("c:/api/offers", null); if (c) { c.j.offers.forEach(o => o.status = o.id === p.offer_id ? "accepted" : "declined"); lsSet("c:/api/offers", c); if (ui.offers) ui.offers = c.j; } }
  if (type === "listing") { ui.listingLocal = true; }
  lsSet(SKEY(), { t: Date.now(), j: S });
}
async function loadState(refresh = false) {
  const j = await getCached(`/api/state?lang=${lang}${refresh ? "&refresh=true" : ""}`);
  if (j) { S = j; lsSet(SKEY(), { t: Date.now(), j }); }
  else S = lsGet(SKEY(), null)?.j || lsGet("c:/api/state?lang=en", null)?.j || lsGet("c:/api/state?lang=fr", null)?.j || null;
}
async function loadLand() {         // the satellite picture of the land, if it was downloaded
  try { ui.land = await fetchJson("/static/land.json"); } catch { ui.land = null; }
}

/* ---------- helpers ---------- */
const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const wd = iso => WD[new Date(iso + "T12:00:00").getDay()];
const fmtDate = iso => new Date(iso + "T12:00:00").toLocaleDateString(LANGS[lang].locale, { day: "numeric", month: "short" });
const ND = { low: "#D9A64C", mid: "#9CCC6B", high: "#4C8A3A" };
const taskIcon = t => ({ irrigate: "drop", fertilize: "sack", inspect: "search" }[t] || "check");
const openTasks = () => (S?.tasks || []).filter(t => t.status === "open");
const unread = () => (S?.alerts || []).filter(a => a.unread).length;
const ageWords = d => d === 0 ? "today" : d === 1 ? "yesterday" : `${d} days ago`;
function toast(msg, action) {
  const cur = document.querySelector(".toast");
  if (cur && cur.querySelector("button") && !action) return;   // never replace an undo toast with a plain note
  cur?.remove();
  const d = document.createElement("div"); d.className = "toast"; d.textContent = tt(msg);
  if (action) { const b = document.createElement("button"); b.textContent = tt(action.label); b.onclick = () => { d.remove(); action.fn(); }; d.appendChild(b); }
  document.body.appendChild(d); setTimeout(() => d.remove(), action ? 6000 : 3200);
}
function km(a, b) { const R = 6371, r = x => x * Math.PI / 180; const dLat = r(b.lat - a.lat), dLon = r(b.lon - a.lon); const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLon / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); }
function areaHa(pts) {            // shoelace formula on a local flat projection, result in hectares
  if (pts.length < 3) return 0;
  const lat0 = pts[0].lat * Math.PI / 180, mx = 111320 * Math.cos(lat0), my = 110540;
  const xy = pts.map(p => [(p.lon - pts[0].lon) * mx, (p.lat - pts[0].lat) * my]);
  let a = 0; for (let i = 0; i < xy.length; i++) { const [x1, y1] = xy[i], [x2, y2] = xy[(i + 1) % xy.length]; a += x1 * y2 - x2 * y1; }
  return Math.abs(a / 2) / 10000;
}
const testLine = t => [t.ph != null ? "pH " + t.ph : "", t.om_pct != null ? "organic " + t.om_pct + "%" : "", t.moisture != null ? "moisture " + Math.round(t.moisture * 100) + "%" : ""].filter(Boolean).join(", ");
const vigorReal = () => (S?.zones || []).length > 0 && S.zones.every(z => String(z.ndvi_source).startsWith("sentinel-2"));

/* ---------- layout ---------- */
function banner() {
  const q = getQ().length;
  if (!offline && !q) return "";
  return `<div class="banner">${ic("cloudoff", 26)}<div><b>${offline ? "You are offline" : "Sending updates"}</b>${q ? `<span>${q} update${q > 1 ? "s" : ""} will sync ${offline ? "when you are online" : "now"}.</span>` : ""}</div></div>`;
}
const NAV = [["#/field", "home", "Field"], ["#/tasks", "tasks", "Tasks"], ["#/sell", "sell", "Sell"], ["#/alerts", "bell", "Alerts"], ["#/me", "user", "Me"]];
const dotFor = n => n[1] === "bell" && unread() ? '<i class="dot"></i>' : "";
function topbar(nav) {
  return `<header class="topbar"><a class="brand" href="#/">${ic("leaf", 26)}<span>Farm Advisor</span></a>
    <nav class="topnav" aria-label="Main">${NAV.map(n => `<button data-go="${n[0]}" class="${nav === n[0] ? "on" : ""}">${n[2]}${dotFor(n)}</button>`).join("")}</nav>
    <span class="topright">${langSwitch()}<button class="iconbtn" data-go="#/about" aria-label="About">${ic("info", 22)}</button></span></header>`;
}
const bottomNav = nav => `<nav class="nav" aria-label="Main">${NAV.map(n => `<button data-go="${n[0]}" class="${nav === n[0] ? "on" : ""}">${ic(n[1], 26)}<span>${n[2]}</span>${dotFor(n)}</button>`).join("")}</nav>`;
function shell({ title, nav, body }) {
  return `<div class="screen">${topbar(nav)}<main class="panel"><h1 class="pagetitle">${esc(title)}</h1>${banner()}${body}</main>${bottomNav(nav)}</div>`;
}

/* ---------- the land: Sentinel-2 picture of the surroundings with the four zones on top ---------- */
function landSvg(tight, margin = 20) {
  const z = S.zones, Ly = ui.layer, F = 155, fx = 240 - F / 2, fy = 240 - F / 2, r = tight ? 7.5 : 10.5, fs = tight ? 7 : 10.5;
  const vb = tight ? `${fx - margin} ${fy - margin} ${F + 2 * margin} ${F + 2 * margin}` : "0 0 480 480";
  const col = zn => {
    if (Ly === "vigor") return zn.ndvi < 0.45 ? ND.low : zn.ndvi < 0.65 ? ND.mid : ND.high;
    if (Ly === "moisture") return zn.moisture == null ? "#bbb" : zn.moisture < 0.23 ? ND.low : zn.moisture < 0.28 ? ND.mid : "#3A8F85";
    if (Ly === "trust") return zn.confidence === "High" ? ND.high : zn.confidence === "Medium" ? ND.mid : ND.low;
    const st = zn.soil_test; if (!st || st.ph == null) return "#CDB88E";
    return st.ph >= 5.5 && st.ph <= 7.5 ? ND.high : ND.low;
  };
  let s = `<svg viewBox="${vb}" width="100%" role="img" aria-label="Field map" class="landmap" style="direction:ltr">`;
  s += ui.land ? `<image href="/static/land.png?v=${esc(ui.land.date)}" x="0" y="0" width="480" height="480" preserveAspectRatio="none"/>` : `<rect x="0" y="0" width="480" height="480" fill="#B9D9BF"/>`;
  z.forEach(zn => {
    const x = fx + zn.col * F / 2, y = fy + zn.row * F / 2, w = F / 2, st = zn.soil_test;
    s += `<rect x="${x}" y="${y}" width="${w}" height="${w}" fill="${col(zn)}" fill-opacity=".62" stroke="#fff" stroke-width="1.4"/>`;
    s += `<text x="${x + 4}" y="${y + fs + 2}" font-size="${fs}" font-weight="700" fill="#fff" stroke="#1D2B1A" stroke-width=".5" paint-order="stroke">${zn.code}</text>`;
    const mid = (t, dy = 0, size = fs * 1.3) => `<text x="${x + w / 2}" y="${y + w / 2 + dy}" text-anchor="middle" font-size="${size}" font-weight="700" fill="#fff" stroke="#1D2B1A" stroke-width=".6" paint-order="stroke">${t}</text>`;
    if (Ly === "vigor") s += mid(zn.ndvi.toFixed(2), fs * 2.4 - w / 2);
    if (Ly === "moisture" && zn.moisture != null) s += mid(`${Math.round(zn.moisture * 100)}%`, fs * 2.4 - w / 2);
    if (Ly === "soil") s += st && st.ph != null ? mid("pH " + st.ph, fs * 2.4 - w / 2) : "";
    if (zn.has_sensor) s += `<circle cx="${x + w - r - 1}" cy="${y + w - r - 1}" r="${r * .62}" fill="#fff" stroke="#22401F" stroke-width="1.2"/><circle cx="${x + w - r - 1}" cy="${y + w - r - 1}" r="${r * .26}" fill="#22401F"/>`;
  });
  s += `<rect x="${fx}" y="${fy}" width="${F}" height="${F}" fill="none" stroke="#fff" stroke-width="2" stroke-dasharray="6 4"/>`;
  openTasks().forEach(t => {
    const cx = fx + t.x * F, cy = fy + t.y * F, k = r * 1.5 / 24;
    s += `<g data-go="#/task/${t.id}" style="cursor:pointer"><title>${esc(t.title)}</title><circle cx="${cx}" cy="${cy}" r="${r}" fill="#fff" stroke="#31572C" stroke-width="1.6"/><g transform="translate(${cx - r * .75} ${cy - r * .75}) scale(${k})" fill="none" stroke="#31572C" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">${ICONS[taskIcon(t.type)]}</g></g>`;
  });
  return s + "</svg>";
}
const legendBar = () => ui.layer === "soil"
  ? `<div class="legend"><span><i style="background:${ND.high}"></i>pH 5.5 to 7.5</span><span><i style="background:${ND.low}"></i>pH outside</span><span><i style="background:#CDB88E"></i>No test</span></div>`
  : `<div class="legendbar ${ui.layer}" role="img" aria-label="low to high"></div>`;
const LAYERS = [["vigor", "leaf", "Vigor"], ["moisture", "drop", "Moisture"], ["soil", "flask", "Soil"], ["trust", "shield", "Trust"]];
const layerChips = () => `<div class="layers">${LAYERS.map(l => `<button class="lchip ${ui.layer === l[0] ? "on" : ""}" data-layer="${l[0]}" aria-label="${l[2]}" title="${l[2]}">${ic(l[1], 20)}<span>${l[2]}</span></button>`).join("")}</div>`;
const landNote = () => ui.land ? `<div class="credit">Sentinel-2, ${esc(fmtDate(ui.land.date))}</div>` : "";

/* ---------- home: do this now, the land and the Copilot ---------- */
function homeScreen() {
  const f = S.field, open = openTasks(), first = open[0];
  const lvl = first ? ({ High: 3, Medium: 2, Low: 1 }[first.confidence] || 1) : 0;
  const hero = first
    ? `<button class="hero" data-go="#/task/${first.id}">
        <span class="circle">${ic(taskIcon(first.type), 32)}</span>
        <span class="hero-t"><span class="lbl">Do this now</span>
          <span class="hero-title">${esc(first.title)}</span>
          <span class="hero-when">${ic("clock", 16)} ${esc(first.when_text)}</span>
          <span class="hero-meta"><span class="meter sm" role="img" aria-label="How sure">${[1, 2, 3].map(i => `<i class="${i <= lvl ? "" : "off"}"></i>`).join("")}</span><span>${first.confidence}</span>${open.length > 1 ? `<span class="pill soft">+${open.length - 1} more today</span>` : ""}</span>
        </span><span class="hero-chev">${ic("chev", 28)}</span></button>`
    : `<div class="hero ok"><span class="circle">${ic("check", 30)}</span><span class="hero-t"><span class="hero-title">All good</span></span></div>`;
  return `<div class="screen home">${topbar("#/")}<main class="panel">${banner()}
    <div class="home-grid">
      <section>${hero}
        <div class="card landcard"><div class="landhead"><b>${esc(f.name)}</b><span>${f.area_ha} ha</span></div>${layerChips()}
        <div class="landwrap">${landSvg(true, 45)}</div>${legendBar()}${landNote()}</div></section>
      <section id="cp-slot" class="cp-slot" aria-label="Copilot"></section>
    </div></main>${bottomNav("#/")}</div>`;
}

/* ---------- field ---------- */
function fieldScreen() {
  const f = S.field, wx = S.weather, ts = openTasks(), tests = S.soil_tests || [];
  return shell({ title: `${f.name}`, nav: "#/field", body: `
    <div class="grid2"><div>
      <div class="card" style="padding:12px">${layerChips()}<div class="landwrap">${landSvg(true)}</div>${legendBar()}${landNote()}</div>
      ${chartCard()}</div>
    <div>
      <div class="card big-n"><div><div class="n">${ts.length}</div><div class="sub">tasks today</div></div><button class="btn sm" data-go="#/tasks">See tasks</button></div>
      <div class="card"><div class="lbl">Soil tests</div><div class="sub" style="margin:6px 0 10px">${tests.length ? tests.map(t => `Zone ${esc(t.zone_code)}: ${testLine(t)} (${ageWords(t.age_days)})`).join("<br>") : "None yet."}</div>
        <button class="btn sec sm" data-go="#/soil/${ui.soil.zone}">${ic("flask", 18)} Add a soil test</button></div>
      <div class="card"><div class="lbl">Weather</div><div class="wx">${wx.days.map(d => `<div>${wd(d.date)}<b>${d.rain ? d.rain.toFixed(0) + " mm" : ic("sun", 16)}</b>${Math.round(d.tmax)}&deg;</div>`).join("")}</div></div>
    </div></div>` });
}

/* ---------- vigor over time ---------- */
const ZCOL = { A: "var(--z-a)", B: "var(--z-b)", C: "var(--z-c)", D: "var(--z-d)" };
async function loadSeries() {
  const j = await getCached(L("/api/ndvi-series"));
  ui.series = j || { points: [], real: false, missing: true };
  render();
}
function chartCard() {
  const s = ui.series;
  const wrap = body => `<div class="card"><div class="lbl">Vigor over time</div>${body}</div>`;
  if (!s) return wrap('<div class="skel sk-block" aria-label="Loading..." role="status"></div>');
  if (!s.points.length) return wrap(`<div class="sub" style="margin-top:6px">${s.missing ? "Not saved on this device yet. Open this page once online." : "No time series yet."}</div>`);
  const pts = s.points, zones = [...new Set(pts.map(p => p.zone_code))].sort();
  const tm = d => new Date(d + "T12:00:00").getTime();
  const t0 = Math.min(...pts.map(p => tm(p.date))), t1 = Math.max(...pts.map(p => tm(p.date)));
  const vals = pts.map(p => p.ndvi), ymin = Math.max(0, Math.floor((Math.min(...vals) - 0.05) * 10) / 10), ymax = 1;
  const W = 520, H = 270, Lm = 40, R = 16, T = 14, B = 38;
  const X = ms => Lm + (t1 === t0 ? 0.5 : (ms - t0) / (t1 - t0)) * (W - Lm - R);
  const Y = v => T + (1 - (v - ymin) / (ymax - ymin)) * (H - T - B);
  const step = (ymax - ymin) > 0.55 ? 0.2 : 0.1;
  let g = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="NDVI of each zone over time" style="direction:ltr">`;
  for (let v = Math.ceil(ymin / step) * step; v <= ymax + 1e-9; v += step) g += `<line x1="${Lm}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--tx)" stroke-opacity=".12"/><text x="${Lm - 6}" y="${Y(v) + 4}" text-anchor="end" font-size="11" fill="var(--tx2)">${v.toFixed(1)}</text>`;
  if (0.7 > ymin && 0.7 < ymax) g += `<line x1="${Lm}" x2="${W - R}" y1="${Y(0.7)}" y2="${Y(0.7)}" stroke="#E9A23B" stroke-dasharray="5 4"/>`;
  const dates = [...new Set(pts.map(p => p.date))].sort();
  let lastX = -999;
  dates.forEach((d, i) => { const x = X(tm(d)); if (x - lastX >= 62 && (i === 0 || W - R - x >= 20 || i === dates.length - 1)) { g += `<text x="${x}" y="${H - 14}" text-anchor="middle" font-size="11" fill="var(--tx2)">${fmtDate(d)}</text>`; lastX = x; } });
  zones.filter(z => !ui.hideZones[z]).forEach(z => {
    const zp = pts.filter(p => p.zone_code === z).sort((a, b) => a.date.localeCompare(b.date));
    g += `<polyline fill="none" stroke="${ZCOL[z]}" stroke-width="2.5" stroke-linejoin="round" points="${zp.map(p => `${X(tm(p.date)).toFixed(1)},${Y(p.ndvi).toFixed(1)}`).join(" ")}"/>`;
    zp.forEach(p => { g += `<circle cx="${X(tm(p.date)).toFixed(1)}" cy="${Y(p.ndvi).toFixed(1)}" r="3.5" fill="${ZCOL[z]}"><title>${z}, ${fmtDate(p.date)}: ${p.ndvi.toFixed(2)}</title></circle>`; });
    const last = zp[zp.length - 1]; g += `<text x="${X(tm(last.date)) + 7}" y="${Y(last.ndvi) + 4}" font-size="12" font-weight="700" fill="${ZCOL[z]}">${z}</text>`;
  });
  g += "</svg>";
  const latest = zones.map(z => { const zp = pts.filter(p => p.zone_code === z).sort((a, b) => a.date.localeCompare(b.date)); return { z, v: zp[zp.length - 1].ndvi }; });
  const low = latest.reduce((a, b) => b.v < a.v ? b : a), others = latest.filter(x => x.z !== low.z);
  const gap = others.length ? (others.reduce((a, b) => a + b.v, 0) / others.length) - low.v : 0;
  const chips = zones.map(z => `<button class="chip ${ui.hideZones[z] ? "" : "on"}" data-ztoggle="${z}" style="${ui.hideZones[z] ? "" : `background:${ZCOL[z]};`}">${z}</button>`).join("");
  return wrap(`<div class="chips" style="margin:8px 0">${chips}</div>${g}${gap > 0.05 ? `<div class="sub" style="margin-top:6px"><b>Lowest: zone ${low.z}, ${low.v.toFixed(2)}</b></div>` : ""}`);
}

/* ---------- tasks ---------- */
function tasksScreen() {
  const today = new Date(); const days = [];
  for (let i = 0; i < 7; i++) { const d = new Date(today); d.setDate(d.getDate() + i); days.push(d); }
  const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const all = S.tasks.slice().sort((a, b) => (a.status === "open" ? 0 : 1) - (b.status === "open" ? 0 : 1) || a.when_date.localeCompare(b.when_date));
  const list = ui.day ? all.filter(t => t.when_date === ui.day) : all;
  const letters = lang === "fr" ? ["D", "L", "M", "M", "J", "V", "S"] : lang === "ar" ? ["ح", "ن", "ث", "ر", "خ", "ج", "س"] : ["S", "M", "T", "W", "T", "F", "S"];
  const strip = days.map((d, i) => `<button class="day ${i === 0 ? "today" : ""} ${ui.day === iso(d) ? "sel" : ""}" data-day="${iso(d)}">${letters[d.getDay()]}<b>${d.getDate()}</b>${S.tasks.some(t => t.when_date === iso(d) && t.status === "open") ? '<i class="tick"></i>' : ""}</button>`).join("");
  const cards = list.map(t => `<div class="card clickable task ${t.status !== "open" ? "off" : ""}" data-go="#/task/${t.id}">
      <span class="circle ${t.type === "irrigate" ? "amber" : ""}">${ic(taskIcon(t.type), 28)}</span>
      <div class="tt"><div class="ttl">${esc(t.title)}</div><div class="sub">${ic("clock", 14)} ${esc(t.when_text)}</div></div>
      ${t.status === "done" ? `<span class="pill dk">${ic("check", 16, 3)}</span>` : t.status === "skipped" ? '<span class="pill ol">&ndash;</span>' : ""}</div>`).join("");
  return shell({ title: "Tasks", nav: "#/tasks", body: `<div class="days">${strip}</div><div class="cards2">${cards || `<div class="card"><div class="sub">${ic("check", 18)} No task</div></div>`}</div>` });
}

function taskScreen(id) {
  const t = S.tasks.find(x => x.id === +id);
  if (!t) return shell({ title: "Task", nav: "#/tasks", body: '<div class="card">This task is no longer needed.</div>' });
  const lvl = { High: 3, Medium: 2, Low: 1 }[t.confidence] || 1;
  const det = (label, text) => `<details><summary>${label}</summary><div class="sub">${esc(text)}</div></details>`;
  return shell({ title: "Task", nav: "#/tasks", body: `
    <div class="grid2"><div><div class="card bigtask">
      <div class="row"><span class="circle ${t.type === "irrigate" ? "amber" : ""}" style="width:64px;height:64px">${ic(taskIcon(t.type), 34)}</span><div><div class="h">${esc(t.title)}</div><div class="sub">${ic("clock", 15)} ${esc(t.when_text)}</div></div></div>
      ${t.status === "open"
        ? `<div class="btns" style="margin:14px 0 4px"><button class="btn" data-act="done" data-id="${t.id}">${ic("check", 24, 3)} Done</button><button class="btn sec" data-act="skip" data-id="${t.id}">Cannot do it</button></div>`
        : `<div style="margin:14px 0 4px"><span class="pill ${t.status === "done" ? "dk" : "ol"}">${t.status === "done" ? "Done" : "Skipped"}</span></div>`}
      <div class="row" style="margin:10px 0 6px"><div class="meter">${[1, 2, 3].map(i => `<i class="${i <= lvl ? "" : "off"}"></i>`).join("")}</div><b style="font-size:14px">${t.confidence}</b></div>
      ${det("Why", t.why)}${det("Cost", t.cost)}${det("Plan B", t.plan_b)}${det("How sure", t.conf_reason)}</div></div>
    <div><div class="btns"><button class="btn sec" data-say="${t.id}">${ic("speaker", 22)} Listen</button><button class="btn sec" data-cp-open="1">${ic("mic", 22)} Copilot</button>${t.confidence !== "High" ? `<button class="btn sec" data-go="#/soil/${esc(t.zone_code)}">${ic("flask", 22)} Soil test</button>` : ""}</div></div></div>` });
}

function followScreen(id) {
  const t = S.tasks.find(x => x.id === +id);
  const chip = (r, e) => `<button class="chip big ${ui.result === r ? "on" : ""}" data-result="${r}">${e} ${r}</button>`;
  return shell({ title: "Follow up", nav: "#/tasks", body: `
    <div class="grid2"><div>
    <div class="card row"><span class="circle green">${ic("check", 26, 2.5)}</span><div><div style="font-weight:700;font-size:18px">Done</div><div class="sub">${t ? esc(t.title) : ""}</div></div></div>
    <label class="dropzone" for="ph">${ui.photo ? `<img src="${ui.photo}" alt="Photo of the field">` : `${ic("camera", 44)}<div style="font-weight:700;margin-top:6px">Photo</div>`}</label>
    <input id="ph" type="file" accept="image/*" capture="environment" hidden>${photoNotesCard()}</div>
    <div><div class="chips">${chip("Better", "+")}${chip("Same", "=")}${chip("Worse", "&minus;")}</div>
    <input type="text" id="note" placeholder="Note or yield (optional)">
    <button class="btn" data-act="save-follow" data-id="${id}">${ic("check", 24, 3)} Save</button></div></div>` });
}

function soilScreen(zoneParam) {
  if (zoneParam && S.zones.some(z => z.code === zoneParam)) ui.soil.zone = zoneParam;
  const sz = ui.soil.zone, tests = S.soil_tests || [];
  const zchips = S.zones.map(z => `<button class="chip big ${z.code === sz ? "on" : ""}" data-soilzone="${z.code}">${z.code}</button>`).join("");
  const field = (id, label, hint, val, step) => `<label class="fld"><span>${label}</span><input type="number" inputmode="decimal" step="${step}" id="${id}" value="${esc(val)}" placeholder="${hint}"></label>`;
  return shell({ title: "Soil test", nav: "#/field", body: `
    <div class="grid2"><div><div class="card"><div class="chips" style="margin:0 0 12px">${zchips}</div>
      ${field("soil-ph", "pH", "6.4", ui.soil.ph, "0.1")}${field("soil-om", "Organic matter (%)", "2.1", ui.soil.om, "0.1")}${field("soil-m", "Moisture (%)", "24", ui.soil.moisture, "1")}
      ${ui.soilMsg ? `<div class="sub" style="color:var(--danger);margin:0 0 10px">${esc(ui.soilMsg)}</div>` : ""}
      <button class="btn" data-act="save-soil">${ic("check", 24, 3)} Save</button></div></div>
    <div><div class="card"><div class="lbl">Saved tests</div><div class="sub" style="margin-top:6px">${tests.length ? tests.map(t => `Zone ${esc(t.zone_code)}: ${testLine(t)} (${ageWords(t.age_days)})${t.pending ? " - waiting to sync" : ""}`).join("<br>") : "None yet."}</div></div></div></div>` });
}

function alertsScreen() {
  const f = ui.alertFilter, Lb = { all: "All", weather: "Weather", crop: "Crop", data: "Data" };
  const list = S.alerts.filter(a => f === "all" || a.kind === f);
  const icn = { weather: "cloud", crop: "search", data: "flask" };
  const target = a => a.key.startsWith("sample:") || a.key.startsWith("ph:") ? `#/soil/${a.key.split(":")[1]}` : null;
  return shell({ title: "Alerts", nav: "#/alerts", body: `
    <div class="chips">${Object.entries(Lb).map(([k, n]) => `<button class="chip ${f === k ? "on" : ""}" data-filter="${k}">${n}</button>`).join("")}</div>
    <div class="cards2">${list.map(a => `<div class="card clickable task" data-read="${a.id}" ${target(a) ? `data-go="${target(a)}"` : ""} style="${a.unread ? "" : "opacity:.7"}"><span class="circle ${a.kind === "crop" ? "amber" : ""}">${ic(icn[a.kind] || "bell", 26)}</span><div class="tt"><div class="ttl">${esc(a.title)}</div><div class="sub">${esc(a.body)}</div></div>${a.unread ? '<i class="alert-dot"></i>' : ""}</div>`).join("") || `<div class="card sub">${ic("check", 18)} No alerts.</div>`}</div>` });
}

function sellScreen() {
  const F = ui.forecast, O = ui.offers;
  if (!F || !O) return shell({ title: "Sell", nav: "#/sell", body: '<div role="status" aria-label="Loading..."><div class="skel sk-card"></div><div class="skel sk-card"></div><div class="skel sk-card"></div></div>' });
  const listed = F.listing || ui.listingLocal;
  const mid = (F.qty_min_t + F.qty_max_t) / 2;
  const off = O.offers.map(o => `<div class="card task offer"><span class="circle">${ic(o.kind === "institution" ? "school" : o.kind === "trader" ? "truck" : "coop", 26)}</span><div class="tt"><div class="ttl">${esc(o.buyer)}</div><div class="sub"><b style="font-size:18px;color:var(--ink)">${o.price_mad_kg.toFixed(2)}</b> MAD/kg  -  ${(Math.round(mid * o.price_mad_kg) * 1000).toLocaleString("en-GB")} MAD</div></div>
      ${o.status === "open" ? `<button class="btn sm" data-act="accept" data-id="${o.id}">Accept</button>` : `<span class="pill ${o.status === "accepted" ? "dk" : "ol"}">${o.status === "accepted" ? "Accepted" : "Declined"}</span>`}</div>`).join("");
  return shell({ title: "Sell", nav: "#/sell", body: `
    <div class="grid2"><div><div class="card"><div class="lbl">Harvest <span class="pill ol" style="margin-inline-start:6px">Demo</span></div><div class="h" style="font-size:30px">${F.qty_min_t} to ${F.qty_max_t} t</div>
      <div class="sub">${ic("clock", 15)} ${fmtDate(F.window_start)} - ${fmtDate(F.window_end)}</div>
      <details style="margin-top:8px"><summary>Notes</summary><div class="sub">${esc(F.advice)} ${esc(F.note)}</div></details></div>
      <button class="btn" data-act="listing" ${listed ? "disabled" : ""}>${ic(listed ? "check" : "sell", 24, listed ? 3 : 2)} ${listed ? "Sale offer published" : "Create sale offer"}</button></div>
    <div>${off}</div></div>` });
}

function meScreen() {
  const q = getQ().length, f = S.field;
  return shell({ title: "Me", nav: "#/me", body: `
    <div class="grid2"><div><div class="card row"><span class="circle green">${ic("user", 28)}</span><div><div style="font-weight:700;font-size:17px">${esc(f.name)}</div><div class="sub">${f.area_ha} ha</div></div></div>
      <div class="card"><div class="lbl">Language</div><div style="margin-top:8px">${langSwitch()}</div></div>
      <div class="card"><div class="lbl">Copilot</div><div class="sub" style="margin-top:6px">${cp.status ? (cp.status.mode === "model" ? `Model: ${esc(cp.status.provider)}` : "Rule engine") : "?"}${cp.status && cp.status.vision ? " + photos" : ""}</div></div></div>
    <div><div class="card"><div class="lbl">Waiting to sync</div><div class="row" style="margin-top:8px"><b style="font-size:28px">${q}</b>${q ? '<button class="btn sm" data-act="sync">Sync now</button>' : `<span class="sub">${ic("check", 18)}</span>`}</div></div>
      <button class="btn sec" data-act="refresh">${ic("refresh", 22)} Refresh advice</button>
      <button class="btn sec" style="margin-top:10px" data-go="#/about">${ic("info", 22)} About</button></div></div>` });
}

/* ---------- about (the explanation for visitors) ---------- */
function aboutScreen() {
  const sel = ui.welcomeOpt || "gps";
  let detail = "";
  if (sel === "gps") {
    detail = ui.loc
      ? `<div class="sub">Located: ${ui.loc.lat.toFixed(4)}, ${ui.loc.lon.toFixed(4)} (about ${Math.round(ui.loc.acc)} m).${S?.field ? ` You are ${km(ui.loc, S.field).toFixed(0)} km from the demo field. The demo field stays fixed for now.` : ""}</div>`
      : `<div class="sub">${esc(ui.locMsg) || "GPS works without internet on a phone."}</div><button class="btn sec sm" style="margin-top:10px" data-act="locate">Find my position</button>`;
  } else if (sel === "walk") {
    const w = ui.walking;
    detail = w ? `<div class="sub">Recording: ${w.length} points. Walk around the edge of your field.</div><button class="btn sm" style="margin-top:10px" data-act="walk-stop">Stop and save</button>`
      : `<div class="sub">${ui.locMsg ? esc(ui.locMsg) : "Walk around the field with your phone."}</div><button class="btn sec sm" style="margin-top:10px" data-act="walk-start">Start walking</button>`;
  } else {
    detail = `<input type="text" id="vq" placeholder="Village name" value="${esc(ui.search)}"><div class="sub">${esc(ui.searchMsg) || "Needs a connection."}</div><button class="btn sec sm" style="margin-top:10px" data-act="search">Search</button>`;
  }
  const opt = (id, ico, t) => `<div class="option ${sel === id ? "on" : ""}" data-opt="${id}"><div class="row"><span class="circle ${sel === id ? "green" : ""}">${ic(ico, 26)}</span><div class="t">${t}</div></div>${sel === id ? `<div style="margin-top:12px">${detail}</div>` : ""}</div>`;
  const step = (n, ico, t, s) => `<div class="step"><span class="circle green">${ic(ico, 26)}</span><div class="n">Step ${n}</div><h3>${t}</h3><p>${s}</p></div>`;
  return shell({ title: "About", nav: "", body: `
    <div class="card"><h2 class="abouth">An AI that reads your land and tells you what to do, when, and why.</h2></div>
    <h3 class="sec">How it works</h3><div class="steps">
      ${step(1, "upload", "Add your data", "Location, soil tests, photos.")}
      ${step(2, "chart", "We analyze", "Satellite, weather, sensors, tests.")}
      ${step(3, "bulb", "Get advice", "What, when, why, cost, plan B.")}
      ${step(4, "check", "Act and follow up", "Done, photo, result.")}</div>
    <h3 class="sec">The AI inside</h3><div class="steps">
      <div class="step"><span class="circle green">${ic("chart", 26)}</span><h3>Code decides</h3><p>Doses and dates come from tested rules. A model never invents a number.</p></div>
      <div class="step"><span class="circle green">${ic("mic", 26)}</span><h3>Copilot</h3><p>Ask by voice or text. It explains and simulates.</p></div>
      <div class="step"><span class="circle green">${ic("camera", 26)}</span><h3>Photos described</h3><p>Observations only, never a diagnosis.</p></div>
      <div class="step"><span class="circle green">${ic("shield", 26)}</span><h3>Always checked</h3><p>A model answer with a number not in your data is rejected.</p></div></div>
    <h3 class="sec">Find your field</h3><div class="start-grid"><div>
      ${opt("gps", "pin", "Use my location")}${opt("walk", "walk", "Walk the edge")}${opt("search", "search", "Village name")}</div>
      <div class="card limits"><div class="lbl">What is real in this demo</div>
        <p class="sub"><b>Real:</b> weather (Open-Meteo), ${vigorReal() ? "Sentinel-2 images, " : ""}the decision rules, GPS, soil tests, the offline queue.</p>
        <p class="sub"><b>Simulated:</b> ${vigorReal() ? "" : "crop vigor, "}the two soil sensors, buyers and prices.</p>
        <p class="sub"><b>Not validated:</b> the harvest forecast. Voice input uses the browser's speech service.</p></div></div>
    <p class="site-foot">Farm Advisor  -  Team 2  -  BCG Platinion Hackathon 2026  -  Demo data, not agronomic advice for real fields.</p>` });
}

/* ---------- Copilot: chat, voice in, voice out ---------- */
const cp = { open: false, msgs: [], busy: false, status: null, listening: false, speaking: false, speak: lsGet("fa_speak", false), rec: null, voiceTurn: false, hintFixed: false, speakId: 0, convo: false, silent: 0, server: false, audio: null, stopRec: null };
const cpTaskId = () => { const m = /^#\/(?:task|follow)\/(\d+)/.exec(location.hash); return m ? +m[1] : null; };
const speechCtor = () => window.SpeechRecognition || window.webkitSpeechRecognition;
async function loadCopilotStatus() {
  try { cp.status = await fetchJson("/api/copilot/status"); lsSet("c:/api/copilot/status", cp.status); }
  catch { cp.status = lsGet("c:/api/copilot/status", null); }
  try { cp.server = !!(await fetchJson("/api/speech/status")).available; lsSet("c:/api/speech/status", cp.server); }   // server voice (Azure): any browser, Arabic included
  catch { cp.server = !!lsGet("c:/api/speech/status", false); }
  cpRenderHead();
}
function localAnswer(q, taskId) {            // offline Copilot: fixed questions answered from the advice saved on this device
  const open = (S?.tasks || []).filter(t => t.status === "open");
  const t = open.find(x => x.id === taskId) || open[0], l = q.toLowerCase();
  const say = text => ({ text, source: "saved", actions: [], note: null });
  const conf = c => lt(c, { High: "élevée", Medium: "moyenne", Low: "faible" }[c] || c, { High: "عالية", Medium: "متوسطة", Low: "ضعيفة" }[c] || c);
  if (/plan|today|summary|to do|tasks|resume|résumé|aujourd|tâches|taches|اليوم|مهام|خطتي/.test(l) && !/plan b|بديل/.test(l)) return say(open.length ? lt(`You have ${open.length} open task${open.length > 1 ? "s" : ""}: `, `Vous avez ${open.length} tâche${open.length > 1 ? "s" : ""} ouverte${open.length > 1 ? "s" : ""} : `, `لديك ${open.length} مهام مفتوحة: `) + open.map(x => `${x.title} (${x.when_text})`).join("; ") + "." : lt("You have no open task right now.", "Vous n'avez aucune tâche ouverte pour le moment.", "ليست لديك أي مهمة مفتوحة الآن."));
  if (!t) return say(lt("There is no open task to talk about right now.", "Il n'y a aucune tâche ouverte dont parler pour le moment.", "لا توجد مهمة مفتوحة للحديث عنها الآن."));
  if (/plan b|cannot|can't|alternative|instead|sinon|بديل/.test(l)) return say(lt(`Plan B for "${t.title}": ${t.plan_b}`, `Plan B pour « ${t.title} » : ${t.plan_b}`, `الخطة البديلة لـ «${t.title}»: ${t.plan_b}`));
  if (/sure|confiden|certain|reliable|accurate|confiance|fiable|ثقة|متأكد/.test(l)) return say(lt(`Confidence for "${t.title}" is ${t.confidence}. ${t.conf_reason}`, `La confiance pour « ${t.title} » est ${conf(t.confidence)}. ${t.conf_reason}`, `الثقة في «${t.title}» هي ${conf(t.confidence)}. ${t.conf_reason}`));
  if (/cost|price|how much|coût|cout|combien|prix|كم|تكلفة|سعر/.test(l)) return say(lt(`"${t.title}": ${t.cost}`, `« ${t.title} » : ${t.cost}`, `«${t.title}»: ${t.cost}`));
  if (/when|what time|date|quand|متى|موعد/.test(l)) return say(lt(`"${t.title}": ${t.when_text}.`, `« ${t.title} » : ${t.when_text}.`, `«${t.title}»: ${t.when_text}.`));
  if (/why|reason|explain|pourquoi|raison|لماذا|ليش|سبب/.test(l)) return say(lt(`About "${t.title}": ${t.why} Confidence: ${t.confidence}. ${t.conf_reason}`, `À propos de « ${t.title} » : ${t.why} Confiance : ${conf(t.confidence)}. ${t.conf_reason}`, `بخصوص «${t.title}»: ${t.why} الثقة: ${conf(t.confidence)}. ${t.conf_reason}`));
  return say("I need a connection for that question. Offline I can answer: Why? Plan B? When? How much? How sure are you? My plan for today.");
}
function cpMeta(m) {
  if (m.role !== "bot") return "";
  const src = { engine: "Rule engine", model: "Model, checked", saved: "Saved on this device" }[m.source] || "";
  return `<div class="cp-meta">${src}${m.note ? `<br><span class="cp-warn">${esc(m.note)}</span>` : ""}</div>`;
}
function cpRenderMsgs() {
  const box = document.getElementById("cp-msgs"); if (!box) return;
  const welcome = (cp.msgs.length || cp.busy) ? "" : `<div class="cp-empty"><span class="circle">${ic("mic", 34)}</span><p>Ask me about your field.</p></div>`;
  box.innerHTML = welcome + cp.msgs.map((m, i) => `<div class="cp-msg ${m.role}"><div>${esc(m.text)}</div>${cpMeta(m)}${m.role === "bot" ? `<div class="cp-actions"><button class="cp-play" data-cp-play="${i}" aria-label="Read aloud">${ic("speaker", 16)}</button>${(m.actions || []).map(a => `<button data-cp-go="${esc(a.go)}">${esc(a.label)}</button>`).join("")}</div>` : ""}</div>`).join("") + (cp.busy ? '<div class="cp-msg bot"><div class="cp-typing">...</div></div>' : "");
  box.scrollTop = box.scrollHeight;
  translateTree(box);
}
const CHIPS = [["speaker", "Read my tasks"], ["chat", "Why?"], ["shield", "Plan B?"], ["clock", "What if I wait 2 days?"], ["tasks", "My plan for today"]];
function cpRenderHead() {
  const b = document.getElementById("cp-badge"); if (!b) return;
  b.textContent = tt(offline ? "Offline" : cp.status ? (cp.status.mode === "model" ? "Model, checked" : "Rule engine") : "");
  const tid = cpTaskId(), t = tid && S ? S.tasks.find(x => x.id === tid) : null;
  const ctx = document.getElementById("cp-ctx"); if (ctx) { ctx.textContent = t ? t.title : ""; ctx.hidden = !t; }
  const chips = document.getElementById("cp-chips");
  if (chips) { chips.innerHTML = CHIPS.map(([i, q]) => `<button data-cp-q="${esc(q)}">${ic(i, 16)}<span>${esc(q)}</span></button>`).join(""); translateTree(chips); }
  cpUpdateMic();
}
function cpUpdateMic() {
  const mic = document.getElementById("cp-mic"), sp = document.getElementById("cp-speak"), hint = document.getElementById("cp-hint");
  if (mic) {
    const ok = (cp.server || !!speechCtor()) && !offline;
    mic.classList.toggle("listening", cp.listening); mic.disabled = !ok && !cp.listening;
    mic.setAttribute("aria-label", tt(cp.listening ? "Stop" : "Speak")); mic.title = !(cp.server || speechCtor()) ? tt("Voice needs Chrome or Edge") : offline ? tt("Voice needs internet") : tt("Speak");
  }
  const tk = document.getElementById("cp-talk"); if (tk) { tk.classList.toggle("on", cp.convo); tk.setAttribute("aria-pressed", String(cp.convo)); }
  if (sp) { sp.classList.toggle("on", cp.speak); sp.innerHTML = ic(cp.speak ? "speaker" : "mute", 20); sp.setAttribute("aria-pressed", String(cp.speak)); sp.setAttribute("aria-label", tt("Read answers aloud")); }
  if (hint && !cp.hintFixed) hint.textContent = cp.listening ? tt("Listening...") : cp.convo ? tt("Talk mode on") : "";
}
function cpHint(msg) { const h = document.getElementById("cp-hint"); if (h) { h.textContent = tt(msg); cp.hintFixed = true; setTimeout(() => { cp.hintFixed = false; cpUpdateMic(); }, 3500); } }
let voices = [];
const loadVoices = () => { try { voices = speechSynthesis.getVoices() || []; } catch { voices = []; } };
if ("speechSynthesis" in window) { loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }
function pickVoice(code) {                           // exact language code first, then any voice of the same language
  const norm = v => (v.lang || "").toLowerCase().replace("_", "-"), c = code.toLowerCase(), base = c.slice(0, 2);
  const same = voices.filter(v => norm(v).startsWith(base));
  return same.find(v => norm(v) === c) || same[0] || null;
}
function stopSpeaking() {
  cp.speakId++; cp.speaking = false;
  try { if (cp.audio) { cp.audio.pause(); cp.audio.src = ""; cp.audio = null; } } catch { /* nothing playing */ }
  try { if ("speechSynthesis" in window) speechSynthesis.cancel(); } catch { /* no speech output */ }
}
/* server voice: the Copilot's words come from /api/tts (Azure) as MP3 and are played one chunk after the other */
const speechChunks = text => {
  const parts = text.replace(/[«»"*_]/g, "").split(/(?<=[.!?؟:;])\s+/).filter(p => p.trim()), out = [];
  for (const p of parts) { if (out.length && (out[out.length - 1] + " " + p).length < 240) out[out.length - 1] += " " + p; else out.push(p); }
  return out;
};
async function fetchTts(text) {
  const r = await fetch("/api/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, lang }) });
  if (!r.ok) throw new Error("tts " + r.status);
  return URL.createObjectURL(await r.blob());
}
async function serverSpeak(text, done) {
  stopSpeaking();
  const id = ++cp.speakId, chunks = speechChunks(text);
  cp.speaking = true;
  let next = fetchTts(chunks[0]);
  for (let i = 0; i < chunks.length; i++) {
    let url;
    try { url = await next; } catch { if (id === cp.speakId) { cp.speaking = false; return browserSpeak(chunks.slice(i).join(" "), done); } return; }
    if (id !== cp.speakId) { URL.revokeObjectURL(url); return; }
    next = i + 1 < chunks.length ? fetchTts(chunks[i + 1]) : null;   // fetch the next sentence while this one plays
    const ok = await new Promise(res => {
      const a = new Audio(url); cp.audio = a;
      a.onended = () => res(true); a.onerror = () => res(false);
      a.play().catch(() => res(false));
    });
    URL.revokeObjectURL(url);
    if (id !== cp.speakId) return;
    if (!ok) { cp.speaking = false; return browserSpeak(chunks.slice(i + 1).join(" "), done); }
  }
  cp.speaking = false; done && done();
}
function speakText(text, done) { if (cp.server && !offline && text) serverSpeak(text, done); else browserSpeak(text, done); }
function browserSpeak(text, done) {                  // reads sentence by sentence (long texts get cut by some browsers); done() runs after the last one
  if (!("speechSynthesis" in window) || !text) { done && done(); return; }
  stopSpeaking();
  const id = ++cp.speakId, code = LANGS[lang].speech, v = pickVoice(code);
  const parts = text.replace(/[«»"*_]/g, "").split(/(?<=[.!?؟:])\s+/).filter(p => p.trim());
  if (voices.length && !v) cpHint("No voice for this language on this device");
  cp.speaking = true;
  const next = i => {
    if (id !== cp.speakId) return;
    if (i >= parts.length) { cp.speaking = false; done && done(); return; }
    const u = new SpeechSynthesisUtterance(parts[i]);
    u.lang = code; u.rate = 0.95; if (v) u.voice = v;
    u.onend = () => next(i + 1);
    u.onerror = () => { if (id === cp.speakId) cp.speaking = false; };
    speechSynthesis.speak(u);
  };
  next(0);
}
/* voice commands: answered on the device, so they also work for reading the tasks while the connection is poor */
const CMD_STOP = /^\s*(stop|be quiet|silence|arr[eê]te|tais[- ]toi|توقف|اسكت|قف)/i;
const CMD_REPEAT = /(repeat|say (it )?again|r[ée]p[èe]te|encore une fois|أعد|كرر)/i;
const CMD_TASKS = /(read|list|tell).*(task|to ?do)|my tasks|mes t[âa]ches|lis.*t[âa]ches|اقرأ.*مهام|مهامي/i;
const cpListenAgain = () => { if (cp.convo) setTimeout(cpMic, 250); };
function cpCommand(q, text) {
  if (CMD_STOP.test(q)) { stopSpeaking(); cp.convo = false; cpUpdateMic(); cpHint("Stopped"); return true; }
  if (CMD_REPEAT.test(q)) { const last = [...cp.msgs].reverse().find(m => m.role === "bot"); if (last) speakText(last.text, cpListenAgain); return true; }
  if (CMD_TASKS.test(q)) {
    cp.msgs.push({ role: "user", text }); cp.msgs.push({ role: "bot", ...localAnswer("plan for today", null) }); cpRenderMsgs();
    speakText(cp.msgs[cp.msgs.length - 1].text, cpListenAgain); return true;
  }
  return false;
}
function cpTalk() {                                  // talk mode: the Copilot reads the tasks, then listens, answers aloud, listens again
  if (cp.convo) { cp.convo = false; cp.rec && cp.listening && cp.rec.stop(); stopSpeaking(); cpUpdateMic(); return cpHint("Talk mode off"); }
  if (!(cp.server || speechCtor())) return cpHint("Voice needs Chrome or Edge");
  if (offline) return cpHint("Voice needs internet");
  cp.convo = true; cp.silent = 0; cpUpdateMic(); cpHint("Talk mode on");
  cpCommand("read my tasks", tt("Read my tasks"));
}
function cpHeard(q) {                                // what the farmer said (empty = silence); talk mode listens again unless it was silent twice
  if (q) { cp.silent = 0; cp.voiceTurn = true; cpSend(q); }
  else if (cp.convo) { if (++cp.silent >= 2) { cp.convo = false; cpUpdateMic(); cpHint("Talk mode off"); } else setTimeout(cpMic, 300); }
}
/* records the microphone as a 16 kHz WAV and stops by itself when the farmer stops talking */
function recordWav() {
  return new Promise(async (resolve, reject) => {
    let stream, ctx;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); } catch (e) { return reject(e); }
    ctx = new (window.AudioContext || window.webkitAudioContext)(); ctx.resume && ctx.resume();
    const src = ctx.createMediaStreamSource(stream), proc = ctx.createScriptProcessor(4096, 1, 1), chunks = [];
    let heard = false, quiet = 0, total = 0, done = false;
    const finish = () => {
      if (done) return; done = true; cp.stopRec = null;
      try { proc.disconnect(); src.disconnect(); stream.getTracks().forEach(t => t.stop()); ctx.close(); } catch { /* already closed */ }
      resolve(heard ? encodeWav(chunks, ctx.sampleRate) : null);
    };
    cp.stopRec = finish;      // pressing the mic while recording sends what was said so far
    proc.onaudioprocess = e => {
      const d = e.inputBuffer.getChannelData(0); chunks.push(new Float32Array(d)); total += d.length / ctx.sampleRate;
      let sum = 0; for (let i = 0; i < d.length; i++) sum += d[i] * d[i];
      const rms = Math.sqrt(sum / d.length);
      if (rms > 0.02) { heard = true; quiet = 0; } else quiet += d.length / ctx.sampleRate;
      if ((heard && quiet > 1.4) || (!heard && total > 6) || total > 20) finish();
    };
    src.connect(proc); proc.connect(ctx.destination);
  });
}
function encodeWav(chunks, rate) {
  let len = 0; chunks.forEach(c => len += c.length);
  const all = new Float32Array(len); let o = 0; chunks.forEach(c => { all.set(c, o); o += c.length; });
  const ratio = rate / 16000, n = Math.floor(len / ratio), buf = new DataView(new ArrayBuffer(44 + n * 2));
  const w = (p, t) => { for (let i = 0; i < t.length; i++) buf.setUint8(p + i, t.charCodeAt(i)); };
  w(0, "RIFF"); buf.setUint32(4, 36 + n * 2, true); w(8, "WAVEfmt "); buf.setUint32(16, 16, true); buf.setUint16(20, 1, true); buf.setUint16(22, 1, true);
  buf.setUint32(24, 16000, true); buf.setUint32(28, 32000, true); buf.setUint16(32, 2, true); buf.setUint16(34, 16, true); w(36, "data"); buf.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) { const a = all[Math.floor(i * ratio)], v = Math.max(-1, Math.min(1, a)); buf.setInt16(44 + i * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true); }
  return new Blob([buf], { type: "audio/wav" });
}
async function serverListen() {                      // record, send to /api/stt, then treat the text like a typed question
  stopSpeaking();
  if (!navigator.mediaDevices || !window.isSecureContext) { cp.convo = false; return cpHint("Voice needs a secure page (https)"); }
  cp.listening = true; cpUpdateMic();
  let blob;
  try { blob = await recordWav(); }
  catch (e) { cp.listening = false; cp.convo = false; cpUpdateMic(); return cpHint(e && e.name === "NotAllowedError" ? "Microphone is blocked" : "Voice did not work"); }
  cp.listening = false; cpUpdateMic();
  if (!blob) { cpHint("I heard nothing"); return cpHeard(""); }
  let text = "";
  try {
    const r = await fetchJson(`/api/stt?lang=${lang}`, { method: "POST", headers: { "Content-Type": "audio/wav" }, body: blob }, 20000);
    text = (r.text || "").trim();
  } catch { cp.convo = false; cpUpdateMic(); return cpHint("Voice did not work"); }
  if (!text) cpHint("I heard nothing");
  cpHeard(text);
}
function cpMic() {                                   // browser speech recognition (Chrome and Edge send the audio to their speech service)
  if (cp.listening) { cp.convo = false; cp.stopRec ? cp.stopRec() : cp.rec && cp.rec.stop(); cpUpdateMic(); return; }
  if (cp.server && !offline) return serverListen();
  const SR = speechCtor();
  if (!SR) return cpHint("Voice needs Chrome or Edge");
  if (offline) return cpHint("Voice needs internet");
  stopSpeaking();
  const rec = new SR(), input = document.getElementById("cp-input"); let finalText = "";
  rec.lang = LANGS[lang].speech; rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 1;
  rec.onstart = () => { cp.listening = true; cpUpdateMic(); };
  rec.onresult = e => { let t = ""; for (let i = e.resultIndex; i < e.results.length; i++) { t += e.results[i][0].transcript; if (e.results[i].isFinal) finalText = t; } input.value = t; };
  rec.onerror = e => { if (e.error !== "no-speech" && e.error !== "aborted") cp.convo = false; cpHint(e.error === "not-allowed" || e.error === "service-not-allowed" ? "Microphone is blocked" : e.error === "no-speech" ? "I heard nothing" : e.error === "network" ? "Voice needs internet" : "Voice did not work"); };
  rec.onend = () => { cp.listening = false; cpUpdateMic(); const q = (finalText || input.value).trim(); input.value = "";
    cpHeard(q); };
  cp.rec = rec;
  try { rec.start(); } catch { cpHint("Voice did not work"); }
}
async function cpSend(text) {
  const q = (text || "").trim(); if (!q || cp.busy) return;
  const voice = cp.voiceTurn; cp.voiceTurn = false;
  if (cpCommand(q, tt(q))) return;
  cp.msgs.push({ role: "user", text: tt(q) }); cp.busy = true; cpRenderMsgs();
  let res;
  try {
    res = await fetchJson("/api/copilot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: q, task_id: cpTaskId(), lang }) }, 30000);
    offline = false;
  } catch { offline = true; res = localAnswer(q, cpTaskId()); }
  cp.busy = false; cp.msgs.push({ role: "bot", ...res }); cpRenderMsgs(); cpRenderHead();
  if (voice || cp.speak || cp.convo) speakText(res.text, cpListenAgain);
  else cpListenAgain();
}
function cpToggle(open) {
  const panel = document.getElementById("cp-panel"), fab = document.getElementById("cp-fab");
  if (panel.classList.contains("docked")) return;
  cp.open = open ?? !cp.open;
  panel.hidden = !cp.open; fab.hidden = cp.open;
  if (cp.open) { cpRenderHead(); cpRenderMsgs(); if (!cp.status) loadCopilotStatus(); document.getElementById("cp-input").focus(); }
  else stopSpeaking();
}
function cpPlace() {                                 // dock the panel on the home page, float it everywhere else
  const root = document.getElementById("cp-root"), panel = document.getElementById("cp-panel"), fab = document.getElementById("cp-fab"), slot = document.getElementById("cp-slot");
  if (!root || !panel) return;
  if (slot) { panel.classList.add("docked"); slot.appendChild(panel); panel.hidden = false; fab.hidden = true; }
  else { if (panel.parentElement !== root) root.appendChild(panel); panel.classList.remove("docked"); panel.hidden = !cp.open; fab.hidden = cp.open; }
  cpRenderHead(); cpRenderMsgs();
}
const cpMarkup = () => `<button id="cp-fab" aria-label="Open the Copilot">${ic("mic", 24)}<span>Copilot</span></button>
  <section id="cp-panel" class="cp" hidden aria-label="Copilot">
    <header><div><b>${ic("bulb", 18)} Copilot</b><small id="cp-badge"></small></div><span class="cp-tools"><button id="cp-talk" aria-label="Talk mode" aria-pressed="false">${ic("chat", 20)}</button><button id="cp-speak" aria-label="Read answers aloud" aria-pressed="false"></button><button id="cp-close" aria-label="Close the Copilot">${ic("x", 20)}</button></span></header>
    <div id="cp-ctx" hidden></div><div id="cp-msgs" aria-live="polite"></div><div id="cp-chips"></div>
    <div class="cp-bar"><button id="cp-mic" class="mic" aria-label="Speak">${ic("mic", 30)}</button>
      <form id="cp-form" autocomplete="off"><input id="cp-input" maxlength="400" placeholder="Ask"><button type="submit" aria-label="Send">${ic("send", 22)}</button></form></div>
    <p id="cp-hint" class="cp-hint" aria-live="polite"></p></section>`;
function cpRetext() {                                // rebuild the static texts when the language changes
  const root = document.getElementById("cp-root"), val = document.getElementById("cp-input")?.value || "";
  root.innerHTML = cpMarkup();
  document.getElementById("cp-input").value = val;
  translateTree(root); cpPlace();
}
function cpInit() {
  const root = document.createElement("div"); root.id = "cp-root";
  root.innerHTML = cpMarkup(); document.body.appendChild(root);
  document.addEventListener("click", e => {          // on the home page the panel is docked inside #app, outside #cp-root, so listen on the document
    const el = e.target.closest("#cp-panel button, #cp-fab"); if (!el) return;
    if (el.id === "cp-fab") return cpToggle(true);
    if (el.id === "cp-close") return cpToggle(false);
    if (el.id === "cp-mic") return cpMic();
    if (el.id === "cp-talk") return cpTalk();
    if (el.id === "cp-speak") { cp.speak = !cp.speak; lsSet("fa_speak", cp.speak); if (!cp.speak) stopSpeaking(); return cpUpdateMic(); }
    if (el.dataset.cpPlay !== undefined) { const m = cp.msgs[+el.dataset.cpPlay]; return m && speakText(m.text); }
    if (el.dataset.cpQ) return cpSend(el.dataset.cpQ);
    if (el.dataset.cpGo) { if (window.innerWidth < 900 && !document.getElementById("cp-panel").classList.contains("docked")) cpToggle(false); return go(el.dataset.cpGo); }
  });
  document.addEventListener("submit", e => { if (!e.target.closest("#cp-panel")) return; e.preventDefault(); const i = document.getElementById("cp-input"); const v = i.value; i.value = ""; cpSend(v); });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && cp.open) cpToggle(false); });
  window.addEventListener("hashchange", cpRenderHead);
  translateTree(root); loadCopilotStatus();
}

/* ---------- photo reading (vision agent) ---------- */
async function analysePhoto(zone) {
  ui.photoNotes = null;
  if (!ui.photo || offline) return;
  if (cp.status && !cp.status.vision) { ui.photoNotes = { available: false, reason: "Photo reading is off: no vision model is configured. Your photo is still saved." }; return render(); }
  ui.photoNotes = { loading: true }; render();
  try { ui.photoNotes = await fetchJson("/api/vision", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ photo: ui.photo, zone }) }, 30000); }
  catch { ui.photoNotes = { available: false, reason: "Could not read the photo now. It is still saved." }; }
  render();
}
function photoNotesCard() {
  const n = ui.photoNotes; if (!n) return "";
  if (n.loading) return '<div class="card"><div class="skel sk-card" role="status" aria-label="Loading..."></div></div>';
  if (!n.available) return `<div class="card"><div class="sub">${esc(n.reason)}</div></div>`;
  return `<div class="card"><div class="lbl">Photo notes</div>
    ${n.observations.length ? `<div class="sub" style="margin-top:6px"><b>Visible:</b> ${n.observations.map(esc).join("; ")}.</div>` : '<div class="sub">Nothing clear is visible.</div>'}
    ${n.possible_causes_to_check.length ? `<div class="sub" style="margin-top:4px"><b>To check:</b> ${n.possible_causes_to_check.map(esc).join("; ")}.</div>` : ""}
    <div class="note" style="margin:6px 0 0">${esc(n.note)}</div></div>`;
}

/* ---------- router ---------- */
async function render() {
  const r = route.replace(/^#/, "") || "/";
  const panel = document.getElementById("cp-panel"), root = document.getElementById("cp-root");
  if (panel && root && panel.parentElement !== root) root.appendChild(panel);   // rescue the docked panel before the page is replaced
  if (!S) { $app.innerHTML = '<div class="screen"><div class="panel" style="margin-top:60px" role="status" aria-label="Loading..."><div class="skel sk-title"></div><div class="skel sk-card"></div><div class="skel sk-card"></div><div class="skel sk-card"></div></div></div>'; translateTree($app); return; }
  const keep = document.getElementById("note")?.value;
  const [, name, id] = r.split("/");
  if (r === "/" || r === "" || r === "/home") $app.innerHTML = homeScreen();
  else {
    const map = { field: fieldScreen, tasks: tasksScreen, alerts: alertsScreen, sell: sellScreen, me: meScreen, about: aboutScreen, welcome: aboutScreen, task: () => taskScreen(id), follow: () => followScreen(id), soil: () => soilScreen(id) };
    $app.innerHTML = (map[name] || fieldScreen)();
    if (name === "sell" && (!ui.forecast || !ui.offers)) loadSell();
    if ((name === "field" || !map[name]) && !ui.series && !ui.seriesLoading) { ui.seriesLoading = true; loadSeries(); }
  }
  if (keep && document.getElementById("note")) document.getElementById("note").value = keep;
  translateTree($app);
  document.documentElement.lang = lang; document.documentElement.dir = LANGS[lang].dir;
  cpPlace();
}
async function loadSell() {
  ui.forecast = await getCached(L("/api/forecast")); ui.offers = await getCached("/api/offers");
  if (ui.forecast && ui.offers) render(); else { offline = true; toast("Sell data is not saved on this device yet. Open this page once online."); }
}
function go(h) { if (location.hash === h) { route = h; render(); } else location.hash = h; }
window.addEventListener("hashchange", () => { route = location.hash; window.scrollTo(0, 0); render(); });
window.addEventListener("online", () => { offline = false; flush(); loadState().then(render); });
window.addEventListener("offline", () => { offline = true; render(); });

/* ---------- events ---------- */
$app.addEventListener("click", async e => {
  const el = e.target.closest("[data-go],[data-layer],[data-day],[data-filter],[data-read],[data-result],[data-opt],[data-act],[data-soilzone],[data-ztoggle],[data-cp-open],[data-say],[data-lang]");
  if (!el) return;
  const d = el.dataset;
  if (d.read) { const a = S.alerts.find(x => x.id === +d.read); if (a) a.unread = 0; lsSet(SKEY(), { t: Date.now(), j: S }); if (!d.go) return render(); }
  if (d.go) return go(d.go);
  if (d.lang) return setLang(d.lang);
  if (d.say) { const t = S.tasks.find(x => x.id === +d.say); return t && speakText(`${t.title}. ${t.when_text}. ${t.why}`); }
  if (d.cpOpen) { const p = document.getElementById("cp-panel"); return p.classList.contains("docked") ? document.getElementById("cp-input").focus() : cpToggle(true); }
  if (d.ztoggle) { ui.hideZones[d.ztoggle] = !ui.hideZones[d.ztoggle]; return render(); }
  if (d.soilzone) { ui.soil.zone = d.soilzone; ui.soilMsg = ""; return render(); }
  if (d.layer) { ui.layer = d.layer; return render(); }
  if (d.day) { ui.day = ui.day === d.day ? null : d.day; return render(); }
  if (d.filter) { ui.alertFilter = d.filter; return render(); }
  if (d.result) { ui.result = d.result; return render(); }
  if (d.opt) { ui.welcomeOpt = d.opt; return render(); }
  const act = d.act;
  if (act === "done") {
    const id = +d.id;
    enqueue("task_status", { task_id: id, status: "done" }); ui.result = null; ui.photo = null;
    go("#/follow/" + id);
    return toast("Done", { label: "Undo", fn: () => { enqueue("task_status", { task_id: id, status: "open" }); go("#/task/" + id); } });
  }
  if (act === "skip") { enqueue("task_status", { task_id: +d.id, status: "skipped" }); toast("Skipped. We will adjust the plan."); return go("#/tasks"); }
  if (act === "save-follow") {
    enqueue("observation", { task_id: +d.id, result: ui.result, note: document.getElementById("note")?.value || null, photo: ui.photo });
    ui.photo = null; ui.photoNotes = null; ui.result = null; toast(offline ? "Saved on this device. It will send when you are online." : "Saved. Thank you."); return go("#/tasks");
  }
  if (act === "save-soil") return saveSoil();
  if (act === "accept") { enqueue("offer_accept", { offer_id: +d.id }); return render(); }
  if (act === "listing") { enqueue("listing", {}); toast("Sale offer published (buyers are simulated)"); return render(); }
  if (act === "sync") return flush(true);
  if (act === "refresh") { await loadState(true); ui.forecast = null; ui.series = null; ui.seriesLoading = false; toast(offline ? "Offline: showing saved advice" : "Advice refreshed"); return render(); }
  if (act === "locate") return locate();
  if (act === "walk-start") return walkStart();
  if (act === "walk-stop") return walkStop();
  if (act === "search") return searchVillage();
});
async function setLang(l) {
  if (l === lang || !LANGS[l]) return;
  lang = l; try { localStorage.setItem("fa_lang", l); } catch { /* storage blocked */ }
  stopSpeaking(); ui.forecast = null; ui.series = null; ui.seriesLoading = false; ui.photoNotes = null;
  document.documentElement.lang = lang; document.documentElement.dir = LANGS[lang].dir;
  document.title = lt("Farm Advisor - AI advice from your field data", "Farm Advisor - des conseils IA à partir des données de votre champ", "Farm Advisor - نصائح بالذكاء الاصطناعي من بيانات حقلك");
  await loadState(); cpRetext(); render();
}
function saveSoil() {
  const num = v => (v === "" || v == null) ? null : Number(v);
  const ph = num(ui.soil.ph), om = num(ui.soil.om), mo = num(ui.soil.moisture);
  const bad = (v, lo, hi) => v != null && !(v >= lo && v <= hi);
  if (ph == null && om == null && mo == null) { ui.soilMsg = "Type at least one value."; return render(); }
  if (bad(ph, 3, 10)) { ui.soilMsg = "pH must be between 3 and 10."; return render(); }
  if (bad(om, 0, 15)) { ui.soilMsg = "Organic matter must be between 0 and 15 %."; return render(); }
  if (bad(mo, 3, 60)) { ui.soilMsg = "Moisture must be between 3 and 60 %."; return render(); }
  enqueue("soil_test", { zone_code: ui.soil.zone, ph, om_pct: om, moisture: mo == null ? null : mo / 100 });
  ui.soil = { zone: ui.soil.zone, ph: "", om: "", moisture: "" }; ui.soilMsg = "";
  toast(offline ? "Saved on this device. It will send when you are online." : "Soil test saved. The advice is being updated.");
  go("#/field");
}
$app.addEventListener("change", e => {
  if (e.target.id !== "ph" || !e.target.files[0]) return;
  const img = new Image(), url = URL.createObjectURL(e.target.files[0]);
  img.onload = () => {           // shrink the photo so it is cheap to store and send
    const k = Math.min(1, 640 / Math.max(img.width, img.height)), c = document.createElement("canvas");
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    ui.photo = c.toDataURL("image/jpeg", 0.6); URL.revokeObjectURL(url);
    render();
    const tid = cpTaskId(), t = tid && S ? S.tasks.find(x => x.id === tid) : null;
    analysePhoto(t ? t.zone_code : "A");
  };
  img.src = url;
});
$app.addEventListener("input", e => {
  const id = e.target.id;
  if (id === "vq") ui.search = e.target.value;
  if (id === "soil-ph") ui.soil.ph = e.target.value;
  if (id === "soil-om") ui.soil.om = e.target.value;
  if (id === "soil-m") ui.soil.moisture = e.target.value;
});

/* ---------- GPS and village search ---------- */
function locate() {
  if (!navigator.geolocation) { ui.locMsg = "This device has no GPS."; return render(); }
  ui.locMsg = "Looking for your position..."; render();
  navigator.geolocation.getCurrentPosition(
    p => { ui.loc = { lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy }; lsSet("fa_loc", ui.loc); render(); },
    err => { ui.locMsg = err.code === 1 ? "Location is blocked. Allow it in the browser settings, or type a village." : "No GPS fix yet. Try outdoors, or type a village."; render(); },
    { enableHighAccuracy: true, timeout: 30000, maximumAge: 10000 });
}
function walkStart() {
  if (!navigator.geolocation) { ui.locMsg = "This device has no GPS."; return render(); }
  ui.walking = [];
  ui.walkWatch = navigator.geolocation.watchPosition(p => {
    const pt = { lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy };
    const last = ui.walking[ui.walking.length - 1];
    if (!last || km(last, pt) * 1000 > 5) { ui.walking.push(pt); render(); }
  }, () => { ui.locMsg = "No GPS signal."; walkStop(true); }, { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 });
  render();
}
function walkStop(silent) {
  if (ui.walkWatch != null) navigator.geolocation.clearWatch(ui.walkWatch);
  const pts = ui.walking || []; ui.walking = null; ui.walkWatch = null;
  if (!silent) {
    if (pts.length < 3) ui.locMsg = "Walk a little further: at least 3 points are needed.";
    else { lsSet("fa_outline", pts); ui.locMsg = `Outline saved on this device: ${pts.length} points, about ${areaHa(pts).toFixed(2)} ha.`; }
  }
  render();
}
async function searchVillage() {
  if (!ui.search.trim()) { ui.searchMsg = "Type a name first."; return render(); }
  ui.searchMsg = "Searching..."; render();
  try {
    const j = await fetchJson("https://nominatim.openstreetmap.org/search?format=json&limit=1&q=" + encodeURIComponent(ui.search + ", Morocco"), {}, 8000);
    ui.searchMsg = j[0] ? `Found: ${j[0].display_name.split(",").slice(0, 3).join(",")}` : "No place found with that name.";
  } catch { ui.searchMsg = "No connection. Try again when you are online."; }
  render();
}

/* ---------- start ---------- */
if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
document.documentElement.lang = lang; document.documentElement.dir = LANGS[lang].dir;
cpInit();
(async () => { await Promise.all([loadState(), loadLand()]); await flush(); render(); })();
})();
