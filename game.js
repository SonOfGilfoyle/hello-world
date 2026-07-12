/* ============================================================
   PFANDLORD – Vom Penner zur Legende
   Ein modernes Pennergame-Remake. Vanilla JS, keine Dependencies.
   ============================================================ */
"use strict";

/* ---------------- Spieldaten ---------------- */

const DISTRICTS = [
  { name: "Vorstadt",           emoji: "🏘️", mult: 1.0, lvl: 1  },
  { name: "Bahnhofsviertel",    emoji: "🚉", mult: 1.6, lvl: 4  },
  { name: "Uni-Campus",         emoji: "🎓", mult: 2.4, lvl: 10 },
  { name: "Innenstadt",         emoji: "🏙️", mult: 3.5, lvl: 18 },
  { name: "Hafenviertel",       emoji: "⚓", mult: 5.5, lvl: 28 },
  { name: "Stadion & Festwiese",emoji: "🏟️", mult: 9.0, lvl: 40 },
];

const MISSIONS = [
  { name: "Kurze Runde",     sec: 30,   bonus: 1.0  },
  { name: "Feierabend-Tour", sec: 120,  bonus: 1.15 },
  { name: "Große Tour",      sec: 600,  bonus: 1.3  },
  { name: "Nachtschicht",    sec: 1800, bonus: 1.5  },
  { name: "Wochenend-Marathon", sec: 7200, bonus: 1.8 },
  { name: "Legendäre Expedition", sec: 28800, bonus: 2.2 },
];

const ITEMS = {
  beutel: {
    emoji: "🛍️", name: "Transport",
    desc: "Mehr Platz für Flaschen.",
    stages: ["Plastiktüte", "Jutebeutel", "Trekking-Rucksack", "Einkaufswagen", "Lastenrad", "Sprinter (geliehen)"],
    costs: [40, 250, 1200, 8000, 50000],
    capacity: [30, 80, 200, 500, 1200, 3000],
  },
  hund: {
    emoji: "🐕", name: "Begleiter",
    desc: "+15 % Flaschen pro Stufe. Bester Freund inklusive.",
    stages: ["Kein Hund", "Straßenköter", "Dackel „Kalle“", "Labrador „Bolle“", "Schäferhund „Rex“", "Königspudel „Baron“"],
    costs: [60, 400, 2500, 15000, 90000],
  },
  radar: {
    emoji: "🔦", name: "Spürtechnik",
    desc: "+12 % Flaschen pro Stufe.",
    stages: ["Bloße Hände", "Taschenlampe", "Greifzange", "Magnet-Angel", "Pfand-Radar-App", "Suchdrohne"],
    costs: [30, 200, 1500, 10000, 60000],
  },
  scooter: {
    emoji: "🛴", name: "Mobilität",
    desc: "-8 % Tourdauer pro Stufe.",
    stages: ["Zu Fuß", "Skateboard", "Klapprad", "E-Scooter", "E-Bike", "Turbo-Lastenrad"],
    costs: [80, 500, 3000, 20000, 120000],
  },
  lager: {
    emoji: "🏕️", name: "Schlafplatz",
    desc: "Mehr Offline-Sammelzeit & -Rate.",
    stages: ["Parkbank", "Schlafsack", "Zelt", "Bauwagen", "WG-Zimmer", "Tiny House"],
    costs: [50, 300, 2000, 12000, 80000],
  },
};

const SKILLS = {
  sammeln:  { emoji: "🧐", name: "Flaschenkunde",  desc: "+6 % Flaschen pro Stufe" },
  feilschen:{ emoji: "🤝", name: "Feilschen",      desc: "+5 % Verkaufspreis pro Stufe" },
  schnorren:{ emoji: "🗣️", name: "Schnorr-Rhetorik", desc: "+12 % Bettel-Einnahmen pro Stufe" },
  stadt:    { emoji: "🗺️", name: "Stadtkenntnis",  desc: "-3 % Tourdauer pro Stufe" },
};
const SKILL_MAX = 20;

const TITLES = [
  [1,  "Frischling"],
  [5,  "Flaschensammler"],
  [10, "Pfand-Profi"],
  [18, "Kiez-Kenner"],
  [25, "Straßen-Legende"],
  [35, "Pfand-Baron"],
  [50, "PFANDLORD"],
];

const ACHIEVEMENTS = [
  { id: "f1",    icon: "🍼", name: "Erster Fund",        desc: "Sammle deine erste Flasche",        reward: 5,     cond: s => s.totalFlaschen >= 1 },
  { id: "f100",  icon: "🍾", name: "Kastenweise",        desc: "100 Flaschen gesammelt",            reward: 20,    cond: s => s.totalFlaschen >= 100 },
  { id: "f1k",   icon: "🥂", name: "Glascontainer",      desc: "1.000 Flaschen gesammelt",          reward: 100,   cond: s => s.totalFlaschen >= 1000 },
  { id: "f10k",  icon: "🏭", name: "Recycling-Werk",     desc: "10.000 Flaschen gesammelt",         reward: 800,   cond: s => s.totalFlaschen >= 10000 },
  { id: "f100k", icon: "🌍", name: "Umweltheld",         desc: "100.000 Flaschen gesammelt",        reward: 5000,  cond: s => s.totalFlaschen >= 100000 },
  { id: "g100",  icon: "💵", name: "Erster Hunni",       desc: "100 € Gesamteinnahmen",             reward: 25,    cond: s => s.totalGeld >= 100 },
  { id: "g1k",   icon: "💰", name: "Matratzen-Sparer",   desc: "1.000 € Gesamteinnahmen",           reward: 150,   cond: s => s.totalGeld >= 1000 },
  { id: "g10k",  icon: "🏦", name: "Schwarzgeld… äh, Pfandgeld", desc: "10.000 € Gesamteinnahmen",  reward: 1000,  cond: s => s.totalGeld >= 10000 },
  { id: "g100k", icon: "🤑", name: "Pfand-Millionär in spe", desc: "100.000 € Gesamteinnahmen",     reward: 7500,  cond: s => s.totalGeld >= 100000 },
  { id: "lvl5",  icon: "📈", name: "Es läuft",           desc: "Erreiche Level 5",                  reward: 30,    cond: s => s.level >= 5 },
  { id: "lvl15", icon: "🚀", name: "Aufsteiger",         desc: "Erreiche Level 15",                 reward: 250,   cond: s => s.level >= 15 },
  { id: "lvl30", icon: "👑", name: "Kiez-König",         desc: "Erreiche Level 30",                 reward: 2000,  cond: s => s.level >= 30 },
  { id: "hund",  icon: "🐕", name: "Bester Freund",      desc: "Adoptiere einen Hund",              reward: 40,    cond: s => s.items.hund >= 1 },
  { id: "combo", icon: "🔥", name: "Schnorr-Maschine",   desc: "Erreiche Combo x3",                 reward: 60,    cond: s => s.maxCombo >= 50 },
  { id: "kurs",  icon: "📊", name: "Wolf of Pfandstraße", desc: "Verkaufe bei Kurs ≥ 0,40 €",       reward: 120,   cond: s => s.soldHighKurs },
  { id: "streak3", icon: "🗓️", name: "Stammgast",        desc: "3 Tage Login-Streak",               reward: 75,    cond: s => s.streak.best >= 3 },
  { id: "streak7", icon: "🔥", name: "Woche durchgezogen", desc: "7 Tage Login-Streak",             reward: 400,   cond: s => s.streak.best >= 7 },
  { id: "prestige", icon: "⭐", name: "Respektsperson",   desc: "Erster Neuanfang mit Respekt",      reward: 500,   cond: s => s.prestigeCount >= 1 },
];

const MISSION_EVENTS = [
  { txt: "Du durchwühlst einen Mülleimer. Riecht nach Döner.", w: 20 },
  { txt: "Ein Passant schaut dich mitleidig an. Egal, weiter.", w: 15 },
  { txt: "Jackpot! Ein ganzer Kasten Leergut hinterm Kiosk!", w: 6, bottles: [8, 25] },
  { txt: "Party-Überreste im Park – Flaschen ohne Ende!", w: 6, bottles: [5, 15] },
  { txt: "Du findest einen zerknüllten Schein im Gebüsch!", w: 5, geld: [2, 15] },
  { txt: "Ein Student schenkt dir sein restliches Sixpack (leer).", w: 8, bottles: [4, 6] },
  { txt: "Dein Hund erschnüffelt eine Flaschen-Goldader!", w: 4, bottles: [10, 30], needsDog: true },
  { txt: "Regen setzt ein. Du ziehst die Kapuze tiefer.", w: 12 },
  { txt: "Möwe klaut dir fast ein Brötchen. Frechheit.", w: 10 },
  { txt: "Du findest eine „Rolex“ (aus dem Kaugummiautomaten). Trotzdem was wert!", w: 2, geld: [20, 60] },
  { txt: "Flaschensammler-Kollege nickt dir respektvoll zu.", w: 10 },
  { txt: "Ein TikToker filmt dich für seinen „Streetlife“-Kanal und drückt dir was in die Hand.", w: 3, geld: [10, 40] },
];

const BEG_CRITS = [
  "Ein Tourist verwechselt dich mit einem Straßenkünstler!",
  "Eine Oma steckt dir „für was Warmes“ einen Schein zu!",
  "Ein Banker mit schlechtem Gewissen leert sein Portemonnaie!",
  "Dein Pappschild-Spruch geht viral!",
];

/* ---------------- State ---------------- */

const SAVE_KEY = "pfandlord_save_v1";

function defaultState() {
  return {
    version: 1,
    createdAt: Date.now(),
    lastSeen: Date.now(),
    geld: 0,
    flaschen: 0,
    xp: 0,
    level: 1,
    respekt: 0,
    prestigeCount: 0,
    totalFlaschen: 0,
    totalGeld: 0,
    begToday: 0,
    maxCombo: 0,
    soldHighKurs: false,
    kurs: 0.25,
    district: 0,
    mission: null,   // {start, dauer, ratePerSec, bonus, name, extraB, extraG, log, lastEvent}
    training: null,  // {skill, start, dauer}
    items: { beutel: 0, hund: 0, radar: 0, scooter: 0, lager: 0 },
    skills: { sammeln: 0, feilschen: 0, schnorren: 0, stadt: 0 },
    streak: { last: "", count: 0, best: 0 },
    achievements: {},
  };
}

let S = defaultState();

/* ---------------- Formeln ---------------- */

const respektMult = () => 1 + S.respekt * 0.03;
const capacity = () => ITEMS.beutel.capacity[S.items.beutel];

function bottlesPerMin() {
  return 6
    * DISTRICTS[S.district].mult
    * (1 + S.skills.sammeln * 0.06)
    * (1 + S.items.hund * 0.15)
    * (1 + S.items.radar * 0.12)
    * respektMult();
}

function missionDuration(baseSec) {
  const red = Math.min(0.55, S.items.scooter * 0.08 + S.skills.stadt * 0.03);
  return Math.round(baseSec * (1 - red));
}

function sellPrice() {
  return S.kurs * (1 + S.skills.feilschen * 0.05) * respektMult();
}

function begValue() {
  return (0.03 + S.level * 0.006) * (1 + S.skills.schnorren * 0.12) * respektMult();
}

function xpNeeded(lvl) { return Math.round(40 * Math.pow(lvl, 1.55)); }

function skillCost(lvl)  { return Math.round(25 + 30 * Math.pow(lvl, 2.1)); }
function skillTime(lvl)  { return Math.round(45 + 40 * Math.pow(lvl, 1.6)); }

function prestigeGain() {
  const target = Math.floor(Math.sqrt(S.totalGeld / 300));
  return Math.max(0, target - S.respekt);
}

function offlineMaxHours() { return 2 + S.items.lager * 2; }
function offlineRate() { return bottlesPerMin() * (0.15 + S.items.lager * 0.05); }

/* ---------------- Formatierung ---------------- */

function fmtGeld(v) {
  if (v >= 100000) return (v / 1000).toLocaleString("de-DE", { maximumFractionDigits: 1 }) + "k €";
  return v.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}
function fmtNum(v) {
  v = Math.floor(v);
  if (v >= 1000000) return (v / 1000000).toLocaleString("de-DE", { maximumFractionDigits: 2 }) + "M";
  if (v >= 10000) return (v / 1000).toLocaleString("de-DE", { maximumFractionDigits: 1 }) + "k";
  return v.toLocaleString("de-DE");
}
function fmtTime(sec) {
  sec = Math.max(0, Math.ceil(sec));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}
function fmtDur(sec) {
  if (sec >= 3600) return (sec / 3600).toLocaleString("de-DE", { maximumFractionDigits: 1 }) + " h";
  if (sec >= 60) return Math.round(sec / 60) + " min";
  return sec + " s";
}

/* ---------------- DOM Helpers ---------------- */

const $ = id => document.getElementById(id);

function toast(msg, cls = "") {
  const t = document.createElement("div");
  t.className = "toast " + cls;
  t.textContent = msg;
  $("toast-wrap").appendChild(t);
  setTimeout(() => t.remove(), 3600);
}

function particle(text, x, y) {
  const p = document.createElement("div");
  p.className = "particle";
  p.textContent = text;
  p.style.left = (x - 20 + Math.random() * 40) + "px";
  p.style.top = (y - 30) + "px";
  $("particle-layer").appendChild(p);
  setTimeout(() => p.remove(), 1000);
}

function bumpStat(id) {
  const el = $(id);
  el.classList.remove("bump");
  void el.offsetWidth;
  el.classList.add("bump");
}

function showModal(title, bodyHtml) {
  $("modal-title").textContent = title;
  $("modal-body").innerHTML = bodyHtml;
  $("modal-backdrop").style.display = "flex";
}

function vibrate(ms) { if (navigator.vibrate) navigator.vibrate(ms); }

/* ---------------- Geld / XP / Level ---------------- */

function addGeld(v) {
  S.geld += v;
  S.totalGeld += v;
  bumpStat("stat-geld");
}

function addXp(v) {
  S.xp += v;
  let leveled = false;
  while (S.xp >= xpNeeded(S.level)) {
    S.xp -= xpNeeded(S.level);
    S.level++;
    leveled = true;
  }
  if (leveled) {
    toast(`🎉 Level ${S.level} erreicht!`, "gold");
    vibrate(60);
    const unlocked = DISTRICTS.find(d => d.lvl === S.level);
    if (unlocked) toast(`🗺️ Neues Revier freigeschaltet: ${unlocked.name}!`, "gold");
    renderDistricts();
    renderProfil();
    checkAchievements();
  }
}

/* ---------------- Missionen ---------------- */

function startMission(idx) {
  if (S.mission) return;
  const m = MISSIONS[idx];
  S.mission = {
    start: Date.now(),
    dauer: missionDuration(m.sec),
    ratePerSec: (bottlesPerMin() / 60) * m.bonus,
    name: m.name,
    extraB: 0,
    extraG: 0,
    log: [`${DISTRICTS[S.district].emoji} Du ziehst los: ${m.name} in ${DISTRICTS[S.district].name}.`],
    lastEvent: Date.now(),
  };
  renderMissionState();
  save();
}

function missionBottles(mi, elapsedSec) {
  return Math.floor(mi.ratePerSec * Math.min(elapsedSec, mi.dauer)) + mi.extraB;
}

function completeMission(silent = false) {
  const mi = S.mission;
  if (!mi) return;
  const found = missionBottles(mi, mi.dauer);
  S.mission = null;
  collectBottles(found, silent);
  if (mi.extraG > 0) addGeld(mi.extraG);
  if (!silent) {
    toast(`✅ ${mi.name} beendet: ${fmtNum(found)} Flaschen!`);
    vibrate(40);
  }
  renderMissionState();
}

function abortMission() {
  const mi = S.mission;
  if (!mi) return;
  const elapsed = (Date.now() - mi.start) / 1000;
  const found = Math.floor(missionBottles(mi, elapsed) * 0.5);
  S.mission = null;
  collectBottles(found);
  toast(`🏃 Tour abgebrochen – immerhin ${fmtNum(found)} Flaschen.`);
  renderMissionState();
  save();
}

function collectBottles(n, silent = false) {
  const space = capacity() - S.flaschen;
  const kept = Math.max(0, Math.min(n, space));
  const lost = n - kept;
  S.flaschen += kept;
  S.totalFlaschen += kept;
  addXp(kept);
  if (lost > 0 && !silent) toast(`😤 ${fmtNum(lost)} Flaschen passten nicht mehr rein! Kauf mehr Stauraum.`, "red");
  bumpStat("stat-flaschen");
  checkAchievements();
}

function missionEventTick() {
  const mi = S.mission;
  if (!mi) return;
  const now = Date.now();
  if (now - mi.lastEvent < 8000 + Math.random() * 12000) return;
  mi.lastEvent = now;
  const pool = MISSION_EVENTS.filter(e => !e.needsDog || S.items.hund > 0);
  const totalW = pool.reduce((a, e) => a + e.w, 0);
  let r = Math.random() * totalW;
  let ev = pool[0];
  for (const e of pool) { r -= e.w; if (r <= 0) { ev = e; break; } }
  let line = ev.txt;
  if (ev.bottles) {
    const b = Math.round((ev.bottles[0] + Math.random() * (ev.bottles[1] - ev.bottles[0])) * DISTRICTS[S.district].mult * respektMult());
    mi.extraB += b;
    line += ` (+${b} 🍾)`;
  }
  if (ev.geld) {
    const g = +((ev.geld[0] + Math.random() * (ev.geld[1] - ev.geld[0])) * respektMult()).toFixed(2);
    mi.extraG += g;
    line += ` (+${fmtGeld(g)})`;
  }
  mi.log.push(line);
  if (mi.log.length > 8) mi.log.shift();
  renderMissionLog();
}

/* ---------------- Verkaufen / Pfandkurs ---------------- */

function updateKurs() {
  const drift = (Math.random() - 0.5) * 0.06;
  const pull = (0.25 - S.kurs) * 0.15; // Rückkehr zur Mitte
  S.kurs = Math.min(0.48, Math.max(0.12, S.kurs + drift + pull));
  renderKurs();
}

function sellAll() {
  if (S.flaschen <= 0) { toast("Keine Flaschen im Gepäck!", "red"); return; }
  const n = S.flaschen;
  const value = +(n * sellPrice()).toFixed(2);
  S.flaschen = 0;
  addGeld(value);
  addXp(Math.ceil(n * 0.1));
  if (S.kurs >= 0.40) S.soldHighKurs = true;
  toast(`♻️ ${fmtNum(n)} Flaschen verkauft: +${fmtGeld(value)}`);
  vibrate(30);
  const btn = $("btn-sell").getBoundingClientRect();
  particle("+" + fmtGeld(value), btn.left + btn.width / 2, btn.top);
  checkAchievements();
  renderShop();
  renderSkills();
  save();
}

/* ---------------- Betteln ---------------- */

let combo = 0;
let lastBeg = 0;

function beg(ev) {
  const now = Date.now();
  if (now - lastBeg < 1600) combo = Math.min(50, combo + 1);
  else combo = 0;
  lastBeg = now;
  S.maxCombo = Math.max(S.maxCombo, combo);

  const mult = 1 + combo * 0.04;
  let gain = begValue() * mult;
  let crit = false;
  if (Math.random() < 0.04) {
    crit = true;
    gain *= 20 + Math.random() * 15;
    toast("💥 " + BEG_CRITS[Math.floor(Math.random() * BEG_CRITS.length)], "gold");
    vibrate([30, 40, 60]);
  }
  gain = +gain.toFixed(2);
  addGeld(gain);
  S.begToday += gain;
  addXp(0.3);

  const x = ev.touches ? ev.touches[0].clientX : ev.clientX;
  const y = ev.touches ? ev.touches[0].clientY : ev.clientY;
  particle((crit ? "💥 " : "") + "+" + fmtGeld(gain), x || innerWidth / 2, y || innerHeight / 2);
  $("beg-total").textContent = fmtGeld(S.begToday);
  checkAchievements();
}

function comboTick() {
  if (combo > 0 && Date.now() - lastBeg > 1600) combo = 0;
  const pct = (combo / 50) * 100;
  $("combo-bar").style.width = pct + "%";
  $("combo-label").textContent = "Combo x" + (1 + combo * 0.04).toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 2 });
}

/* ---------------- Shop ---------------- */

function buyItem(key) {
  const item = ITEMS[key];
  const lvl = S.items[key];
  if (lvl >= item.costs.length) return;
  const cost = item.costs[lvl];
  if (S.geld < cost) { toast("Zu wenig Kohle! 💸", "red"); return; }
  S.geld -= cost;
  S.items[key]++;
  toast(`${item.emoji} Gekauft: ${item.stages[S.items[key]]}!`, "gold");
  vibrate(40);
  renderShop();
  renderHeader();
  checkAchievements();
  save();
}

/* ---------------- Skills ---------------- */

function startTraining(key) {
  if (S.training) { toast("Du bildest dich schon weiter!", "red"); return; }
  const lvl = S.skills[key];
  if (lvl >= SKILL_MAX) return;
  const cost = skillCost(lvl);
  if (S.geld < cost) { toast("Zu wenig Kohle für den Kurs! 💸", "red"); return; }
  S.geld -= cost;
  S.training = { skill: key, start: Date.now(), dauer: skillTime(lvl) };
  renderSkills();
  renderHeader();
  save();
}

function completeTraining(silent = false) {
  const t = S.training;
  if (!t) return;
  S.training = null;
  S.skills[t.skill]++;
  if (!silent) {
    toast(`📚 ${SKILLS[t.skill].name} auf Stufe ${S.skills[t.skill]}!`, "gold");
    vibrate(40);
  }
  renderSkills();
}

/* ---------------- Achievements ---------------- */

function checkAchievements() {
  for (const a of ACHIEVEMENTS) {
    if (!S.achievements[a.id] && a.cond(S)) {
      S.achievements[a.id] = true;
      S.geld += a.reward;
      S.totalGeld += a.reward;
      toast(`🏆 Erfolg: ${a.name}! (+${fmtGeld(a.reward)})`, "gold");
      vibrate([40, 30, 40]);
      renderAchievements();
      $("badge-profil").classList.add("on");
    }
  }
}

/* ---------------- Prestige ---------------- */

function doPrestige() {
  const gain = prestigeGain();
  if (S.level < 25 || gain <= 0) return;
  if (!confirm(`Wirklich neu anfangen?\n\nDu bekommst +${gain} Respekt (dauerhaft +${gain * 3} % auf alles).\nLevel, Geld, Items und Skills werden zurückgesetzt.`)) return;
  const keep = {
    respekt: S.respekt + gain,
    prestigeCount: S.prestigeCount + 1,
    achievements: S.achievements,
    streak: S.streak,
    maxCombo: S.maxCombo,
    soldHighKurs: S.soldHighKurs,
    createdAt: S.createdAt,
  };
  S = Object.assign(defaultState(), keep);
  toast(`⭐ Neuanfang! +${gain} Respekt – du bist jetzt eine Nummer größer.`, "gold");
  checkAchievements();
  renderAll();
  save();
}

/* ---------------- Daily Streak ---------------- */

function todayStr() { return new Date().toISOString().slice(0, 10); }
function yesterdayStr() {
  const d = new Date(); d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function checkDaily() {
  const today = todayStr();
  if (S.streak.last === today) return;
  if (S.streak.last === yesterdayStr()) S.streak.count++;
  else S.streak.count = 1;
  S.streak.last = today;
  S.streak.best = Math.max(S.streak.best, S.streak.count);
  S.begToday = 0;
  const reward = +(5 * S.streak.count * (1 + S.level / 10) * respektMult()).toFixed(2);
  addGeld(reward);
  showModal("🗓️ Täglicher Bonus",
    `<b>Tag ${S.streak.count}</b> deiner Streak!<span class="big">+${fmtGeld(reward)}</span>` +
    `Komm morgen wieder – die Belohnung wächst jeden Tag.`);
  checkAchievements();
}

/* ---------------- Offline-Fortschritt ---------------- */

function applyOffline() {
  const now = Date.now();
  let idleStart = S.lastSeen;
  let report = [];

  // Laufende Mission, die inzwischen fertig ist
  if (S.mission) {
    const end = S.mission.start + S.mission.dauer * 1000;
    if (now >= end) {
      const found = missionBottles(S.mission, S.mission.dauer);
      const extraG = S.mission.extraG;
      const name = S.mission.name;
      S.mission = null;
      collectBottles(found, true);
      if (extraG > 0) addGeld(extraG);
      report.push(`✅ ${name} abgeschlossen: <b>${fmtNum(found)} 🍾</b>`);
      idleStart = Math.max(idleStart, end);
    } else {
      idleStart = now; // Mission läuft noch, keine Idle-Zeit
    }
  }

  // Laufendes Training, das inzwischen fertig ist
  if (S.training) {
    const end = S.training.start + S.training.dauer * 1000;
    if (now >= end) {
      const key = S.training.skill;
      completeTraining(true);
      report.push(`📚 <b>${SKILLS[key].name}</b> abgeschlossen – jetzt Stufe ${S.skills[key]}!`);
    }
  }

  // Passives Sammeln im Schlaf
  const idleSec = Math.max(0, (now - idleStart) / 1000);
  if (idleSec > 120) {
    const cappedSec = Math.min(idleSec, offlineMaxHours() * 3600);
    const found = Math.floor(offlineRate() * (cappedSec / 60));
    if (found > 0) {
      const space = capacity() - S.flaschen;
      const kept = Math.max(0, Math.min(found, space));
      S.flaschen += kept;
      S.totalFlaschen += kept;
      addXp(Math.floor(kept * 0.5));
      report.push(`🏕️ Im Schlaf gesammelt (${fmtDur(Math.round(cappedSec))}): <b>${fmtNum(kept)} 🍾</b>`);
    }
  }

  if (report.length > 0) {
    showModal("👋 Willkommen zurück!", report.join("<br><br>"));
    checkAchievements();
  }
  S.lastSeen = now;
}

/* ---------------- Rendering ---------------- */

function renderHeader() {
  $("geld-val").textContent = fmtGeld(S.geld);
  $("flaschen-val").textContent = fmtNum(S.flaschen) + "/" + fmtNum(capacity());
  $("stat-respekt").style.display = S.respekt > 0 ? "flex" : "none";
  $("respekt-val").textContent = S.respekt;
  const need = xpNeeded(S.level);
  $("levelbar").style.width = Math.min(100, (S.xp / need) * 100) + "%";
  $("level-label").textContent = `Level ${S.level} · ${title()} · ${fmtNum(S.xp)}/${fmtNum(need)} XP`;
}

function title() {
  let t = TITLES[0][1];
  for (const [lvl, name] of TITLES) if (S.level >= lvl) t = name;
  return t;
}

function renderDistricts() {
  const wrap = $("district-list");
  wrap.innerHTML = "";
  DISTRICTS.forEach((d, i) => {
    const locked = S.level < d.lvl;
    const el = document.createElement("div");
    el.className = "district" + (i === S.district ? " active" : "") + (locked ? " locked" : "");
    el.innerHTML = `<span class="d-emoji">${d.emoji}</span>
      <span class="d-name">${d.name}</span>
      ${locked ? `<span class="d-lock">🔒 Level ${d.lvl}</span>` : `<span class="d-mult">x${d.mult.toLocaleString("de-DE")}</span>`}`;
    if (!locked) el.onclick = () => {
      if (S.mission) { toast("Erst die laufende Tour beenden!", "red"); return; }
      S.district = i;
      renderDistricts();
      renderMissionOptions();
      save();
    };
    wrap.appendChild(el);
  });
}

function renderMissionOptions() {
  const wrap = $("mission-options");
  wrap.innerHTML = "";
  MISSIONS.forEach((m, i) => {
    const dur = missionDuration(m.sec);
    const est = Math.floor((bottlesPerMin() / 60) * m.bonus * dur);
    const btn = document.createElement("button");
    btn.className = "mission-opt";
    btn.innerHTML = `<span class="m-name">${m.name}</span>
      <span class="m-time">⏱️ ${fmtDur(dur)}</span>
      <span class="m-yield">≈ ${fmtNum(est)} 🍾</span>`;
    btn.onclick = () => startMission(i);
    wrap.appendChild(btn);
  });
}

function renderMissionState() {
  $("mission-idle").style.display = S.mission ? "none" : "block";
  $("mission-active").style.display = S.mission ? "block" : "none";
  if (S.mission) {
    $("mission-name").textContent = `${DISTRICTS[S.district].emoji} ${S.mission.name}`;
    renderMissionLog();
  } else {
    renderMissionOptions();
  }
  renderHeader();
}

function renderMissionLog() {
  if (!S.mission) return;
  $("mission-log").innerHTML = S.mission.log.map(l => `<div>${l}</div>`).join("");
}

function renderMissionTick() {
  const mi = S.mission;
  if (!mi) return;
  const elapsed = (Date.now() - mi.start) / 1000;
  if (elapsed >= mi.dauer) { completeMission(); save(); return; }
  $("mission-timer").textContent = fmtTime(mi.dauer - elapsed);
  $("mission-progress").style.width = Math.min(100, (elapsed / mi.dauer) * 100) + "%";
  $("mission-bottles").textContent = fmtNum(missionBottles(mi, elapsed));
}

function renderKurs() {
  const el = $("kurs-val");
  const old = parseFloat(el.dataset.v || "0.25");
  el.textContent = S.kurs.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
  el.className = "mono " + (S.kurs > old ? "up" : S.kurs < old ? "down" : "");
  el.dataset.v = S.kurs;
  $("kurs-trend").textContent = S.kurs > old ? "📈" : S.kurs < old ? "📉" : "➡️";
  renderSellPreview();
}

function renderSellPreview() {
  $("sell-preview").textContent = S.flaschen > 0
    ? `${fmtNum(S.flaschen)} Flaschen ≈ ${fmtGeld(S.flaschen * sellPrice())}`
    : "Gepäck ist leer.";
  $("btn-sell").disabled = S.flaschen <= 0;
}

function renderShop() {
  const wrap = $("shop-list");
  wrap.innerHTML = "";
  let affordable = false;
  for (const [key, item] of Object.entries(ITEMS)) {
    const lvl = S.items[key];
    const maxed = lvl >= item.costs.length;
    const cost = maxed ? 0 : item.costs[lvl];
    if (!maxed && S.geld >= cost) affordable = true;
    const el = document.createElement("div");
    el.className = "shop-item";
    el.innerHTML = `<span class="s-emoji">${item.emoji}</span>
      <div class="s-info">
        <div class="s-name">${item.name}: ${item.stages[lvl]}</div>
        <div class="s-desc">${item.desc}${key === "beutel" ? ` Aktuell: ${fmtNum(capacity())} Flaschen.` : ""}</div>
        <div class="s-level">Stufe ${lvl}/${item.costs.length}</div>
      </div>
      <button class="s-buy ${maxed ? "maxed" : ""}" ${maxed || S.geld < cost ? "disabled" : ""}>
        ${maxed ? "MAX ✨" : `➜ ${item.stages[lvl + 1]}<br>${fmtGeld(cost)}`}
      </button>`;
    if (!maxed) el.querySelector(".s-buy").onclick = () => buyItem(key);
    wrap.appendChild(el);
  }
  $("badge-shop").classList.toggle("on", affordable);
}

function renderSkills() {
  const wrap = $("skill-list");
  wrap.innerHTML = "";
  let affordable = false;
  for (const [key, sk] of Object.entries(SKILLS)) {
    const lvl = S.skills[key];
    const maxed = lvl >= SKILL_MAX;
    const cost = skillCost(lvl);
    const time = skillTime(lvl);
    if (!maxed && !S.training && S.geld >= cost) affordable = true;
    const el = document.createElement("div");
    el.className = "skill-item";
    el.innerHTML = `<span class="s-emoji">${sk.emoji}</span>
      <div class="s-info">
        <div class="s-name">${sk.name}</div>
        <div class="s-desc">${sk.desc}</div>
        <div class="s-level">Stufe ${lvl}/${SKILL_MAX}</div>
      </div>
      <button class="s-buy ${maxed ? "maxed" : ""}" ${maxed || S.training || S.geld < cost ? "disabled" : ""}>
        ${maxed ? "MAX ✨" : `${fmtGeld(cost)}<br>⏱️ ${fmtDur(time)}`}
      </button>`;
    if (!maxed) el.querySelector(".s-buy").onclick = () => startTraining(key);
    wrap.appendChild(el);
  }
  $("badge-skills").classList.toggle("on", affordable);
  $("training-active").style.display = S.training ? "block" : "none";
  if (S.training) $("training-name").textContent = `${SKILLS[S.training.skill].emoji} ${SKILLS[S.training.skill].name} → Stufe ${S.skills[S.training.skill] + 1}`;
}

function renderTrainingTick() {
  const t = S.training;
  if (!t) return;
  const elapsed = (Date.now() - t.start) / 1000;
  if (elapsed >= t.dauer) { completeTraining(); save(); return; }
  $("training-timer").textContent = fmtTime(t.dauer - elapsed);
  $("training-progress").style.width = Math.min(100, (elapsed / t.dauer) * 100) + "%";
}

function renderProfil() {
  $("profil-title").textContent = title();
  const days = Math.max(1, Math.ceil((Date.now() - S.createdAt) / 86400000));
  const rows = [
    ["Level", S.level + " – " + title()],
    ["Respekt", "⭐ " + S.respekt + (S.respekt > 0 ? ` (+${S.respekt * 3} % auf alles)` : "")],
    ["Neuanfänge", S.prestigeCount],
    ["Flaschen gesamt", fmtNum(S.totalFlaschen)],
    ["Einnahmen gesamt", fmtGeld(S.totalGeld)],
    ["Login-Streak", `🔥 ${S.streak.count} Tage (Rekord: ${S.streak.best})`],
    ["Beste Combo", "x" + (1 + S.maxCombo * 0.04).toLocaleString("de-DE", { maximumFractionDigits: 2 })],
    ["Dabei seit", days + (days === 1 ? " Tag" : " Tagen")],
  ];
  $("profil-stats").innerHTML = rows.map(([k, v]) => `<div class="p-row"><span>${k}</span><b>${v}</b></div>`).join("");
  renderPrestige();
}

function renderPrestige() {
  const gain = prestigeGain();
  const ready = S.level >= 25 && gain > 0;
  $("prestige-info").innerHTML = S.level < 25
    ? `Noch <b>${25 - S.level} Level</b> bis zum Neuanfang.`
    : `Aktuell möglich: <b style="color:var(--gold)">+${gain} Respekt</b>`;
  $("btn-prestige").disabled = !ready;
}

function renderAchievements() {
  const wrap = $("achievement-list");
  wrap.innerHTML = "";
  const sorted = [...ACHIEVEMENTS].sort((a, b) => (S.achievements[b.id] ? 1 : 0) - (S.achievements[a.id] ? 1 : 0));
  for (const a of sorted) {
    const done = !!S.achievements[a.id];
    const el = document.createElement("div");
    el.className = "ach" + (done ? " done" : "");
    el.innerHTML = `<span class="a-icon">${a.icon}</span>
      <div><div class="a-name">${done ? a.name : "???"}</div>
      <div class="a-desc">${a.desc} · +${fmtGeld(a.reward)}</div></div>`;
    wrap.appendChild(el);
  }
}

function renderAll() {
  renderHeader();
  renderDistricts();
  renderMissionState();
  renderKurs();
  renderShop();
  renderSkills();
  renderProfil();
  renderAchievements();
}

/* ---------------- Tabs ---------------- */

function switchTab(name) {
  document.querySelectorAll(".tab-panel").forEach(p => p.style.display = "none");
  $("tab-" + name).style.display = "block";
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.toggle("active", b.dataset.tab === name));
  if (name === "shop") renderShop();
  if (name === "skills") renderSkills();
  if (name === "profil") { renderProfil(); renderAchievements(); $("badge-profil").classList.remove("on"); }
  if (name === "sammeln") { renderDistricts(); renderMissionState(); }
}

/* ---------------- Save / Load ---------------- */

function save() {
  S.lastSeen = Date.now();
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* voll/privat */ }
}

function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    S = Object.assign(defaultState(), data);
    S.items = Object.assign(defaultState().items, data.items);
    S.skills = Object.assign(defaultState().skills, data.skills);
    S.streak = Object.assign(defaultState().streak, data.streak);
  } catch (e) {
    console.warn("Spielstand kaputt, starte neu.", e);
    S = defaultState();
  }
}

function exportSave() {
  save();
  const code = btoa(unescape(encodeURIComponent(JSON.stringify(S))));
  prompt("Dein Spielstand-Code (kopieren & sicher aufbewahren):", code);
}

function importSave() {
  const code = prompt("Spielstand-Code einfügen:");
  if (!code) return;
  try {
    const data = JSON.parse(decodeURIComponent(escape(atob(code.trim()))));
    if (typeof data.totalFlaschen !== "number") throw new Error("ungültig");
    S = Object.assign(defaultState(), data);
    save();
    renderAll();
    toast("💾 Spielstand geladen!", "gold");
  } catch (e) {
    toast("Ungültiger Code!", "red");
  }
}

function resetSave() {
  if (!confirm("Wirklich ALLES löschen? Das kann nicht rückgängig gemacht werden!")) return;
  if (!confirm("Letzte Chance: Spielstand endgültig löschen?")) return;
  localStorage.removeItem(SAVE_KEY);
  S = defaultState();
  renderAll();
  toast("Spielstand gelöscht. Neues Spiel, neues Glück!");
}

/* ---------------- Game Loop ---------------- */

function tick() {
  renderHeader();
  renderMissionTick();
  renderTrainingTick();
  missionEventTick();
  comboTick();
}

function init() {
  load();
  applyOffline();
  checkDaily();
  renderAll();

  // Events
  document.querySelectorAll(".tab-btn").forEach(b => b.onclick = () => switchTab(b.dataset.tab));
  $("btn-sell").onclick = sellAll;
  $("mission-abort").onclick = abortMission;
  $("btn-prestige").onclick = doPrestige;
  $("btn-export").onclick = exportSave;
  $("btn-import").onclick = importSave;
  $("btn-reset").onclick = resetSave;
  $("modal-close").onclick = () => $("modal-backdrop").style.display = "none";

  const begBtn = $("beg-btn");
  begBtn.addEventListener("pointerdown", e => { e.preventDefault(); beg(e); });

  setInterval(tick, 250);
  setInterval(updateKurs, 20000);
  setInterval(save, 5000);
  setInterval(renderSellPreview, 1000);
  window.addEventListener("beforeunload", save);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) save();
    else { load(); applyOffline(); checkDaily(); renderAll(); }
  });
}

document.addEventListener("DOMContentLoaded", init);
