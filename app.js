(() => {
"use strict";
const C = window.CONFIG || {};
const $ = (s) => document.querySelector(s);
const NAME = C.runnerName || "Le coureur";

// ─── Horloge (accélérable en mode démo) ───────────────────────────────────
let warp = 1, realStart = Date.now(), virtStart = Date.now();
const now = () => virtStart + (Date.now() - realStart) * warp;

// ─── Formatage ────────────────────────────────────────────────────────────
// Objectif : config.js par défaut, remplacé en direct par celui réglé dans l'espace coureur
let target = Target.fromConfig(C);
let TARGET = 330; // allure objectif en ms par mètre (numériquement égal aux s/km), calculée après chargement du parcours
function setTarget(t) {
  if (!Target.valid(t)) return false;
  const changed = !target || t.mode !== target.mode || t.s !== target.s;
  target = { mode: t.mode, s: +t.s };
  TARGET = Target.paceOf(target, TOTAL || 42195);
  $("#objective").textContent = `🎯 Objectif : ${Target.label(target)}`;
  return changed;
}
const fmtKm = (m) => (m / 1000).toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmtClock = (t) => new Date(t).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
const fmtDur = (ms) => {
  const s = Math.max(0, Math.round(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), ss = s % 60;
  return h ? `${h}h${String(m).padStart(2, "0")}'${String(ss).padStart(2, "0")}` : `${m}'${String(ss).padStart(2, "0")}`;
};
const fmtIn = (ms) => {
  const min = Math.round(ms / 60000);
  if (min <= 0) return "imminent";
  if (min < 60) return `dans ${min} min`;
  return `dans ${Math.floor(min / 60)}h${String(min % 60).padStart(2, "0")}`;
};
const fmtPace = (msPerM) => { // ms/m == s/km
  if (!msPerM || !isFinite(msPerM)) return "—";
  const s = Math.round(msPerM); return `${Math.floor(s / 60)}'${String(s % 60).padStart(2, "0")}/km`;
};
const ago = (ms) => { const s = Math.round(ms / 1000); return s < 60 ? `${s} s` : s < 3600 ? `${Math.round(s / 60)} min` : `${Math.floor(s / 3600)}h${String(Math.round(s % 3600 / 60)).padStart(2, "0")}`; };
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// ─── Parcours ─────────────────────────────────────────────────────────────
let route = [], TOTAL = 0, toXY, waypoints = [];

async function loadRoute() {
  const txt = await (await fetch(C.gpx || "trace.gpx", { cache: "no-cache" })).text();
  const xml = new DOMParser().parseFromString(txt, "application/xml");
  let pts = [...xml.getElementsByTagName("trkpt")];
  if (!pts.length) pts = [...xml.getElementsByTagName("rtept")];
  const raw = pts.map((p) => [+p.getAttribute("lat"), +p.getAttribute("lon")]);
  const lat0 = raw[0][0], lon0 = raw[0][1], kx = Math.cos(lat0 * Math.PI / 180) * 111320, ky = 110574;
  toXY = (lat, lon) => [(lon - lon0) * kx, (lat - lat0) * ky];
  route = raw.map(([lat, lon]) => { const [x, y] = toXY(lat, lon); return { lat, lon, x, y, d: 0 }; });
  for (let i = 1; i < route.length; i++) route[i].d = route[i - 1].d + Math.hypot(route[i].x - route[i - 1].x, route[i].y - route[i - 1].y);
  TOTAL = route[route.length - 1].d;

  // Points nommés du GPX : bornes km, ravitaillements…
  const wpts = [...xml.getElementsByTagName("wpt")].map((w) => ({
    lat: +w.getAttribute("lat"), lon: +w.getAttribute("lon"),
    name: (w.getElementsByTagName("name")[0]?.textContent || "").trim(),
  }));
  for (const w of wpts) {
    const num = /^\d+([.,]\d+)?$/.test(w.name) ? parseFloat(w.name.replace(",", ".")) : null;
    if (/^(depart|départ|arriv)/i.test(w.name)) continue; // gérés à part
    const cands = passages(w.lat, w.lon, 60);
    if (!cands.length) continue;
    if (num !== null) {
      if (Number.isInteger(num) === false) continue; // ex. « 21,1 » (semi) : on l'affiche comme point spécial
      const c = cands.reduce((a, b) => Math.abs(b.d - num * 1000) < Math.abs(a.d - num * 1000) ? b : a);
      waypoints.push({ type: "km", km: num, name: `Km ${num}`, d: c.d });
    } else {
      const ravito = /ravit/i.test(w.name);
      for (const c of cands) waypoints.push({ type: ravito ? "ravito" : "poi", name: w.name, d: c.d });
    }
  }
  waypoints.push({ type: "poi", name: "Semi-marathon", d: Math.min(21097.5 * TOTAL / 42195, TOTAL), ico: "🥈" });
  waypoints.push({ type: "finish", name: "Arrivée", d: TOTAL });
  waypoints.sort((a, b) => a.d - b.d);
}

// Tous les passages du parcours à moins de r mètres d'un point (gère les allers-retours)
function passages(lat, lon, r) {
  const [px, py] = toXY(lat, lon); const out = []; let best = null;
  for (let i = 0; i < route.length - 1; i++) {
    const a = route[i], b = route[i + 1], dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy;
    let t = L2 ? ((px - a.x) * dx + (py - a.y) * dy) / L2 : 0; t = Math.max(0, Math.min(1, t));
    const dist = Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy));
    if (dist <= r) { const c = { d: a.d + t * (b.d - a.d), dist }; if (!best || c.dist < best.dist) best = c; }
    else if (best) { out.push(best); best = null; }
  }
  if (best) out.push(best);
  return out;
}

// Position et cap à une distance donnée du parcours
function pointAt(d) {
  d = Math.max(0, Math.min(TOTAL, d));
  let lo = 0, hi = route.length - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (route[mid].d <= d) lo = mid; else hi = mid; }
  const a = route[lo], b = route[hi], t = b.d > a.d ? (d - a.d) / (b.d - a.d) : 0;
  return { lat: a.lat + t * (b.lat - a.lat), lon: a.lon + t * (b.lon - a.lon), bearing: Math.atan2(b.x - a.x, b.y - a.y) * 180 / Math.PI };
}
const slice = (d0, d1) => {
  const out = [pointAt(d0)]; for (const p of route) if (p.d > d0 && p.d < d1) out.push(p); out.push(pointAt(d1));
  return out.map((p) => [p.lat, p.lon]);
};

// ─── Modèle : positions GPS → progression sur le parcours ─────────────────
let rawPoints = [];      // [{t, lat, lon, acc}]
let M = null;            // modèle calculé
let cheers = [];         // [{n, t}]

function computeModel() {
  const pts = rawPoints.slice().sort((a, b) => a.t - b.t);
  const fixes = []; let last = null;
  for (const p of pts) {
    const r = Math.max(60, Math.min(150, (p.acc || 0) * 1.5));
    const cands = passages(p.lat, p.lon, r);
    if (!cands.length) continue;
    let pick = null;
    if (last) {
      const dt = (p.t - last.t) / 1000, lo = last.d - 150, hi = last.d + dt * 7 + 200;
      const win = cands.filter((c) => c.d >= lo && c.d <= hi);
      const score = (c) => c.dist + 0.02 * Math.abs(c.d - last.d);
      if (win.length) pick = win.reduce((a, b) => score(b) < score(a) ? b : a);
      else if (dt > 900) pick = cands.find((c) => c.d > lo) || null; // longue coupure : on reprend devant
    } else {
      pick = cands.reduce((a, b) => (b.dist + b.d * 0.005) < (a.dist + a.d * 0.005) ? b : a);
    }
    if (!pick) continue;
    const f = { t: p.t, d: last ? Math.max(pick.d, last.d) : pick.d, lat: p.lat, lon: p.lon };
    fixes.push(f); last = f;
  }
  const L = fixes[fixes.length - 1] || null;
  const lastRaw = pts[pts.length - 1] || null;

  // Heure de départ
  let t0 = C.startTime ? Date.parse(C.startTime) : null;
  const i = fixes.findIndex((f) => f.d > 50);
  if (i >= 0) {
    const a = fixes[i], b = fixes.find((f) => f.d > a.d + 300);
    const pace = b ? (b.t - a.t) / (b.d - a.d) : TARGET;
    const est = a.t - a.d * pace;
    if (!t0 || Math.abs(est - t0) > 20 * 60e3 || a.d < 2000) t0 = est; // les données GPS priment
  }

  // Allures (ms par mètre)
  const clamp = (p) => p && isFinite(p) && p > 150 && p < 900 ? p : null;
  let recent = null, avg = null, stopped = false;
  if (L) {
    const A = fixes.find((f) => f.t >= L.t - 8 * 60e3);
    if (A && L.t - A.t > 120e3) {
      if (L.d - A.d > 300) recent = clamp((L.t - A.t) / (L.d - A.d));
      const B = fixes.find((f) => f.t >= L.t - 3 * 60e3);
      if (B && L.t - B.t > 100e3 && L.d - B.d < 40) stopped = true;
    }
    if (t0 && L.d > 500) avg = clamp((L.t - t0) / L.d);
  }
  const pred = recent && avg ? 0.6 * recent + 0.4 * avg : recent || avg || TARGET;
  const finished = !!L && L.d >= TOTAL - 80;

  // Temps de passage interpolés (km bouclés)
  const timeAt = (d) => {
    for (let k = 1; k < fixes.length; k++) if (fixes[k].d >= d) {
      const a = fixes[k - 1], b = fixes[k]; return b.d > a.d ? a.t + (d - a.d) / (b.d - a.d) * (b.t - a.t) : b.t;
    }
    return null;
  };
  const splits = [];
  if (t0 && L) {
    let prev = t0;
    for (let km = 1; km * 1000 <= L.d; km++) { const t = timeAt(km * 1000); if (t) { splits.push({ km, ms: t - prev }); prev = t; } }
  }
  const finishT = finished ? (timeAt(TOTAL - 80) || L.t) : null;
  M = { fixes, L, lastRaw, t0, recent, avg, pred, stopped, finished, finishT, timeAt, splits };
}

// Distance estimée maintenant (on avance la position entre deux signaux GPS)
function estD() {
  if (!M || !M.L) return 0;
  if (M.finished) return TOTAL;
  const dt = now() - M.L.t;
  if (dt > 5 * 60e3 || M.stopped) return M.L.d;
  return Math.min(TOTAL, M.L.d + Math.min(dt, 5 * 60e3) / M.pred);
}

// Heure de passage à une distance donnée
function etaAt(d) {
  if (!M) return null;
  if (M.L && d <= M.L.d) return { past: true, t: M.timeAt(d) };
  if (M.finished) return null;
  if (M.L) return { past: false, t: M.L.t + (d - M.L.d) * M.pred };
  if (M.t0) return { past: false, t: M.t0 + d * TARGET };
  return null;
}

// ─── Carte ────────────────────────────────────────────────────────────────
let map, doneLine, todoLine, runnerMk, ghostMk, rawMk, kmMarkers = [], follow = true;
const dark = matchMedia("(prefers-color-scheme: dark)").matches;

function initMap() {
  map = L.map("map", { zoomControl: false, attributionControl: true });
  L.tileLayer(`https://{s}.basemaps.cartocdn.com/rastertiles/${dark ? "dark_all" : "voyager"}/{z}/{x}/{y}{r}.png`, {
    maxZoom: 19, subdomains: "abcd",
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OSM</a> © <a href="https://carto.com/">CARTO</a>',
  }).addTo(map);
  const ll = route.map((p) => [p.lat, p.lon]);
  const todoColor = getComputedStyle(document.documentElement).getPropertyValue("--route-todo").trim();
  L.polyline(ll, { color: "#fff", weight: 9, opacity: .9 }).addTo(map);
  todoLine = L.polyline(ll, { color: todoColor, weight: 5, opacity: .85 }).addTo(map);
  doneLine = L.polyline([], { color: "#ff5a1f", weight: 6, opacity: 1 }).addTo(map);
  map.fitBounds(L.latLngBounds(ll), { padding: [30, 30] });

  // Flèches de sens tous les 1 km (décalées de 500 m)
  for (let d = 500; d < TOTAL; d += 1000) {
    const p = pointAt(d);
    L.marker([p.lat, p.lon], { interactive: false, icon: L.divIcon({ className: "", iconSize: [14, 14],
      html: `<div class="arrow-icon" style="transform:rotate(${p.bearing}deg)">▲</div>` }) }).addTo(map);
  }
  // Bornes km (toutes les 5 km pour rester lisible) + ravitos + départ/arrivée
  for (const w of waypoints) {
    const p = pointAt(w.d);
    if (w.type === "km") {
      if (w.km % 5 !== 0) continue;
      const mk = L.marker([p.lat, p.lon], { icon: L.divIcon({ className: "", iconSize: [24, 24], html: `<div class="km-icon">${w.km}</div>` }) }).addTo(map);
      mk.on("click", (e) => showPassagePopup(e.latlng)); kmMarkers.push({ mk, w });
    } else {
      const ico = w.ico || (w.type === "ravito" ? "💧" : w.type === "finish" ? "🏁" : "📍");
      L.marker([p.lat, p.lon], { icon: L.divIcon({ className: "", iconSize: [22, 22], html: `<div class="wp-icon">${ico}</div>` }) })
        .addTo(map).on("click", (e) => showPassagePopup(e.latlng));
    }
  }
  const s = route[0];
  L.marker([s.lat, s.lon], { icon: L.divIcon({ className: "", iconSize: [22, 22], html: `<div class="wp-icon">🚦</div>` }) }).addTo(map);

  runnerMk = L.marker([s.lat, s.lon], { zIndexOffset: 1000, icon: runnerIcon(0, false) }).addTo(map);
  runnerMk.setOpacity(0);
  ghostMk = L.marker([s.lat, s.lon], { zIndexOffset: 900, interactive: false, icon: L.divIcon({ className: "", iconSize: [22, 22], html: `<div class="ghost-icon" title="Lièvre objectif">⏱️</div>` }) });
  rawMk = L.circleMarker([s.lat, s.lon], { radius: 4, color: "#555", weight: 1, fillColor: "#fff", fillOpacity: 1 });

  map.on("click", (e) => showPassagePopup(e.latlng));
  map.on("dragstart", () => setFollow(false));
}

let lastIconKey = "";
function runnerIcon(bearing, stale) {
  const flip = bearing > 0 && bearing < 180; // l'emoji regarde à gauche : on le retourne s'il va vers l'est
  return L.divIcon({ className: "", iconSize: [46, 46], iconAnchor: [23, 23],
    html: `<div class="runner-icon ${stale ? "stale" : ""}"><div class="dot"><span class="emo ${flip ? "flip" : ""}">🏃</span></div></div>` });
}

function showPassagePopup(latlng) {
  const cands = passages(latlng.lat, latlng.lng, 80);
  if (!cands.length) return;
  const rows = cands.map((c) => {
    const e = etaAt(c.d);
    let txt;
    if (!e || !e.t) txt = M && M.finished ? "—" : "horaire dispo dès le départ";
    else if (e.past) txt = `passé à <b>${fmtClock(e.t)}</b> ✅`;
    else txt = `vers <b>${fmtClock(e.t)}</b> · ${fmtIn(e.t - now())}`;
    return `<div class="pop-row">📍 <b>Km ${fmtKm(c.d)}</b><br>${txt}</div>`;
  }).join("");
  L.popup({ maxWidth: 260 }).setLatLng(latlng)
    .setContent(`<div>${cands.length > 1 ? `<small>Le parcours passe ${cands.length} fois ici</small>` : ""}${rows}</div>`).openOn(map);
}

function setFollow(on) { follow = on; $("#btnFollow").classList.toggle("on", on); }

// ─── Rendu (chaque seconde) ───────────────────────────────────────────────
function render() {
  if (!route.length) return;
  const t = now(), hasData = !!(M && M.L);
  const d = estD();
  const sinceFix = M && M.lastRaw ? t - M.lastRaw.t : null;

  // Statut
  const st = $("#status");
  if (M && M.finished) { st.className = "pill done"; st.textContent = "🏁 Arrivé !"; }
  else if (sinceFix === null) { st.className = "pill wait"; st.textContent = "En attente du départ"; }
  else if (sinceFix < 2 * 60e3) { st.className = "pill live"; st.textContent = M.stopped ? "À l'arrêt" : "EN DIRECT"; }
  else if (sinceFix < 6 * 60e3) { st.className = "pill stale"; st.textContent = `Signal il y a ${ago(sinceFix)}`; }
  else { st.className = "pill lost"; st.textContent = `Signal perdu (${ago(sinceFix)})`; }
  $("#subtitle").textContent = hasData
    ? (M.finished ? `${C.raceName || "Course"} terminée en ${fmtDur(M.finishT - M.t0)} 🎉` : `${C.raceName || ""} · dernière position il y a ${ago(sinceFix)}`)
    : (M && M.t0 ? `Départ prévu à ${fmtClock(M.t0)}` : `${C.raceName || ""} · ${fmtKm(TOTAL)} km`);

  // Carte
  if (hasData) {
    const p = pointAt(d), stale = sinceFix > 6 * 60e3 && !M.finished;
    runnerMk.setLatLng([p.lat, p.lon]); runnerMk.setOpacity(1);
    const key = `${p.bearing > 0 && p.bearing < 180}|${stale}`;
    if (key !== lastIconKey) { runnerMk.setIcon(runnerIcon(p.bearing, stale)); lastIconKey = key; }
    doneLine.setLatLngs(slice(0, d));
    todoLine.setLatLngs(slice(d, TOTAL));
    const lr = M.lastRaw; rawMk.setLatLng([lr.lat, lr.lon]); if (!map.hasLayer(rawMk)) rawMk.addTo(map);
    if (follow && !M.finished) map.panTo([p.lat, p.lon], { animate: true, duration: .8 });
    for (const k of kmMarkers) k.mk.getElement()?.firstChild?.classList.toggle("done", k.w.d <= d);
  }
  // Sécurité : dernière position GPS loin du tracé (mauvais GPX, détour…) → on l'affiche telle quelle
  const offRoute = M && M.lastRaw && !M.finished && (!M.L || M.lastRaw.t - M.L.t > 120e3);
  if (offRoute) {
    const lr = M.lastRaw;
    runnerMk.setLatLng([lr.lat, lr.lon]); runnerMk.setOpacity(1);
    if (follow) map.panTo([lr.lat, lr.lon], { animate: true, duration: .8 });
    $("#subtitle").textContent = `Position hors du tracé · il y a ${ago(sinceFix)}`;
  }
  // Lièvre (allure objectif)
  let ghostD = null;
  if (M && M.t0 && !M.finished && t > M.t0) {
    ghostD = Math.min(TOTAL, (t - M.t0) / TARGET);
    const g = pointAt(ghostD); ghostMk.setLatLng([g.lat, g.lon]); if (!map.hasLayer(ghostMk)) ghostMk.addTo(map);
  } else if (map.hasLayer(ghostMk)) ghostMk.remove();

  // Barre de progression
  const pct = d / TOTAL * 100;
  $("#fill").style.width = pct + "%";
  $("#barRunner").style.left = pct + "%";
  const bg = $("#barGhost");
  if (ghostD !== null) { bg.style.display = "block"; bg.style.left = (ghostD / TOTAL * 100) + "%"; } else bg.style.display = "none";
  $("#kmDone").textContent = fmtKm(d);
  $("#kmTotal").textContent = fmtKm(TOTAL);
  $("#pct").textContent = hasData ? `${Math.floor(pct)} %` : "";

  // Stats
  $("#sElapsed").textContent = M && M.t0 && t > M.t0 ? fmtDur((M.finished ? M.finishT : t) - M.t0) : "—";
  $("#sPace").textContent = hasData ? (M.stopped ? "arrêt" : fmtPace(M.recent || M.avg)) : "—";
  if (M && M.finished) {
    $("#sFinish").textContent = fmtClock(M.finishT); $("#sFinishChrono").textContent = `Chrono ${fmtDur(M.finishT - M.t0)}`;
  } else {
    const ef = etaAt(TOTAL);
    $("#sFinish").textContent = ef && ef.t ? fmtClock(ef.t) : "—";
    $("#sFinishChrono").textContent = ef && ef.t && M.t0 ? `Chrono ≈ ${fmtDur(ef.t - M.t0)}` : "";
  }
  const sd = $("#sDelta");
  if (hasData && M.t0 && M.L.d > 300) {
    const delta = (M.L.t - M.t0) - M.L.d * TARGET; // > 0 : en retard
    sd.textContent = `${delta > 0 ? "+" : "−"}${fmtDur(Math.abs(delta))}`;
    sd.className = delta > 0 ? "behind" : "ahead";
  } else { sd.textContent = "—"; sd.className = ""; }

  renderNext(d);
}

function renderNext(d) {
  const items = waypoints.filter((w) => w.d > d && (w.type !== "km" || w.km % 5 === 0 || w.d - d < 1100)).slice(0, 5);
  const ul = $("#nextList");
  if (M && M.finished) { ul.innerHTML = `<li><span class="ico">🏅</span><span class="lbl">Course terminée !<small>Bravo ${esc(NAME)} 👏</small></span></li>`; return; }
  ul.innerHTML = items.map((w) => {
    const e = etaAt(w.d), ico = w.ico || ({ km: "🔹", ravito: "💧", finish: "🏁", poi: "📍" })[w.type];
    const eta = e && e.t ? `${fmtClock(e.t)}<small>${fmtIn(e.t - now())}</small>` : `—<small>${fmtKm(w.d - d)} km</small>`;
    return `<li data-d="${w.d}"><span class="ico">${ico}</span><span class="lbl">${esc(w.name)}<small>km ${fmtKm(w.d)} · encore ${fmtKm(w.d - d)} km</small></span><span class="eta">${eta}</span></li>`;
  }).join("");
}

function renderSplits() {
  const el = $("#splits");
  if (!M || !M.splits.length) { el.innerHTML = `<span class="muted">Pas encore de kilomètre bouclé.</span>`; return; }
  const avg = M.splits.reduce((s, x) => s + x.ms, 0) / M.splits.length;
  el.innerHTML = M.splits.map((s) =>
    `<span class="split ${s.ms < avg * 0.98 ? "fast" : s.ms > avg * 1.02 ? "slow" : ""}"><b>${s.km}</b>${fmtDur(s.ms)}</span>`).join("");
}

// ─── Encouragements ───────────────────────────────────────────────────────
let cheersReady = false;
function onCheers(list) {
  const seen = new Set(cheers.map((c) => c.id));
  const fresh = list.filter((c) => !seen.has(c.id));
  cheers = list;
  $("#cheerCount").textContent = cheers.length ? `(${cheers.length})` : "";
  if (cheersReady) for (const c of fresh.slice(-3)) toast(`💪 ${c.n || "Quelqu'un"} envoie de la force !`);
  cheersReady = true;
}
function toast(msg) {
  const d = document.createElement("div"); d.className = "toast"; d.textContent = msg;
  $("#toasts").appendChild(d); setTimeout(() => d.remove(), 4200);
}
function burst(emojis, n = 24) {
  for (let i = 0; i < n; i++) {
    const s = document.createElement("div"); s.className = "confetti";
    s.textContent = emojis[i % emojis.length]; s.style.left = Math.random() * 100 + "vw";
    s.style.animationDuration = 2 + Math.random() * 2.5 + "s"; s.style.animationDelay = Math.random() * .8 + "s";
    document.body.appendChild(s); setTimeout(() => s.remove(), 5500);
  }
}
function askName() {
  return new Promise((resolve) => {
    let name = ""; try { name = localStorage.getItem("cheerName") || ""; } catch {}
    if (name) return resolve(name);
    const ov = $("#overlay"); ov.classList.remove("hidden");
    ov.innerHTML = `<div class="box"><h2>💪 Ton prénom ?</h2><p>Pour que tout le monde sache qui encourage ${esc(NAME)}.</p>
      <input id="nameIn" maxlength="20" placeholder="Prénom" autocomplete="given-name"><br><button id="nameOk">Envoyer</button></div>`;
    const ok = () => { const v = $("#nameIn").value.trim().slice(0, 20) || "Un supporter"; try { localStorage.setItem("cheerName", v); } catch {} ov.classList.add("hidden"); resolve(v); };
    $("#nameOk").onclick = ok; $("#nameIn").onkeydown = (e) => e.key === "Enter" && ok(); $("#nameIn").focus();
  });
}

// ─── Sources de données ───────────────────────────────────────────────────
const KEY = decodeURIComponent(location.hash.slice(1)).trim();
const DB = (C.firebaseUrl || "").replace(/\/+$/, "");
let sendCheer = async () => {};

function toPoint(v) {
  if (!v || typeof v !== "object") return null;
  if (v._type && v._type !== "location") return null;
  const lat = +v.lat, lon = +v.lon;
  if (!isFinite(lat) || !isFinite(lon)) return null;
  const t = v.tst ? v.tst * 1000 : +v.t;
  if (!isFinite(t)) return null;
  return { t, lat, lon, acc: +v.acc || 0 };
}

function applyState(state) {
  const tChanged = setTarget(state.meta && state.meta.target);
  if (tChanged && targetReady) toast(`🎯 Nouvel objectif : ${Target.label(target)}`);
  targetReady = true;
  rawPoints = Object.values(state.points || {}).map(toPoint).filter(Boolean);
  computeModel(); renderSplits();
  const cs = Object.entries(state.cheers || {}).map(([id, c]) => ({ id, n: c && c.n, t: c && c.t })).sort((a, b) => a.t - b.t);
  onCheers(cs);
  if (M.finished && !finishedShown) { finishedShown = true; burst(["🎉", "🏅", "🥳", "🏁", "💪"], 40); }
}
let finishedShown = false, targetReady = false;

function startFirebase() {
  let state = {};
  const setAt = (path, data) => {
    const parts = path.split("/").filter(Boolean);
    if (!parts.length) { state = data || {}; return; }
    let o = state; for (let i = 0; i < parts.length - 1; i++) { if (typeof o[parts[i]] !== "object" || !o[parts[i]]) o[parts[i]] = {}; o = o[parts[i]]; }
    const k = parts[parts.length - 1]; if (data === null) delete o[k]; else o[k] = data;
  };
  let pending = null;
  const schedule = () => { clearTimeout(pending); pending = setTimeout(() => applyState(state), 150); };
  let es;
  const connect = () => {
    if (es) es.close();
    es = new EventSource(`${DB}/live/${encodeURIComponent(KEY)}.json`);
    es.addEventListener("put", (e) => { const m = JSON.parse(e.data); setAt(m.path, m.data); schedule(); });
    es.addEventListener("patch", (e) => { const m = JSON.parse(e.data); for (const [k, v] of Object.entries(m.data || {})) setAt(`${m.path}/${k}`, v); schedule(); });
    es.addEventListener("cancel", () => showError("Accès refusé par la base de données. Vérifie les règles Firebase (README)."));
  };
  connect();
  document.addEventListener("visibilitychange", () => { if (!document.hidden && (!es || es.readyState === 2)) connect(); });
  sendCheer = async (n) => {
    await fetch(`${DB}/live/${encodeURIComponent(KEY)}/cheers.json`, { method: "POST", body: JSON.stringify({ n, t: Date.now() }) });
  };
}

function startDemo() {
  document.body.insertAdjacentHTML("beforeend", `<div class="demo-badge">DÉMO · temps accéléré ×20</div>`);
  warp = 20; realStart = Date.now(); virtStart = Date.now();
  let simT = virtStart - 95 * 60e3, simD = 0;
  const paceAt = (d) => (318 + 10 * Math.sin(d / 2500) + (d > 30000 ? (d - 30000) / 400 : 0)); // ms/m
  const pts = {}; let n = 0;
  const emit = () => {
    const p = pointAt(simD), j = () => (Math.random() - .5) * 0.00012;
    pts["p" + (n++)] = { _type: "location", lat: p.lat + j(), lon: p.lon + j(), tst: Math.round(simT / 1000), acc: 8 };
  };
  const step = (dt) => { // dt en ms simulées
    if (simD >= TOTAL) return;
    for (let k = 0; k < dt; k += 1000) simD = Math.min(TOTAL, simD + 1000 / paceAt(simD));
    simT += dt;
  };
  while (simT < now() - 30e3) { step(30e3); emit(); }
  const cheersObj = {};
  const names = ["Marie", "Papa", "Léa", "Tom"];
  applyState({ points: pts, cheers: cheersObj });
  setInterval(() => { if (simD < TOTAL) { step(30e3); emit(); applyState({ points: pts, cheers: cheersObj }); } }, 1500);
  setInterval(() => { cheersObj["c" + Date.now()] = { n: names[Math.floor(Math.random() * names.length)], t: Date.now() }; applyState({ points: pts, cheers: cheersObj }); }, 17000);
  sendCheer = async (name) => { cheersObj["c" + Date.now()] = { n: name, t: Date.now() }; applyState({ points: pts, cheers: cheersObj }); };
}

function showError(html) {
  const ov = $("#overlay"); ov.classList.remove("hidden");
  ov.innerHTML = `<div class="box">${html}</div>`;
}

// ─── Démarrage ────────────────────────────────────────────────────────────
async function main() {
  document.title = `${NAME} en direct`;
  $("#title").textContent = `🏃 ${NAME} en direct`;
  try { await loadRoute(); } catch (e) { showError(`<h2>Parcours introuvable</h2><p>Impossible de lire « ${esc(C.gpx || "trace.gpx")} ».</p>`); return; }
  initMap();
  setTarget(target);
  computeModel();

  $("#btnFollow").onclick = () => { setFollow(!follow); render(); };
  $("#btnAll").onclick = () => { setFollow(false); map.fitBounds(L.latLngBounds(route.map((p) => [p.lat, p.lon])), { padding: [30, 30] }); };
  $("#handle").onclick = () => $("#sheet").classList.toggle("collapsed");
  $("#nextList").onclick = (e) => {
    const li = e.target.closest("li[data-d]"); if (!li) return;
    const p = pointAt(+li.dataset.d); setFollow(false); map.setView([p.lat, p.lon], 16);
    if (matchMedia("(max-width: 759px)").matches) $("#sheet").classList.add("collapsed");
    setTimeout(() => showPassagePopup(L.latLng(p.lat, p.lon)), 300);
  };
  $("#btnCheer").onclick = async () => {
    const n = await askName(); burst(["💪", "🔥", "⚡", "❤️"], 18);
    try { await sendCheer(n); } catch { toast("Envoi impossible (réseau ?)"); }
  };
  if (matchMedia("(max-width: 759px)").matches) $("#sheet").classList.add("collapsed");
  setFollow(true);

  if (KEY === "demo") startDemo();
  else if (!KEY) showError(`<h2>Lien incomplet</h2><p>Il manque la clé de suivi à la fin du lien (après le #). Demande le lien complet au coureur.</p><a class="btn" href="#demo" onclick="setTimeout(()=>location.reload())">Voir la démo</a>`);
  else if (!DB) showError(`<h2>Configuration manquante</h2><p>Renseigne <code>firebaseUrl</code> dans <code>config.js</code>.</p>`);
  else startFirebase();

  render();
  setInterval(render, 1000);
}
main();
})();
