// Munchkin Stärke-Tracker — UI-Logik.
// Rendering: Zustands-getriebenes Neuzeichnen in #app, Events per Delegation
// über data-action-Attribute (kein Re-Binding nötig).

import { createStore, LOCAL_CODE } from "./store.js";
import qrcode from "./vendor/qrcode.js";

const MAX_NAME = 24;

// Bei jedem Deployment sichtbar im Start-Screen — so ist sofort erkennbar,
// ob Browser/CDN noch einen alten Stand ausliefern.
const APP_VERSION = "v1.3 · 2026-07-04";

// Advanced-Features hinter Session-Einstellungen (Default: aus) — neue Nutzer
// sehen nur den Kern: Level + Bonus = Stärke, live für alle.
const SETTING_DEFS = [
  {
    key: "combat",
    icon: "⚔️",
    label: "Kampf-Rechner",
    desc: "Monster, Mitstreiter und Einmal-Boni im Kampf zusammenrechnen — live für den ganzen Tisch.",
  },
  {
    key: "death",
    icon: "💀",
    label: "Gestorben-Knopf",
    desc: "Wendet die Todesregel mit einem Tipp an: Level bleibt, Boni auf 0.",
  },
];

// ------------------------------------------------------------ Präferenzen

const prefs = {
  get name() {
    return localStorage.getItem("munchkin.name") || "";
  },
  set name(v) {
    localStorage.setItem("munchkin.name", v);
  },
  playerIdFor(code) {
    const ids = JSON.parse(localStorage.getItem("munchkin.playerIds") || "{}");
    if (!ids[code]) {
      ids[code] = "p" + crypto.randomUUID().slice(0, 12).replaceAll("-", "");
      localStorage.setItem("munchkin.playerIds", JSON.stringify(ids));
    }
    return ids[code];
  },
};

// ----------------------------------------------------------------- State

let sync = null;

const state = {
  screen: "start", // 'start' | 'session'
  busy: false,
  code: null,
  playerId: null, // im lokalen Modus ungenutzt (alle Karten editierbar)
  session: null,
  unsubscribe: null,
  sheet: null, // 'combat' | 'qr' | null
  confirmingDeath: null, // playerId, dessen "Gestorben" gerade bestätigt wird
  addingPlayer: false, // lokaler Modus: Eingabezeile für neuen Spieler offen
};

const app = document.getElementById("app");

// ---------------------------------------------------------------- Helfer

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

function num(n) {
  // Typografisches Minus statt Bindestrich
  return String(n).replace("-", "−");
}

function signed(n) {
  return n > 0 ? "+" + n : num(n);
}

function strengthOf(p) {
  return (p.level ?? 1) + (p.bonus ?? 0);
}

function playersOf(session) {
  return Object.entries(session?.players || {})
    .map(([id, p]) => ({ id, ...p }))
    .sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0));
}

function joinUrl(code) {
  const url = new URL(location.href);
  url.search = "";
  url.searchParams.set("s", code);
  const emu = new URLSearchParams(location.search).get("emu");
  if (emu !== null) url.searchParams.set("emu", emu);
  return url.toString();
}

function setUrl(code) {
  const url = new URL(location.href);
  const emu = url.searchParams.get("emu");
  url.search = "";
  if (code) url.searchParams.set("s", code);
  if (emu !== null) url.searchParams.set("emu", emu);
  history.replaceState(null, "", url.toString());
}

let toastTimer = null;
function toast(msg) {
  let el = document.getElementById("toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2200);
}

// Bildschirm anlassen, solange die Runde offen ist — das Handy soll einfach
// neben dem Brett liegen können.
let wakeLock = null;
async function keepAwake() {
  try {
    if (state.screen === "session" && document.visibilityState === "visible") {
      wakeLock = await navigator.wakeLock?.request("screen");
    }
  } catch {
    /* nicht unterstützt oder verweigert — egal */
  }
}
document.addEventListener("visibilitychange", keepAwake);

// -------------------------------------------------------------- Rendering

let renderQueued = false;
function render() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    app.innerHTML = state.screen === "session" ? viewSession() : viewStart();
    // Einblende-Animation nur beim Öffnen des Sheets — nicht bei jedem
    // Re-Render (sonst flackert es bei jedem Sync-Update/Tap).
    state.sheetAnim = false;
  });
}

function openSheet(kind) {
  state.sheet = kind;
  state.sheetAnim = true;
  render();
}

function viewStart() {
  const local = !sync.live;
  const hasLocalSession = local && state.localSessionExists;
  return `
  <div class="screen screen-start">
    <header class="start-head">
      <div class="logo">⚔️</div>
      <h1>Munchkin<br><span>Stärke&#8209;Tracker</span></h1>
      <p class="tagline">Level + Bonus zählen — das Spiel bleibt auf dem Tisch.</p>
    </header>

    <label class="field">
      <span>Dein Name</span>
      <input id="name-input" type="text" maxlength="${MAX_NAME}" autocomplete="nickname"
             placeholder="z.B. Hilde" value="${esc(prefs.name)}">
    </label>

    ${local ? `
      <button class="btn btn-primary" data-action="create">
        ${hasLocalSession ? "Neue lokale Runde" : "Lokale Runde starten"}
      </button>
      ${hasLocalSession ? `<button class="btn" data-action="resume-local">Letzte Runde fortsetzen</button>` : ""}
      <p class="hint-local">Ohne Firebase-Setup läuft das Tool nur auf diesem Gerät
      (Handy herumreichen). Live-Sync für alle Handys: siehe README.</p>
    ` : `
      <button class="btn btn-primary" data-action="create" ${state.busy ? "disabled" : ""}>Neue Runde starten</button>
      <div class="divider"><span>oder beitreten</span></div>
      <form class="join-row" data-action-submit="join">
        <input id="code-input" type="text" maxlength="5" placeholder="CODE"
               autocapitalize="characters" autocomplete="off" spellcheck="false"
               value="${esc(state.prefillCode || "")}">
        <button class="btn" type="submit" ${state.busy ? "disabled" : ""}>Beitreten</button>
      </form>
    `}
    <p class="version">${esc(APP_VERSION)}</p>
  </div>`;
}

function viewSession() {
  const s = state.session;
  const players = playersOf(s);
  const local = !sync.live;
  const me = local ? null : players.find((p) => p.id === state.playerId);
  const others = local ? [] : players.filter((p) => p.id !== state.playerId);
  const maxLevel = Math.max(0, ...players.map((p) => p.level ?? 1));
  const crowned = maxLevel >= 2 ? new Set(players.filter((p) => (p.level ?? 1) === maxLevel).map((p) => p.id)) : new Set();
  const winner = players.find((p) => (p.level ?? 1) >= 10);
  const settings = s?.settings || {};
  const combat = settings.combat ? s?.combat : null;

  return `
  <div class="screen screen-session">
    <header class="session-head">
      <span class="head-title">⚔️</span>
      ${local
        ? `<span class="code-chip code-chip-static">Lokale Runde</span>`
        : `<button class="code-chip" data-action="open-qr" title="Code & QR zeigen">
             Code <strong>${esc(state.code)}</strong>
             <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M1 1h6v6H1V1zm2 2v2h2V3H3zm6-2h6v6H9V1zm2 2v2h2V3h-2zM1 9h6v6H1V9zm2 2v2h2v-2H3zm8-2h2v2h-2V9zm2 2h2v2h-2v-2zm-2 2h2v2h-2v-2z"/></svg>
           </button>`}
      <button class="icon-btn" data-action="open-settings" title="Einstellungen" aria-label="Einstellungen">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="10" cy="10" r="2.6"/><path d="M10 2.2v2.1m0 11.4v2.1M2.2 10h2.1m11.4 0h2.1M4.5 4.5l1.5 1.5m8 8 1.5 1.5m0-11-1.5 1.5m-8 8-1.5 1.5"/></svg>
      </button>
    </header>

    ${winner ? `<div class="banner banner-victory">🏆 <strong>${esc(winner.name)}</strong> hat Level 10 — Sieg!</div>` : ""}
    ${combat && state.sheet !== "combat" ? viewCombatBanner(combat, players) : ""}

    ${local
      ? players.map((p) => viewOwnCard(p, crowned, players, { local: true })).join("") || `<p class="empty">Noch keine Spieler.</p>`
      : me
        ? viewOwnCard(me, crowned, players, { local: false })
        : `<p class="empty">Verbinde …</p>`}

    ${local ? viewAddPlayer() : ""}

    ${others.length ? `
      <ul class="others">
        ${others.map((p) => viewOtherRow(p, crowned)).join("")}
      </ul>` : ""}
    ${!local && !others.length ? `
      <p class="empty">Noch niemand sonst da.<br>
      <button class="btn btn-small" data-action="open-qr">Mitspieler einladen</button></p>` : ""}

    ${state.sheet === "qr" ? viewQrSheet() : ""}
    ${state.sheet === "combat" && combat ? viewCombatSheet(combat, players) : ""}
    ${state.sheet === "settings" ? viewSettingsSheet(settings) : ""}
  </div>`;
}

function viewOwnCard(p, crowned, players, { local }) {
  const settings = state.session?.settings || {};
  const dying = state.confirmingDeath === p.id;
  const level = p.level ?? 1;
  const bonus = p.bonus ?? 0;
  return `
  <section class="card own-card" data-player="${esc(p.id)}">
    <div class="card-head">
      <span class="player-name">${crowned.has(p.id) ? "👑 " : ""}${esc(p.name)}</span>
      ${!settings.death ? "" : dying ? `
        <span class="death-confirm">
          Boni auf 0?
          <button class="btn btn-small btn-danger" data-action="death-confirm" data-player="${esc(p.id)}">Ja, tot</button>
          <button class="btn btn-small" data-action="death-cancel">Nein</button>
        </span>` : `
        <button class="ghost-btn" data-action="death" data-player="${esc(p.id)}" title="Gestorben: Level bleibt, Boni auf 0">💀 Gestorben</button>`}
    </div>

    <div class="strength">
      <span class="strength-value">${num(level + bonus)}</span>
      <span class="stat-label">Stärke</span>
    </div>

    <div class="stat-row">
      ${viewStepper("Level", "level", level, p.id, { min: 1, max: 10 })}
      ${viewStepper("Bonus", "bonus", bonus, p.id, { min: -99, max: 999, signed: true })}
    </div>

    ${level === 9 ? `<p class="rule-hint">⚔️ Noch 1 Level — Level 10 gibt’s nur durch einen Monster&#8209;Kill.</p>` : ""}

    ${settings.combat ? `
    <button class="btn btn-combat" data-action="open-combat" data-player="${esc(p.id)}"
            ${state.session?.combat ? "disabled" : ""}>⚔️ Kampf</button>` : ""}
  </section>`;
}

function viewStepper(label, field, value, playerId, { min, max, signed: sgn }) {
  return `
  <div class="stepper">
    <span class="stat-label">${label}</span>
    <div class="step-row">
      <button class="step-btn" data-action="step" data-field="${field}" data-delta="-1"
              data-player="${esc(playerId)}" ${value <= min ? "disabled" : ""} aria-label="${label} verringern">−</button>
      <span class="step-value">${sgn ? signed(value) : num(value)}</span>
      <button class="step-btn" data-action="step" data-field="${field}" data-delta="1"
              data-player="${esc(playerId)}" ${value >= max ? "disabled" : ""} aria-label="${label} erhöhen">+</button>
    </div>
  </div>`;
}

function viewOtherRow(p, crowned) {
  const offline = p.online === false;
  return `
  <li class="other-row${offline ? " offline" : ""}">
    <div class="other-info">
      <span class="player-name">${crowned.has(p.id) ? "👑 " : ""}${esc(p.name)}${offline ? " · offline" : ""}</span>
      <span class="other-detail">Level ${num(p.level ?? 1)} · Bonus ${signed(p.bonus ?? 0)}</span>
    </div>
    <span class="other-strength">${num(strengthOf(p))}</span>
  </li>`;
}

function viewAddPlayer() {
  if (!state.addingPlayer) {
    return `<button class="btn btn-small btn-add" data-action="add-player">+ Spieler hinzufügen</button>`;
  }
  return `
  <form class="join-row add-row" data-action-submit="add-player-confirm">
    <input id="add-name-input" type="text" maxlength="${MAX_NAME}" placeholder="Name" autocomplete="off">
    <button class="btn" type="submit">OK</button>
  </form>`;
}

// ------------------------------------------------------------------ Kampf

function combatMath(combat, players) {
  const byId = Object.fromEntries(players.map((p) => [p.id, p]));
  const fighter = byId[combat.fighterId];
  const helpers = Object.keys(combat.helpers || {})
    .map((id) => byId[id])
    .filter((p) => p && p.id !== combat.fighterId);
  const heroes =
    (fighter ? strengthOf(fighter) : 0) +
    helpers.reduce((sum, p) => sum + strengthOf(p), 0) +
    (combat.oneShot || 0);
  const monster = combat.monster || 1;
  return { fighter, helpers, heroes, monster, diff: heroes - monster };
}

function verdictHtml(m) {
  if (m.diff > 0) return `<div class="verdict win">Gewinnt <span>(+${num(m.diff)})</span></div>`;
  if (m.diff === 0) return `<div class="verdict tie">Gleichstand <span>— nur Krieger gewinnen</span></div>`;
  return `<div class="verdict lose">Verliert <span>(${num(m.diff)})</span><small>Weglaufen: ab Würfel 5</small></div>`;
}

function viewCombatBanner(combat, players) {
  const m = combatMath(combat, players);
  const names = [m.fighter?.name, ...m.helpers.map((h) => h.name)].filter(Boolean).map(esc).join(" + ");
  return `
  <button class="banner banner-combat" data-action="open-combat-view">
    ⚔️ <strong>${names || "?"}</strong>&ensp;${num(m.heroes)} vs. ${num(m.monster)}&ensp;
    <span class="${m.diff > 0 ? "win" : m.diff === 0 ? "tie" : "lose"}">${m.diff > 0 ? "gewinnt" : m.diff === 0 ? "Gleichstand" : "verliert"}</span>
  </button>`;
}

function viewCombatSheet(combat, players) {
  const m = combatMath(combat, players);
  const local = !sync.live;
  const iAmFighter = local || combat.fighterId === state.playerId;
  const iAmHelping = !!combat.helpers?.[state.playerId];
  const iRequested = !!combat.helpRequests?.[state.playerId];
  const candidates = players.filter((p) => p.id !== combat.fighterId);
  const requests = candidates.filter((p) => combat.helpRequests?.[p.id] && !combat.helpers?.[p.id]);

  return `
  <div class="backdrop" data-action="close-sheet"></div>
  <div class="sheet${state.sheetAnim ? " sheet-anim" : ""}" role="dialog" aria-label="Kampf">
    <div class="sheet-grab"></div>
    <h2>⚔️ ${esc(m.fighter?.name || "?")} kämpft</h2>

    ${verdictHtml(m)}
    <div class="combat-totals">${num(m.heroes)} <span>vs.</span> ${num(m.monster)}</div>

    <div class="combat-steppers">
      <div class="stepper stepper-wide">
        <span class="stat-label">Monster (gesamt)</span>
        <div class="step-row">
          <button class="step-btn" data-action="cstep" data-field="monster" data-delta="-1" ${m.monster <= 1 ? "disabled" : ""} aria-label="Monster verringern">−</button>
          <span class="step-value">${num(m.monster)}</span>
          <button class="step-btn" data-action="cstep" data-field="monster" data-delta="1" aria-label="Monster erhöhen">+</button>
        </div>
      </div>
      <div class="stepper stepper-wide">
        <span class="stat-label">Einmal-Boni</span>
        <div class="step-row">
          <button class="step-btn" data-action="cstep" data-field="oneShot" data-delta="-1" aria-label="Einmal-Boni verringern">−</button>
          <span class="step-value">${signed(combat.oneShot || 0)}</span>
          <button class="step-btn" data-action="cstep" data-field="oneShot" data-delta="1" aria-label="Einmal-Boni erhöhen">+</button>
        </div>
      </div>
    </div>
    <p class="hint-combat">Tränke, Flüche &amp; Co. darf jeder hier einrechnen — auf beiden Seiten.</p>

    ${iAmFighter && requests.length ? `
    <div class="helper-block">
      <span class="stat-label">Anfragen</span>
      ${requests.map((p) => `
      <div class="request-row">
        <span class="request-text">🤝 <strong>${esc(p.name)}</strong> will mithelfen (Stärke ${num(strengthOf(p))})</span>
        <span class="request-actions">
          <button class="btn btn-small btn-primary" data-action="accept-help" data-player="${esc(p.id)}">Annehmen</button>
          <button class="btn btn-small" data-action="decline-help" data-player="${esc(p.id)}">Nein</button>
        </span>
      </div>`).join("")}
    </div>` : ""}

    ${candidates.length ? `
    <div class="helper-block">
      <span class="stat-label">Mitstreiter (Stärke wird addiert)</span>
      <div class="helper-chips">
        ${candidates.map((p) => {
          const on = !!combat.helpers?.[p.id];
          const pending = !on && !!combat.helpRequests?.[p.id];
          return `<button class="chip${on ? " on" : ""}${pending ? " pending" : ""}" data-action="toggle-helper" data-player="${esc(p.id)}"
                    ${iAmFighter ? "" : "disabled"}>${esc(p.name)} (${num(strengthOf(p))})${pending ? " ?" : ""}</button>`;
        }).join("")}
      </div>
    </div>` : ""}

    <div class="sheet-actions">
      ${iAmFighter ? `
        <button class="btn btn-primary" data-action="combat-win">🏆 Sieg — Level +1</button>
        <button class="btn" data-action="combat-end">Kampf beenden</button>
      ` : `
        ${iAmHelping
          ? `<button class="btn" data-action="leave-help">Nicht mehr mithelfen</button>`
          : iRequested
            ? `<button class="btn" data-action="cancel-help-request">Anfrage gesendet … zurückziehen</button>`
            : `<button class="btn btn-primary" data-action="request-help">🤝 Mithelfen anfragen</button>`}
        <button class="btn btn-small" data-action="combat-end">Kampf beenden (falls hängen geblieben)</button>
      `}
    </div>
  </div>`;
}

// ------------------------------------------------------------ Einstellungen

function viewSettingsSheet(settings) {
  return `
  <div class="backdrop" data-action="close-sheet"></div>
  <div class="sheet${state.sheetAnim ? " sheet-anim" : ""}" role="dialog" aria-label="Einstellungen">
    <div class="sheet-grab"></div>
    <h2>Einstellungen</h2>
    <p class="sheet-sub">Gilt für die ganze Runde — jeder am Tisch darf schalten.</p>
    ${SETTING_DEFS.map((d) => `
    <label class="setting-row">
      <span class="setting-text">
        <strong>${d.icon} ${d.label}</strong>
        <small>${d.desc}</small>
      </span>
      <input type="checkbox" class="switch" data-change="toggle-setting" data-key="${d.key}"
             ${settings[d.key] ? "checked" : ""} aria-label="${d.label} umschalten">
    </label>`).join("")}
    <div class="sheet-actions">
      <button class="btn" data-action="leave">Runde verlassen</button>
      <button class="btn btn-small" data-action="close-sheet">Schließen</button>
    </div>
  </div>`;
}

// --------------------------------------------------------------------- QR

function viewQrSheet() {
  const url = joinUrl(state.code);
  const qr = qrcode(0, "M");
  qr.addData(url);
  qr.make();
  return `
  <div class="backdrop" data-action="close-sheet"></div>
  <div class="sheet sheet-qr${state.sheetAnim ? " sheet-anim" : ""}" role="dialog" aria-label="Mitspieler einladen">
    <div class="sheet-grab"></div>
    <h2>Mitspieler einladen</h2>
    <p class="code-big">${esc(state.code)}</p>
    <div class="qr-box">${qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true })}</div>
    <div class="sheet-actions">
      ${navigator.share ? `<button class="btn btn-primary" data-action="share">Link teilen</button>` : ""}
      <button class="btn ${navigator.share ? "" : "btn-primary"}" data-action="copy-link">Link kopieren</button>
      <button class="btn btn-small" data-action="close-sheet">Schließen</button>
    </div>
  </div>`;
}

// ---------------------------------------------------------------- Aktionen

function requireName(input) {
  const name = (input?.value || "").trim().slice(0, MAX_NAME);
  if (!name) {
    toast("Bitte erst einen Namen eingeben");
    input?.focus();
    return null;
  }
  prefs.name = name;
  return name;
}

async function enterSession(code, playerId) {
  state.code = code;
  state.playerId = playerId;
  state.screen = "session";
  state.sheet = null;
  state.confirmingDeath = null;
  state.unsubscribe?.();
  state.unsubscribe = sync.subscribe(code, (session) => {
    // Kämpfer per Toast auf neue Mithelfen-Anfragen hinweisen (falls das
    // Kampf-Sheet gerade nicht offen ist, würde er sie sonst verpassen)
    if (sync.live && session?.combat?.fighterId === state.playerId) {
      const prev = state.session?.combat?.helpRequests || {};
      for (const pid of Object.keys(session.combat.helpRequests || {})) {
        if (!prev[pid]) toast(`🤝 ${session.players?.[pid]?.name || "Jemand"} möchte mithelfen`);
      }
    }
    // Umgeschaltete Einstellungen ansagen, damit der Tisch versteht, warum
    // ein Button auftaucht/verschwindet. Nicht beim allerersten Snapshot.
    if (state.session) {
      const prev = state.session.settings || {};
      const next = session?.settings || {};
      for (const d of SETTING_DEFS) {
        if (!!prev[d.key] !== !!next[d.key]) {
          toast(`${d.icon} ${d.label} ${next[d.key] ? "aktiviert" : "deaktiviert"}`);
        }
      }
    }
    state.session = session;
    // Kampf-Sheet schließen, wenn der Kampf (von wem auch immer) beendet wurde
    if (state.sheet === "combat" && !session?.combat) state.sheet = null;
    render();
  });
  if (sync.live) setUrl(code);
  keepAwake();
  render();
}

const actions = {
  async create() {
    const name = requireName(document.getElementById("name-input"));
    if (!name) return;
    state.busy = true;
    render();
    try {
      const code = await sync.createSession();
      const playerId = sync.live
        ? prefs.playerIdFor(code)
        : "p" + crypto.randomUUID().slice(0, 12).replaceAll("-", "");
      await sync.join(code, playerId, name);
      await enterSession(code, sync.live ? playerId : null);
    } catch (e) {
      console.error(e);
      toast("Verbindung fehlgeschlagen — bitte nochmal versuchen");
    } finally {
      state.busy = false;
      render();
    }
  },

  async join() {
    const name = requireName(document.getElementById("name-input"));
    if (!name) return;
    const code = (document.getElementById("code-input")?.value || "").trim().toUpperCase();
    if (code.length !== 5) {
      toast("Der Code hat 5 Zeichen");
      document.getElementById("code-input")?.focus();
      return;
    }
    state.busy = true;
    render();
    try {
      if (!(await sync.sessionExists(code))) {
        toast(`Runde ${code} nicht gefunden`);
        return;
      }
      const playerId = prefs.playerIdFor(code);
      await sync.join(code, playerId, name);
      await enterSession(code, playerId);
    } catch (e) {
      console.error(e);
      toast("Verbindung fehlgeschlagen — bitte nochmal versuchen");
    } finally {
      state.busy = false;
      render();
    }
  },

  async "resume-local"() {
    await enterSession(LOCAL_CODE, null);
  },

  step(el) {
    const { field, player } = el.dataset;
    const delta = Number(el.dataset.delta);
    const p = state.session?.players?.[player];
    if (!p) return;
    const limits = field === "level" ? [1, 10] : [-99, 999];
    const next = Math.min(limits[1], Math.max(limits[0], (p[field] ?? (field === "level" ? 1 : 0)) + delta));
    sync.updatePlayer(state.code, player, { [field]: next });
  },

  death(el) {
    state.confirmingDeath = el.dataset.player;
    render();
    // Nach kurzer Zeit automatisch zurücksetzen — kein Modal nötig
    setTimeout(() => {
      if (state.confirmingDeath === el.dataset.player) {
        state.confirmingDeath = null;
        render();
      }
    }, 4000);
  },

  "death-confirm"(el) {
    sync.updatePlayer(state.code, el.dataset.player, { bonus: 0 });
    state.confirmingDeath = null;
    toast("💀 Boni entfernt — Level bleibt");
    render();
  },

  "death-cancel"() {
    state.confirmingDeath = null;
    render();
  },

  "open-combat"(el) {
    const fighterId = el.dataset.player;
    sync.setCombat(state.code, {
      fighterId,
      monster: 2,
      oneShot: 0,
      startedAt: Date.now(),
    });
    openSheet("combat");
  },

  "open-combat-view"() {
    openSheet("combat");
  },

  cstep(el) {
    const combat = state.session?.combat;
    if (!combat) return;
    const { field } = el.dataset;
    const delta = Number(el.dataset.delta);
    const min = field === "monster" ? 1 : -999;
    const next = Math.min(999, Math.max(min, (combat[field] || 0) + delta));
    sync.setCombat(state.code, { ...combat, [field]: next });
  },

  // Nur der Kämpfer (bzw. lokaler Modus): Mitstreiter direkt setzen —
  // das bildet den mündlichen Deal am Tisch ab. Nimmt eine offene Anfrage
  // desselben Spielers gleich mit an.
  "toggle-helper"(el) {
    const combat = state.session?.combat;
    if (!combat) return;
    const id = el.dataset.player;
    const next = !combat.helpers?.[id];
    sync.setHelper(state.code, id, next);
    if (next && combat.helpRequests?.[id]) sync.setHelpRequest(state.code, id, false);
  },

  "request-help"() {
    if (!state.session?.combat) return;
    sync.setHelpRequest(state.code, state.playerId, true);
  },

  "cancel-help-request"() {
    sync.setHelpRequest(state.code, state.playerId, false);
  },

  "leave-help"() {
    sync.setHelper(state.code, state.playerId, false);
  },

  "accept-help"(el) {
    const id = el.dataset.player;
    sync.setHelper(state.code, id, true);
    sync.setHelpRequest(state.code, id, false);
  },

  "decline-help"(el) {
    sync.setHelpRequest(state.code, el.dataset.player, false);
  },

  "combat-win"() {
    const combat = state.session?.combat;
    if (!combat) return;
    const fighter = state.session?.players?.[combat.fighterId];
    if (fighter) {
      sync.updatePlayer(state.code, combat.fighterId, { level: Math.min(10, (fighter.level ?? 1) + 1) });
    }
    sync.setCombat(state.code, null);
    state.sheet = null;
    toast("🏆 Monster besiegt — Level +1");
    render();
  },

  "combat-end"() {
    sync.setCombat(state.code, null);
    state.sheet = null;
    render();
  },

  "open-qr"() {
    openSheet("qr");
  },

  "open-settings"() {
    openSheet("settings");
  },

  "toggle-setting"(el) {
    const key = el.dataset.key;
    const next = !state.session?.settings?.[key];
    sync.setSetting(state.code, key, next);
    // Kampf-Rechner abschalten beendet einen laufenden Kampf mit —
    // sonst bliebe ein unsichtbarer Kampf im Datenmodell hängen.
    if (key === "combat" && !next && state.session?.combat) {
      sync.setCombat(state.code, null);
    }
  },

  "close-sheet"() {
    state.sheet = null;
    render();
  },

  async share() {
    try {
      await navigator.share({ title: "Munchkin-Runde " + state.code, url: joinUrl(state.code) });
    } catch {
      /* abgebrochen */
    }
  },

  async "copy-link"() {
    try {
      await navigator.clipboard.writeText(joinUrl(state.code));
      toast("Link kopiert");
    } catch {
      toast(joinUrl(state.code));
    }
  },

  "add-player"() {
    state.addingPlayer = true;
    render();
    requestAnimationFrame(() => document.getElementById("add-name-input")?.focus());
  },

  async "add-player-confirm"() {
    const name = (document.getElementById("add-name-input")?.value || "").trim().slice(0, MAX_NAME);
    if (!name) return;
    await sync.join(state.code, "p" + crypto.randomUUID().slice(0, 12).replaceAll("-", ""), name);
    state.addingPlayer = false;
    render();
  },

  leave() {
    state.unsubscribe?.();
    state.unsubscribe = null;
    if (sync.live && state.playerId) {
      // Eintrag bleibt bestehen (Rejoin über gleichen Link möglich),
      // nur als offline markieren.
      sync.updatePlayer(state.code, state.playerId, { online: false });
    }
    state.screen = "start";
    state.session = null;
    state.code = null;
    state.sheet = null;
    state.localSessionExists = !sync.live && localStorage.getItem("munchkin.localSession") !== null;
    setUrl(null);
    wakeLock?.release?.();
    render();
  },
};

// ------------------------------------------------------ Event-Delegation

app.addEventListener("click", (e) => {
  const el = e.target.closest("[data-action]");
  if (!el || el.disabled) return;
  // Steppers werden über pointerdown (mit Halte-Wiederholung) bedient
  if (el.dataset.action === "step" || el.dataset.action === "cstep") return;
  actions[el.dataset.action]?.(el);
});

app.addEventListener("change", (e) => {
  const el = e.target.closest("[data-change]");
  if (el) actions[el.dataset.change]?.(el);
});

app.addEventListener("submit", (e) => {
  const form = e.target.closest("[data-action-submit]");
  if (!form) return;
  e.preventDefault();
  actions[form.dataset.actionSubmit]?.(form);
});

// Halten auf +/− wiederholt den Schritt — schneller als 10× tippen.
let holdTimer = null;
let holdInterval = null;

app.addEventListener("pointerdown", (e) => {
  const el = e.target.closest('[data-action="step"], [data-action="cstep"]');
  if (!el || el.disabled) return;
  e.preventDefault();
  const fire = () => {
    // Element wird bei jedem Render ersetzt — Aktion über Selektor neu auflösen
    const live = document.querySelector(
      `[data-action="${el.dataset.action}"][data-field="${el.dataset.field}"][data-delta="${el.dataset.delta}"]` +
        (el.dataset.player ? `[data-player="${CSS.escape(el.dataset.player)}"]` : "")
    );
    if (live && !live.disabled) actions[el.dataset.action](live);
  };
  fire();
  holdTimer = setTimeout(() => {
    holdInterval = setInterval(fire, 110);
  }, 450);
});

// window statt app: pointerleave bubbelt nicht, und der Finger kann beim
// Halten vom Button rutschen — pointerup/-cancel kommen immer auf window an.
for (const evt of ["pointerup", "pointercancel"]) {
  window.addEventListener(evt, () => {
    clearTimeout(holdTimer);
    clearInterval(holdInterval);
    holdTimer = holdInterval = null;
  });
}

// ------------------------------------------------------------------ Start

async function init() {
  sync = await createStore();
  const params = new URLSearchParams(location.search);
  const codeParam = (params.get("s") || "").toUpperCase();

  if (!sync.live) {
    state.localSessionExists = localStorage.getItem("munchkin.localSession") !== null;
    render();
    return;
  }

  if (/^[A-Z2-9]{5}$/.test(codeParam)) {
    // Direktlink: mit gespeichertem Namen sofort (wieder) beitreten
    if (prefs.name) {
      try {
        if (await sync.sessionExists(codeParam)) {
          const playerId = prefs.playerIdFor(codeParam);
          await sync.join(codeParam, playerId, prefs.name);
          await enterSession(codeParam, playerId);
          return;
        }
        toast(`Runde ${codeParam} nicht gefunden`);
      } catch (e) {
        console.error(e);
        toast("Verbindung fehlgeschlagen");
      }
    }
    state.prefillCode = codeParam;
  }
  render();
}

// Startfehler dürfen nie in einer leeren Seite enden — lieber eine
// verständliche Fehlerkarte zeigen als einen Blackscreen.
init().catch((e) => {
  console.error(e);
  app.innerHTML = `
  <div class="screen screen-start">
    <header class="start-head">
      <div class="logo">⚠️</div>
      <h1>Hoppla</h1>
      <p class="tagline">Die App konnte nicht starten.</p>
    </header>
    <p class="error-detail">${esc(e?.message || e)}</p>
    <button class="btn btn-primary" onclick="location.reload()">Neu laden</button>
    <p class="version">${esc(APP_VERSION)}</p>
  </div>`;
});
