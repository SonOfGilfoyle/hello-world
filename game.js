/* ============================================================
   PFANDLORD – Vom Penner zur Legende
   Ein modernes Pennergame-Remake als Endless-Idle-Game.
   Vanilla JS, keine Dependencies.
   ============================================================ */
"use strict";

/* ============================================================
   BALANCE – alle Tuning-Konstanten an einem Ort.
   Formeln lesen NUR von hier; wer balanciert, fasst keine Logik an.
   Achtung: einige UI-Texte (Item-/Skill-/Talent-Beschreibungen)
   nennen Prozentwerte im Klartext – bei Änderungen mit anpassen.
   Design-Ziele und Nachrechnungen: siehe BALANCING.md
   ============================================================ */
const BALANCE = {
  tour: {
    baseBottlesPerMin: 6,   // Grundrate vor allen Multiplikatoren
    xpPerBottle: 1,         // Touren sind DIE XP-Quelle
    abortFraction: 0.5,     // Beute-Anteil bei Abbruch
    minDurationSec: 10,
  },
  beg: {
    base: 0.03,             // € pro Tipp, Grundwert
    perLevel: 0.002,        // flacher Level-Anteil (bewusst klein)
    passiveShare: 0.01,     // + Anteil am Kolonnen-€/s pro Tipp → skaliert mit, überholt nie
    critChance: 0.04, critMin: 20, critMax: 35,
    comboMax: 50, comboStep: 0.04, comboWindowMs: 1600,
    energyMax: 100,         // Tipps pro voller Leiste
    energyPerSkillLvl: 5,   // Schnorr-Rhetorik erhöht das Maximum
    regenPerSec: 0.5,       // volle Leiste in ~3,3 min
    regenPerSkillLvl: 0.05,
    xpPerTap: 0.3,
  },
  kurs: { base: 0.25, min: 0.12, max: 0.48, drift: 0.06, pullback: 0.15 },
  items: {
    capacityBase: 30, capacityGrowth: 1.6, // wächst schneller als früher (1.5) …
    hundBonus: 0.15, radarBonus: 0.12, scooterTimeMult: 0.93,
  },
  skills: {
    costBase: 25, costGrowth: 1.7,
    timeBaseSec: 40, timeGrowth: 1.38,
    sammelnBonus: 0.06, feilschenBonus: 0.05, schnorrenBonus: 0.12, stadtTimeMult: 0.97,
  },
  kolonne: {
    costGrowth: 1.15,       // pro gekaufter Einheit
    milestoneEvery: 25, milestoneMult: 2,
    unlockLevel: 4,
    xpPerBottle: 0.005,     // passiv deutlich weniger XP als aktive Touren
    fuehrungBonus: 0.25,
  },
  talents: {
    rufBonus: 0.05,
    startCapitalBase: 100, startCapitalGrowth: 4,
    schlafOfflineHours: 2, schlafOfflineRate: 0.1,
    lehreTimeMult: 0.9,
  },
  prestige: { minLevel: 25, geldDivisor: 1000 },
  offline: {
    baseHours: 2, hoursPerLagerLvl: 2,
    personalRateBase: 0.15, personalRatePerLagerLvl: 0.05,
    kolonneFactorBase: 0.5,
  },
  xp: { levelBase: 40, levelExp: 1.55, sellPerBottle: 0.1 },
  erfolge: { tierBonus: 0.01 },
  daily: { basePerStreakTag: 5, kolonneSec: 300, kolonneStreakBonus: 0.1 },
};
const B = BALANCE;

/* ---------------- Spieldaten ---------------- */

const DISTRICTS = [
  { name: "Vorstadt",            emoji: "🏘️", mult: 1.0, lvl: 1  },
  { name: "Bahnhofsviertel",     emoji: "🚉", mult: 1.6, lvl: 4  },
  { name: "Uni-Campus",          emoji: "🎓", mult: 2.4, lvl: 10 },
  { name: "Innenstadt",          emoji: "🏙️", mult: 3.5, lvl: 18 },
  { name: "Hafenviertel",        emoji: "⚓", mult: 5.5, lvl: 28 },
  { name: "Stadion & Festwiese", emoji: "🏟️", mult: 9.0, lvl: 40 },
];
// Nach den 6 handgemachten Revieren geht es prozedural endlos weiter
const PROC_DISTRICTS = [
  ["Szeneviertel", "🎸"], ["Messegelände", "🎪"], ["Flughafen-Terminal", "✈️"],
  ["Kreuzfahrt-Hafen", "🛳️"], ["Olympiapark", "🏅"], ["Banken-Distrikt", "🏦"],
  ["Vergnügungspark", "🎢"], ["Mega-Festival", "🎆"],
];
function districtDef(i) {
  if (i < DISTRICTS.length) return DISTRICTS[i];
  const n = i - DISTRICTS.length;
  const [base, emoji] = PROC_DISTRICTS[n % PROC_DISTRICTS.length];
  const cycle = Math.floor(n / PROC_DISTRICTS.length);
  return {
    name: base + (cycle > 0 ? " " + roman(cycle + 1) : ""),
    emoji,
    mult: 9 * Math.pow(1.6, n + 1),
    lvl: 40 + 15 * (n + 1),
  };
}

const MISSIONS = [
  { name: "Kurze Runde",          sec: 30,    bonus: 1.0  },
  { name: "Feierabend-Tour",      sec: 120,   bonus: 1.15 },
  { name: "Große Tour",           sec: 600,   bonus: 1.3  },
  { name: "Nachtschicht",         sec: 1800,  bonus: 1.5  },
  { name: "Wochenend-Marathon",   sec: 7200,  bonus: 1.8  },
  { name: "Legendäre Expedition", sec: 28800, bonus: 2.2  },
];

/* Items: endlos aufwertbar, Kosten wachsen geometrisch */
const ITEMS = {
  beutel: {
    emoji: "🛍️", name: "Transport", desc: "Mehr Platz für Flaschen.",
    stages: ["Plastiktüte", "Jutebeutel", "Trekking-Rucksack", "Einkaufswagen", "Lastenrad", "Sprinter (geliehen)"],
    base: 40, growth: 2.2,
  },
  hund: {
    emoji: "🐕", name: "Begleiter", desc: "+15 % Flaschen pro Stufe.",
    stages: ["Kein Hund", "Straßenköter", "Dackel „Kalle“", "Labrador „Bolle“", "Schäferhund „Rex“", "Königspudel „Baron“"],
    base: 60, growth: 2.6,
  },
  radar: {
    emoji: "🔦", name: "Spürtechnik", desc: "+12 % Flaschen pro Stufe.",
    stages: ["Bloße Hände", "Taschenlampe", "Greifzange", "Magnet-Angel", "Pfand-Radar-App", "Suchdrohne"],
    base: 30, growth: 2.5,
  },
  scooter: {
    emoji: "🛴", name: "Mobilität", desc: "-7 % Tourdauer pro Stufe.",
    stages: ["Zu Fuß", "Skateboard", "Klapprad", "E-Scooter", "E-Bike", "Turbo-Lastenrad"],
    base: 80, growth: 2.7,
  },
  lager: {
    emoji: "🏕️", name: "Schlafplatz", desc: "+2 h Offline-Limit & mehr Offline-Rate pro Stufe.",
    stages: ["Parkbank", "Schlafsack", "Zelt", "Bauwagen", "WG-Zimmer", "Tiny House"],
    base: 50, growth: 2.6,
  },
};
function itemCost(key, lvl) { return Math.round(ITEMS[key].base * Math.pow(ITEMS[key].growth, lvl)); }
function itemStageName(key, lvl) {
  const st = ITEMS[key].stages;
  if (lvl < st.length) return st[lvl];
  return st[st.length - 1] + " Mk. " + roman(lvl - st.length + 2);
}

/* Skills: endlos, Trainingszeit & Kosten wachsen geometrisch */
const SKILLS = {
  sammeln:   { emoji: "🧐", name: "Flaschenkunde",    desc: "+6 % Flaschen pro Stufe" },
  feilschen: { emoji: "🤝", name: "Feilschen",        desc: "+5 % Verkaufspreis pro Stufe" },
  schnorren: { emoji: "🗣️", name: "Schnorr-Rhetorik", desc: "+12 % Bettel-Einnahmen, +5 max. Energie & schnellere Regeneration pro Stufe" },
  stadt:     { emoji: "🗺️", name: "Stadtkenntnis",    desc: "-3 % Tourdauer pro Stufe" },
};

/* Generatoren: die Sammel-Kolonne – passives Einkommen, endlos kaufbar */
const GENERATORS = [
  { id: "kumpel",   emoji: "🧍", name: "Sammel-Kumpel",       desc: "Sammelt für 'ne Stulle und gute Worte.",       base: 25,   rate: 0.2 },
  { id: "crew",     emoji: "🛒", name: "Bollerwagen-Crew",    desc: "Drei Leute, ein Wagen, null Pausen.",          base: 300,  rate: 2 },
  { id: "drohne",   emoji: "🛸", name: "Pfand-Späher-Drohne", desc: "Scannt Parks und Hinterhöfe aus der Luft.",    base: 3500, rate: 12 },
  { id: "automat",  emoji: "♻️", name: "Eigener Pfandautomat", desc: "Die Leute bringen den Pfand jetzt zu DIR.",   base: 4e4,  rate: 70 },
  { id: "hof",      emoji: "🏭", name: "Recyclinghof",        desc: "Flaschensammeln in industriellen Dimensionen.", base: 5e5,  rate: 400 },
  { id: "logistik", emoji: "🚛", name: "Logistikzentrum",     desc: "LKW-Ladungen voller Leergut, rund um die Uhr.", base: 6e6,  rate: 2400 },
  { id: "brauerei", emoji: "🍺", name: "Eigene Brauerei",     desc: "Du produzierst die Flaschen jetzt selbst. Genial.", base: 8e7, rate: 15000 },
  { id: "konzern",  emoji: "🏢", name: "PFAND AG",            desc: "Börsennotiert. Vom Penner zum CEO.",           base: 1e9,  rate: 100000 },
];
const GEN_MILESTONE = B.kolonne.milestoneEvery;
const KOLONNE_UNLOCK_LVL = B.kolonne.unlockLevel;

/* Respekt-Talente: permanente Meta-Progression über Prestige-Läufe */
const TALENTS = {
  ruf:      { emoji: "⭐", name: "Straßen-Ruf",  desc: "+5 % auf alle Einnahmen pro Stufe",            max: Infinity, cost: l => 1 + Math.floor(l / 2) },
  fuehrung: { emoji: "👥", name: "Anführer",     desc: "+25 % Kolonnen-Ausbeute pro Stufe",            max: Infinity, cost: l => 2 + l },
  start:    { emoji: "💼", name: "Startkapital", desc: "Starte nach jedem Neuanfang mit Geld (x4 pro Stufe)", max: 8, cost: l => 1 + l },
  schlaf:   { emoji: "😴", name: "Tiefschläfer", desc: "+2 h Offline-Limit & +10 % Offline-Rate pro Stufe", max: 12, cost: l => 1 + l },
  lehre:    { emoji: "🎓", name: "Lehrmeister",  desc: "-10 % Trainingszeit pro Stufe",                max: 10, cost: l => 1 + l },
  autotour: { emoji: "🔁", name: "Dauerläufer",  desc: "Touren starten automatisch neu (auch offline)", max: 1, cost: () => 3 },
  autosell: { emoji: "🤖", name: "Verkaufs-Bot", desc: "Verkauft automatisch, sobald das Gepäck voll ist", max: 1, cost: () => 5 },
};

const TITLES = [
  [1,  "Frischling"],
  [5,  "Flaschensammler"],
  [10, "Pfand-Profi"],
  [18, "Kiez-Kenner"],
  [25, "Straßen-Legende"],
  [35, "Pfand-Baron"],
  [50, "PFANDLORD"],
];

/* Endlose Erfolgs-Serien: jede Stufe gibt dauerhaft +1 % auf alles */
const SERIES = [
  { id: "flaschen", icon: "🍾", name: "Sammler",     unit: "Flaschen gesamt", val: s => s.totalFlaschen, thr: t => 100 * Math.pow(10, t) },
  { id: "geld",     icon: "💰", name: "Verdiener",   unit: "€ gesamt",        val: s => s.totalGeld,     thr: t => 100 * Math.pow(10, t) },
  { id: "level",    icon: "📈", name: "Aufsteiger",  unit: "Level",           val: s => s.level,         thr: t => 5 * (t + 1) * (t + 2) / 2 },
  { id: "kolonne",  icon: "👥", name: "Chef",        unit: "Kolonnen-Größe",  val: s => totalGens(s),    thr: t => Math.round(10 * Math.pow(2.5, t)) },
  { id: "prestige", icon: "⭐", name: "Legende",     unit: "Neuanfänge",      val: s => s.prestigeCount, thr: t => Math.pow(2, t) },
];

/* Einmalige Erfolge mit Geld-Belohnung */
const ACHIEVEMENTS = [
  { id: "hund",     icon: "🐕", name: "Bester Freund",      desc: "Adoptiere einen Hund",            reward: 40,   cond: s => s.items.hund >= 1 },
  { id: "combo",    icon: "🔥", name: "Schnorr-Maschine",   desc: "Erreiche Combo x3",               reward: 60,   cond: s => s.maxCombo >= 50 },
  { id: "kurs",     icon: "📊", name: "Wolf of Pfandstraße", desc: "Verkaufe bei Kurs ≥ 0,40 €",     reward: 120,  cond: s => s.soldHighKurs },
  { id: "streak3",  icon: "🗓️", name: "Stammgast",          desc: "3 Tage Login-Streak",             reward: 75,   cond: s => s.streak.best >= 3 },
  { id: "streak7",  icon: "🔥", name: "Woche durchgezogen", desc: "7 Tage Login-Streak",             reward: 400,  cond: s => s.streak.best >= 7 },
  { id: "prestige", icon: "⭐", name: "Respektsperson",     desc: "Erster Neuanfang mit Respekt",    reward: 500,  cond: s => s.prestigeCount >= 1 },
  { id: "imperium", icon: "🏙️", name: "Straßen-Imperium",   desc: "100 Leute/Anlagen in der Kolonne", reward: 5e4, cond: s => totalGens(s) >= 100 },
  { id: "kreislauf", icon: "🍺", name: "Kreislaufwirtschaft", desc: "Besitze eine eigene Brauerei",   reward: 5e6,  cond: s => (s.generators.brauerei || 0) >= 1 },
];

/* Generische Tour-Events – laufen überall. Optional:
   bottles/geld = Bonus-Range, needsDog / needsGens = Bedingung */
const MISSION_EVENTS = [
  { txt: "Du durchwühlst einen Mülleimer. Riecht nach Döner. Und nach Entscheidungen.", w: 18 },
  { txt: "Ein Passant schaut dich mitleidig an. Du schaust mitleidig zurück – er hat gleich ein Meeting.", w: 14 },
  { txt: "Jackpot! Ein ganzer Kasten Leergut hinterm Kiosk!", w: 6, bottles: [8, 25] },
  { txt: "Party-Überreste im Park – Flaschen ohne Ende. Und ein einzelner Schuh. Warum immer ein einzelner Schuh?", w: 6, bottles: [5, 15] },
  { txt: "Du findest einen zerknüllten Schein im Gebüsch. Riecht komisch, zählt trotzdem.", w: 5, geld: [2, 15] },
  { txt: "Ein Student schenkt dir sein restliches Sixpack (leer). „Ehrenmann“, sagt er. Du nickst weise.", w: 8, bottles: [4, 6] },
  { txt: "Regen setzt ein. Deine Jacke ist wasserdicht. Also: war mal. Also: nie.", w: 10 },
  { txt: "Möwe klaut dir fast ein Brötchen. Ihr schreit euch an. Die Möwe gewinnt.", w: 9 },
  { txt: "Du findest eine „Rolex“ (aus dem Kaugummiautomaten). Trotzdem was wert!", w: 2, geld: [20, 60] },
  { txt: "Flaschensammler-Kollege nickt dir respektvoll zu. Kein Wort. Alles gesagt.", w: 9 },
  { txt: "Ein TikToker filmt dich für seinen „Streetlife“-Kanal und drückt dir was in die Hand.", w: 3, geld: [10, 40] },
  { txt: "Öffentliche Toilette: 1 €. Gebüsch: kostenlos. Du bist schließlich Unternehmer.", w: 8 },
  { txt: "Halbe Pizza auf dem Karton. Hawaii. Du hast Standards. Du isst sie trotzdem.", w: 8 },
  { txt: "Ein Betrunkener will mit dir philosophieren. Nach zehn Minuten hat er recht und du seine Flasche.", w: 7, bottles: [1, 3] },
  { txt: "Ein Rentner mit Rollator überholt dich auf der Sammelroute. Respekt und Scham, ein Gefühl.", w: 7 },
  { txt: "Du findest ein Portemonnaie und gibst es ab. Finderlohn! Karma zahlt bar.", w: 3, geld: [5, 20] },
  { txt: "Der Pfandautomat spuckt den Bon aus wie eine Beleidigung. Du steckst ihn ein wie einen Scheck.", w: 7 },
  { txt: "Eine Taube starrt dich an, als wüsstest du ihr was schuldig. Vielleicht stimmt das.", w: 8 },
  { txt: "Du testest neue Pappschild-Sprüche. „Für Bier – wenigstens lüg ich nicht.“ Läuft.", w: 6, geld: [1, 5] },
  { txt: "Kippenstummel-Bingo vorm Späti. Du gewinnst. Der Preis ist Husten.", w: 7 },
  { txt: "Dein Hund erschnüffelt eine Flaschen-Goldader!", w: 4, bottles: [10, 30], needsDog: true },
  { txt: "Dein Hund pinkelt an einen E-Scooter. Du gibst ihm ein Leckerli. Prinzipien sind Prinzipien.", w: 6, needsDog: true },
  { txt: "Einer deiner Sammel-Kumpel ruft an: „Chef, wir haben den Glascontainer … befreit.“ Du fragst nicht nach.", w: 5, bottles: [10, 25], needsGens: true },
  { txt: "Kolonnen-Meeting am Kiosk. Tagesordnung: Wer kriegt die Route am Späti? Es eskaliert herzlich.", w: 5, needsGens: true },
];

/* Revier-Events – jedes Revier hat seinen eigenen Sound.
   Key = Distrikt-Name bzw. Basis-Name der prozeduralen Reviere. */
const DISTRICT_EVENTS = {
  "Vorstadt": [
    { txt: "Ein Reihenhausbesitzer wässert seinen Rasen und dich gleich mit. „Tschuldigung“ sagt er nicht.", w: 8 },
    { txt: "Gelber Sack aufgeplatzt. Für andere Müll, für dich ein Buffet mit Selbstbedienung.", w: 7, bottles: [3, 8] },
    { txt: "Die Nachbarschafts-WhatsApp-Gruppe hat dich gemeldet. Als was, weiß keiner so genau.", w: 8 },
    { txt: "Kindergeburtstag entsorgt Capri-Sonnen. Kein Pfand, aber du trinkst die Reste. Kirsche. Stark.", w: 7 },
    { txt: "Ein Rentner erklärt dir 45 Minuten das Pfandsystem. Du kennst es. Er auch. Er zahlt Vortragshonorar.", w: 5, geld: [1, 4] },
  ],
  "Bahnhofsviertel": [
    { txt: "Der Späti-Mann legt dir wortlos zwei Flaschen raus. Ehre unter Geschäftsleuten.", w: 7, bottles: [2, 4] },
    { txt: "Ein Junggesellenabschied zieht durch. Was die zurücklassen, bringt einen Pfandautomaten zum Weinen. Vor Freude.", w: 6, bottles: [8, 20] },
    { txt: "Der Bahnhofsklo-Wärter kennt dich beim Namen. Du weißt nicht, ob das gut ist.", w: 8 },
    { txt: "Jemand kotzt haarscharf neben deinen Beutel. Knapp daneben ist auch vorbei. Glück gehabt.", w: 7 },
    { txt: "Ein Taschendieb versucht’s bei dir. Ihr lacht beide. Dann gibt er dir zwei Euro.", w: 5, geld: [2, 5] },
  ],
  "Uni-Campus": [
    { txt: "Erstsemester-Party! Die BWLer werfen Flaschen weg, für deren Pfand sie später Excel-Kurse geben.", w: 6, bottles: [6, 18] },
    { txt: "Ein Philosophie-Student erklärt dir, dass Besitz Diebstahl ist. Sein MacBook glänzt dabei stolz.", w: 8 },
    { txt: "Du hältst einen Gastvortrag: „Pfandwirtschaft in der Praxis“. Also: Du redest laut im Foyer. Es regnet Münzen.", w: 5, geld: [2, 8] },
    { txt: "Flunkyball-Turnier auf der Wiese. Du wartest am Spielfeldrand wie ein Geier mit Fachwissen.", w: 6, bottles: [5, 12] },
    { txt: "Eine Soziologie-Studentin interviewt dich für ihre Bachelorarbeit. Honorar: ein Mensa-Bon und Kleingeld.", w: 5, geld: [3, 6] },
  ],
  "Innenstadt": [
    { txt: "Ein Anzugträger telefoniert so laut über seinen Bonus, dass du aus Prinzip direkt vor ihm sammelst.", w: 8 },
    { txt: "Glühweintassen-Niveau an Flaschen – und es ist nicht mal Dezember. Du stellst keine Fragen.", w: 6, bottles: [5, 15] },
    { txt: "Der Kaufhaus-Detektiv folgt dir unauffällig. Du führst ihn dreimal um den Brunnen. Kardiotraining für euch beide.", w: 8 },
    { txt: "Ein Straßenmusiker spielt Wonderwall. Du kassierst Mitleids-Münzen, die eigentlich ihm galten.", w: 5, geld: [2, 6] },
    { txt: "Eine Demo zieht vorbei. Wofür, bleibt unklar – aber danach liegen da zweihundert Flaschen.", w: 5, bottles: [10, 25] },
  ],
  "Hafenviertel": [
    { txt: "Die Matrosen-Kneipe kippt ihr Leergut raus. Der Wirt nickt dir zu wie einem Kollegen.", w: 6, bottles: [8, 20] },
    { txt: "Eine Möwen-Gang hat dein Revier übernommen. Die Verhandlungen kosten dich ein halbes Fischbrötchen.", w: 8 },
    { txt: "Containerschiff-Crew feiert Landgang. Was Seeleute wegtrinken, ist dein Quartalsergebnis.", w: 5, bottles: [10, 30] },
    { txt: "Du findest eine Buddel mit Zettel: „Hilfe, ich bin im Hafenviertel gefangen.“ Same.", w: 7 },
    { txt: "Ein Angler zeigt dir seinen Fang: ein Stiefel. Du zeigst ihm deinen: zwölf Flaschen. Du gewinnst.", w: 6, bottles: [4, 12] },
  ],
  "Stadion & Festwiese": [
    { txt: "Abpfiff! Zehntausend Fans, null Mülltrennung. Für dich regnet es flüssiges Gold in Glasform.", w: 6, bottles: [15, 40] },
    { txt: "Ein Fan im Trikot weint wegen der Niederlage. Du hältst tröstend seine Flasche. Und behältst sie.", w: 7, bottles: [1, 3] },
    { txt: "Die VIP-Security schaut demonstrativ weg. Du warst nie hier. Die Sektflaschen auch nicht.", w: 5, bottles: [8, 20] },
    { txt: "Der Bratwurst-Standler schenkt dir eine „aus Versehen“. Die Ehre der Festwiese.", w: 7 },
    { txt: "Public Viewing, Elfmeterschießen, verloren. Trauer-Flaschen zählen doppelt.", w: 5, bottles: [10, 30] },
  ],
  "Szeneviertel": [
    { txt: "Ein Hipster erklärt dir, Flaschensammeln sei „eigentlich total zero waste“. Er zahlt 9 € für Hafermilch-Latte.", w: 8 },
    { txt: "Vernissage! Der Wein ist bio, die Gespräche sind es nicht. Die Flaschen gehören dir.", w: 6, bottles: [6, 15] },
    { txt: "Eine Band lädt Equipment aus und dich zum Soundcheck ein. Du bleibst für den Pfand. Und ein bisschen für die Musik.", w: 6, bottles: [3, 8] },
  ],
  "Messegelände": [
    { txt: "Start-up-Messe: Jeder Stand hat Freibier und niemand ein Geschäftsmodell.", w: 6, bottles: [8, 20] },
    { txt: "Du bekommst versehentlich ein Messebändchen. Heute bist du „Fachbesucher“. Das Buffet zahlt Dividende.", w: 5, geld: [5, 15] },
    { txt: "Ein Keynote-Speaker sagt vierzehnmal „Disruption“. Du disruptierst derweil den lokalen Leergut-Markt.", w: 7, bottles: [5, 12] },
  ],
  "Flughafen-Terminal": [
    { txt: "Duty-Free-Tüte im Mülleimer: leere Wodkaflasche, kein Pfand – aber daneben liegt ein Fünfer.", w: 6, geld: [3, 8] },
    { txt: "Ein Gestrandeter schläft am Gate wie du auf der Parkbank. Du fühlst dich überlegen. Er hat Lounge-Zugang. Egal.", w: 8 },
    { txt: "Die Security beäugt deinen Einkaufswagen. „Handgepäck“, sagst du. Keiner lacht. Du darfst trotzdem bleiben.", w: 6, bottles: [3, 10] },
  ],
  "Kreuzfahrt-Hafen": [
    { txt: "Dreitausend Rentner strömen von Bord und kaufen Magnete. Ihre Sektflaschen bleiben auf Deck 4. Du kennst einen Steward.", w: 6, bottles: [10, 25] },
    { txt: "Ein Kapitän wirft eine Münze in deinen Becher und salutiert. Du salutierst zurück. Würde.", w: 6, geld: [2, 5] },
    { txt: "Das Schiffshorn erschreckt dich in einen Busch. Im Busch: sechs Flaschen. Schicksal.", w: 6, bottles: [4, 8] },
  ],
  "Olympiapark": [
    { txt: "Marathon-Tag! Zehntausend Iso-Flaschen, und du bist der Einzige mit Ausdauer im Ziel.", w: 6, bottles: [12, 30] },
    { txt: "Ein Personal Trainer bietet dir ein Probetraining an. Du hebst wortlos deinen Sammelsack. Er nickt anerkennend.", w: 7 },
    { txt: "Siegerehrung im Kleinformat: Du stehst ganz oben. Auf dem Glascontainer.", w: 6, bottles: [5, 12] },
  ],
  "Banken-Distrikt": [
    { txt: "Ein Investmentbanker entsorgt eine Champagnerflasche. Pfandwert: null. Sein Gewissen: auch. Er gibt dir einen Zehner.", w: 5, geld: [8, 15] },
    { txt: "Zwei Anzüge streiten, wer das Meeting „ownt“. Du ownst derweil ihre Wasserflaschen.", w: 7, bottles: [3, 8] },
    { txt: "After-Work auf der Dachterrasse. Der Aufzug braucht eine Karte. Der Müllraum nicht.", w: 6, bottles: [8, 18] },
  ],
  "Vergnügungspark": [
    { txt: "Nach dem Looping lassen alle ihre Getränke stehen. Die Physik ist dein Geschäftspartner.", w: 6, bottles: [6, 15] },
    { txt: "Ein Maskottchen umarmt dich ungefragt. Ihr tauscht Leidensgeschichten. Es steckt dir was zu.", w: 6, geld: [4, 8] },
    { txt: "Du gewinnst am Dosenwerfen. Der Standbetreiber ahnt nicht, dass du auch die Dosen willst.", w: 7, bottles: [3, 6] },
  ],
  "Mega-Festival": [
    { txt: "Tag 3, Zeltplatz: Was hier rumsteht, würde ein Logistikzentrum auslasten. Du weinst fast vor Glück.", w: 6, bottles: [20, 50] },
    { txt: "Ein Festivalgänger tauscht zehn Flaschen gegen dein Feuerzeug. Bester Deal deines Lebens.", w: 6, bottles: [8, 12] },
    { txt: "Der Headliner bedankt sich „bei den echten Helden“. Du fühlst dich angesprochen. Zu Recht.", w: 7 },
  ],
};

function districtKey(i) {
  if (i < DISTRICTS.length) return DISTRICTS[i].name;
  return PROC_DISTRICTS[(i - DISTRICTS.length) % PROC_DISTRICTS.length][0];
}

const TOUR_START_LINES = [
  d => `${d.emoji} Beutel geschnappt, Würde geparkt – auf nach ${d.name}!`,
  d => `${d.emoji} Du ziehst los. ${d.name} weiß noch nicht, was gleich passiert.`,
  d => `${d.emoji} Dienstbeginn in ${d.name}. Der Chef bist du. Der Praktikant leider auch.`,
  d => `${d.emoji} ${d.name} ruft. Genauer gesagt: die Mülleimer von ${d.name}.`,
  d => `${d.emoji} Route geplant, Rücken gerade – ${d.name}, es ist Pfandzeit.`,
];

const BEG_CRITS = [
  "Ein Tourist verwechselt dich mit einem Straßenkünstler!",
  "Eine Oma steckt dir „für was Warmes“ einen Schein zu!",
  "Ein Banker mit schlechtem Gewissen leert sein Portemonnaie!",
  "Dein Pappschild-Spruch geht viral!",
  "Ein Junggesellenabschied adoptiert dich für eine Stunde als Maskottchen!",
  "Jemand will dein Kleingeld „in Krypto investieren“. Du lehnst ab. Er zahlt Respekt-Aufschlag!",
  "Eine Kirchengruppe übt Nächstenliebe. An dir. Alle gleichzeitig!",
  "Ein Promi steigt aus der Limo und braucht dringend ein Foto „mit echten Menschen“!",
  "Du machst den Hundeblick. Es funktioniert. Es funktioniert immer!",
  "Falscher Fuffziger im Becher! Der Späti nimmt ihn trotzdem!",
  "Eine Schulklasse sammelt „für einen guten Zweck“. Der Lehrer entscheidet: Du bist der Zweck!",
  "Silvester-Stimmung im Juli: Jemand wirft dir „Glücksgeld“ zu und rennt weg!",
];

const QUEST_META = {
  sammeln:   { icon: "🍾", txt: t => `Sammle ${fmtNum(t)} Flaschen` },
  verkaufen: { icon: "♻️", txt: t => `Verkaufe Flaschen für ${fmtGeld(t)}` },
  betteln:   { icon: "🤲", txt: t => `Bettle ${fmtNum(t)}× erfolgreich` },
  touren:    { icon: "🚶", txt: t => `Schließe ${t} Touren ab` },
};

/* ---------------- State ---------------- */

const SAVE_KEY = "pfandlord_save_v1";

function defaultState() {
  return {
    version: 3,
    createdAt: Date.now(),
    lastSeen: Date.now(),
    lastGenTick: Date.now(),
    geld: 0,
    flaschen: 0,
    energy: BALANCE.beg.energyMax,
    xp: 0,
    level: 1,
    respekt: 0,        // ausgebbare Talent-Punkte
    respektEarned: 0,  // insgesamt je verdient (für Anzeige)
    prestigeCount: 0,
    totalFlaschen: 0,
    totalGeld: 0,
    runGeld: 0,        // Einnahmen im aktuellen Lauf → bestimmt Prestige-Gewinn
    begToday: 0,
    maxCombo: 0,
    soldHighKurs: false,
    kurs: 0.25,
    district: 0,
    mission: null,   // {idx, start, dauer, ratePerSec, name, extraB, extraG, log, lastEvent}
    training: null,  // {skill, start, dauer}
    items: { beutel: 0, hund: 0, radar: 0, scooter: 0, lager: 0 },
    skills: { sammeln: 0, feilschen: 0, schnorren: 0, stadt: 0 },
    generators: {},  // id → Anzahl
    talents: {},     // id → Stufe
    achTiers: {},    // Serien-id → erreichte Stufe
    quests: null,    // {date, list:[{type,target,prog,reward,done}]}
    streak: { last: "", count: 0, best: 0 },
    achievements: {},
  };
}

let S = defaultState();

const gen = id => S.generators[id] || 0;
const tal = id => S.talents[id] || 0;
const tier = id => S.achTiers[id] || 0;
function totalGens(s) { return Object.values(s.generators || {}).reduce((a, b) => a + b, 0); }

/* ---------------- Formeln ---------------- */

function achTierTotal() { return SERIES.reduce((a, ser) => a + tier(ser.id), 0); }

// Der eine große Multiplikator: Talente × Erfolgs-Stufen
function globalMult() {
  return (1 + tal("ruf") * B.talents.rufBonus) * (1 + achTierTotal() * B.erfolge.tierBonus);
}

function capacity() { return Math.round(B.items.capacityBase * Math.pow(B.items.capacityGrowth, S.items.beutel)); }

function bottlesPerMin() {
  return B.tour.baseBottlesPerMin
    * districtDef(S.district).mult
    * (1 + S.skills.sammeln * B.skills.sammelnBonus)
    * (1 + S.items.hund * B.items.hundBonus)
    * (1 + S.items.radar * B.items.radarBonus)
    * globalMult();
}

function missionDuration(baseSec) {
  return Math.max(B.tour.minDurationSec,
    Math.round(baseSec * Math.pow(B.items.scooterTimeMult, S.items.scooter) * Math.pow(B.skills.stadtTimeMult, S.skills.stadt)));
}

function sellPrice() {
  return S.kurs * (1 + S.skills.feilschen * B.skills.feilschenBonus) * globalMult();
}

// Betteln: kleine Basis + Anteil am passiven Einkommen (Cookie-Clicker-Prinzip).
// Fühlt sich immer lohnend an, kann Touren/Kolonne aber nie strukturell überholen.
function begValue() {
  const base = (B.beg.base + S.level * B.beg.perLevel)
    * (1 + S.skills.schnorren * B.skills.schnorrenBonus) * globalMult();
  return base + kolonneIncome() * B.beg.passiveShare;
}

function maxEnergy() { return Math.round(B.beg.energyMax + S.skills.schnorren * B.beg.energyPerSkillLvl); }
function energyRegen() { return B.beg.regenPerSec * (1 + S.skills.schnorren * B.beg.regenPerSkillLvl); }

function xpNeeded(lvl) { return Math.round(B.xp.levelBase * Math.pow(lvl, B.xp.levelExp)); }

function skillCost(lvl) { return Math.round(B.skills.costBase * Math.pow(B.skills.costGrowth, lvl)); }
function skillTime(lvl) {
  return Math.max(10, Math.round(B.skills.timeBaseSec * Math.pow(B.skills.timeGrowth, lvl) * Math.pow(B.talents.lehreTimeMult, tal("lehre"))));
}

function genCost(g, owned) { return g.base * Math.pow(B.kolonne.costGrowth, owned); }
function genBulkCost(g, owned, n) { return genCost(g, owned) * (Math.pow(B.kolonne.costGrowth, n) - 1) / (B.kolonne.costGrowth - 1); }
function genMaxBuy(g, owned, geld) {
  const c = genCost(g, owned);
  if (geld < c) return 0;
  return Math.floor(Math.log(geld * (B.kolonne.costGrowth - 1) / c + 1) / Math.log(B.kolonne.costGrowth));
}
function genUnitRate(g, cnt) { return g.rate * Math.pow(B.kolonne.milestoneMult, Math.floor(cnt / B.kolonne.milestoneEvery)); }
function kolonneRate() { // Flaschen pro Sekunde
  return GENERATORS.reduce((a, g) => a + gen(g.id) * genUnitRate(g, gen(g.id)), 0) * (1 + tal("fuehrung") * B.kolonne.fuehrungBonus);
}
function kolonneIncome() { return kolonneRate() * sellPrice(); } // € pro Sekunde
function kolonneUnlocked() { return S.level >= KOLONNE_UNLOCK_LVL || totalGens(S) > 0; }

function prestigeGain() { return Math.floor(Math.sqrt(S.runGeld / B.prestige.geldDivisor)); }

function offlineMaxHours() { return B.offline.baseHours + S.items.lager * B.offline.hoursPerLagerLvl + tal("schlaf") * B.talents.schlafOfflineHours; }
function offlineRate() {
  return bottlesPerMin() * (B.offline.personalRateBase + S.items.lager * B.offline.personalRatePerLagerLvl) * (1 + tal("schlaf") * B.talents.schlafOfflineRate);
}
function offlineGenFactor() { return Math.min(1, B.offline.kolonneFactorBase * (1 + tal("schlaf") * B.talents.schlafOfflineRate)); }

/* ---------------- Formatierung ---------------- */

const BIG_UNITS = ["Mio.", "Mrd.", "Bio.", "Brd.", "Trill."];

function fmtBig(v) {
  const e = Math.min(BIG_UNITS.length - 1, Math.floor(Math.log10(Math.abs(v)) / 3) - 2);
  return (v / Math.pow(10, (e + 2) * 3)).toLocaleString("de-DE", { maximumFractionDigits: 2 }) + " " + BIG_UNITS[e];
}

function fmtGeld(v) {
  const a = Math.abs(v);
  if (a >= 1e21) return v.toExponential(2).replace(".", ",") + " €";
  if (a >= 1e6) return fmtBig(v) + " €";
  if (a >= 1e5) return (v / 1000).toLocaleString("de-DE", { maximumFractionDigits: 1 }) + "k €";
  return v.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

function fmtNum(v) {
  v = Math.floor(v);
  const a = Math.abs(v);
  if (a >= 1e21) return v.toExponential(2).replace(".", ",");
  if (a >= 1e6) return fmtBig(v);
  if (a >= 1e4) return (v / 1000).toLocaleString("de-DE", { maximumFractionDigits: 1 }) + "k";
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

function roman(n) {
  if (n <= 0 || n >= 4000) return String(n);
  const M = [["M",1000],["CM",900],["D",500],["CD",400],["C",100],["XC",90],["L",50],["XL",40],["X",10],["IX",9],["V",5],["IV",4],["I",1]];
  let out = "";
  for (const [sym, val] of M) while (n >= val) { out += sym; n -= val; }
  return out;
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

// Vibration erst nach der ersten Interaktion – vorher blockt der Browser sie eh
let userInteracted = false;
document.addEventListener("pointerdown", () => { userInteracted = true; }, { once: true, capture: true });
function vibrate(ms) { if (userInteracted && navigator.vibrate) navigator.vibrate(ms); }

/* ---------------- Geld / XP / Level ---------------- */

function addGeld(v) {
  S.geld += v;
  S.totalGeld += v;
  S.runGeld += v;
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
    for (let i = 0; i < 60; i++) {
      const d = districtDef(i);
      if (d.lvl === S.level) { toast(`🗺️ Neues Revier freigeschaltet: ${d.name}!`, "gold"); break; }
      if (d.lvl > S.level) break;
    }
    if (S.level === KOLONNE_UNLOCK_LVL) toast("👥 Neue Mechanik: Die Sammel-Kolonne wartet auf dich!", "gold");
    renderDistricts();
    checkAchievements();
  }
}

/* ---------------- Missionen ---------------- */

function startMission(idx) {
  if (S.mission) return;
  const m = MISSIONS[idx];
  S.mission = {
    idx,
    start: Date.now(),
    dauer: missionDuration(m.sec),
    ratePerSec: (bottlesPerMin() / 60) * m.bonus,
    name: m.name,
    extraB: 0,
    extraG: 0,
    log: [TOUR_START_LINES[Math.floor(Math.random() * TOUR_START_LINES.length)](districtDef(S.district))],
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
  questProgress("touren", 1);
  if (!silent) {
    toast(`✅ ${mi.name} beendet: ${fmtNum(found)} Flaschen!`);
    vibrate(40);
  }
  if (tal("autotour") >= 1 && mi.idx != null) startMission(mi.idx);
  renderMissionState();
}

function abortMission() {
  const mi = S.mission;
  if (!mi) return;
  const elapsed = (Date.now() - mi.start) / 1000;
  const found = Math.floor(missionBottles(mi, elapsed) * B.tour.abortFraction);
  S.mission = null;
  collectBottles(found);
  toast(`🏃 Tour abgebrochen – immerhin ${fmtNum(found)} Flaschen.`);
  renderMissionState();
  save();
}

function collectBottles(n, silent = false) {
  const bot = tal("autosell") >= 1;
  let kept = n;
  if (!bot) {
    // Ohne Verkaufs-Bot begrenzt das Gepäck – Überschuss verfällt
    const space = capacity() - S.flaschen;
    kept = Math.max(0, Math.min(n, space));
    const lost = n - kept;
    if (lost > 0 && !silent) toast(`😤 ${fmtNum(lost)} Flaschen passten nicht mehr rein! Kauf mehr Stauraum.`, "red");
  }
  S.flaschen += kept;
  S.totalFlaschen += kept;
  addXp(kept * B.tour.xpPerBottle);
  questProgress("sammeln", kept);
  if (bot && S.flaschen >= capacity()) {
    // Der Bot verwertet auch Überschuss, statt ihn verfallen zu lassen
    const v = sellAll(true);
    if (v > 0 && !silent) toast(`🤖 Verkaufs-Bot: +${fmtGeld(v)}`);
  }
  bumpStat("stat-flaschen");
  checkAchievements();
}

function missionEventTick() {
  const mi = S.mission;
  if (!mi) return;
  const now = Date.now();
  if (now - mi.lastEvent < 8000 + Math.random() * 12000) return;
  mi.lastEvent = now;
  const pool = [...MISSION_EVENTS, ...(DISTRICT_EVENTS[districtKey(S.district)] || [])]
    .filter(e => (!e.needsDog || S.items.hund > 0) && (!e.needsGens || totalGens(S) > 0));
  const totalW = pool.reduce((a, e) => a + e.w, 0);
  let r = Math.random() * totalW;
  let ev = pool[0];
  for (const e of pool) { r -= e.w; if (r <= 0) { ev = e; break; } }
  let line = ev.txt;
  if (ev.bottles) {
    const b = Math.round((ev.bottles[0] + Math.random() * (ev.bottles[1] - ev.bottles[0])) * districtDef(S.district).mult * globalMult());
    mi.extraB += b;
    line += ` (+${fmtNum(b)} 🍾)`;
  }
  if (ev.geld) {
    const g = +((ev.geld[0] + Math.random() * (ev.geld[1] - ev.geld[0])) * globalMult()).toFixed(2);
    mi.extraG += g;
    line += ` (+${fmtGeld(g)})`;
  }
  mi.log.push(line);
  if (mi.log.length > 8) mi.log.shift();
  renderMissionLog();
}

/* ---------------- Verkaufen / Pfandkurs ---------------- */

function updateKurs() {
  const drift = (Math.random() - 0.5) * B.kurs.drift;
  const pull = (B.kurs.base - S.kurs) * B.kurs.pullback;
  S.kurs = Math.min(B.kurs.max, Math.max(B.kurs.min, S.kurs + drift + pull));
  renderKurs();
}

function sellAll(silent = false) {
  if (S.flaschen <= 0) { if (!silent) toast("Keine Flaschen im Gepäck!", "red"); return 0; }
  const n = S.flaschen;
  const value = +(n * sellPrice()).toFixed(2);
  S.flaschen = 0;
  addGeld(value);
  addXp(Math.ceil(n * B.xp.sellPerBottle));
  if (S.kurs >= 0.40) S.soldHighKurs = true;
  questProgress("verkaufen", value);
  if (!silent) {
    toast(`♻️ ${fmtNum(n)} Flaschen verkauft: +${fmtGeld(value)}`);
    vibrate(30);
    const btn = $("btn-sell").getBoundingClientRect();
    particle("+" + fmtGeld(value), btn.left + btn.width / 2, btn.top);
  }
  checkAchievements();
  save();
  return value;
}

/* ---------------- Betteln ---------------- */

let combo = 0;
let lastBeg = 0;

let lastEmptyToast = 0;

function beg(ev) {
  const now = Date.now();
  if (S.energy < 1) {
    if (now - lastEmptyToast > 3000) {
      lastEmptyToast = now;
      toast("😮‍💨 Ausgepowert! Deine Energie lädt sich langsam wieder auf.", "red");
    }
    return;
  }
  S.energy -= 1;
  if (now - lastBeg < B.beg.comboWindowMs) combo = Math.min(B.beg.comboMax, combo + 1);
  else combo = 0;
  lastBeg = now;
  S.maxCombo = Math.max(S.maxCombo, combo);

  const mult = 1 + combo * B.beg.comboStep;
  let gain = begValue() * mult;
  let crit = false;
  if (Math.random() < B.beg.critChance) {
    crit = true;
    gain *= B.beg.critMin + Math.random() * (B.beg.critMax - B.beg.critMin);
    toast("💥 " + BEG_CRITS[Math.floor(Math.random() * BEG_CRITS.length)], "gold");
    vibrate([30, 40, 60]);
  }
  gain = +gain.toFixed(2);
  addGeld(gain);
  S.begToday += gain;
  addXp(B.beg.xpPerTap);
  questProgress("betteln", 1);

  const x = ev.clientX, y = ev.clientY;
  particle((crit ? "💥 " : "") + "+" + fmtGeld(gain), x || innerWidth / 2, y || innerHeight / 2);
  $("beg-total").textContent = fmtGeld(S.begToday);
  checkAchievements();
}

function comboTick() {
  if (combo > 0 && Date.now() - lastBeg > B.beg.comboWindowMs) combo = 0;
  const pct = (combo / B.beg.comboMax) * 100;
  $("combo-bar").style.width = pct + "%";
  $("combo-label").textContent = "Combo x" + (1 + combo * B.beg.comboStep).toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 2 });
  $("energy-bar").style.width = Math.min(100, (S.energy / maxEnergy()) * 100) + "%";
  $("energy-label").textContent = `⚡ ${Math.floor(S.energy)}/${maxEnergy()}`;
}

/* ---------------- Shop ---------------- */

function buyItem(key) {
  const cost = itemCost(key, S.items[key]);
  if (S.geld < cost) { toast("Zu wenig Kohle! 💸", "red"); return; }
  S.geld -= cost;
  S.items[key]++;
  toast(`${ITEMS[key].emoji} Gekauft: ${itemStageName(key, S.items[key])}!`, "gold");
  vibrate(40);
  renderShop();
  checkAchievements();
  save();
}

/* ---------------- Skills ---------------- */

function startTraining(key) {
  if (S.training) { toast("Du bildest dich schon weiter!", "red"); return; }
  const cost = skillCost(S.skills[key]);
  if (S.geld < cost) { toast("Zu wenig Kohle für den Kurs! 💸", "red"); return; }
  S.geld -= cost;
  S.training = { skill: key, start: Date.now(), dauer: skillTime(S.skills[key]) };
  renderSkills();
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

/* ---------------- Kolonne (Generatoren) ---------------- */

let buyAmount = 1; // 1, 10 oder "max"

function buyGen(id) {
  const g = GENERATORS.find(x => x.id === id);
  const owned = gen(id);
  let n = buyAmount === "max" ? genMaxBuy(g, owned, S.geld) : buyAmount;
  if (n < 1) { toast("Zu wenig Kohle! 💸", "red"); return; }
  const cost = genBulkCost(g, owned, n);
  if (S.geld < cost) { toast("Zu wenig Kohle! 💸", "red"); return; }
  S.geld -= cost;
  S.generators[id] = owned + n;
  const newCnt = S.generators[id];
  if (Math.floor(newCnt / GEN_MILESTONE) > Math.floor(owned / GEN_MILESTONE)) {
    toast(`🎊 Meilenstein: ${g.name} produziert jetzt doppelt!`, "gold");
    vibrate([40, 30, 40]);
  } else {
    toast(`${g.emoji} +${n} ${g.name}`, "gold");
    vibrate(30);
  }
  renderKolonne();
  checkAchievements();
  save();
}

// Zeitbasierte Ressourcen: Kolonne verkauft direkt am Automaten
// (Flaschen/s × Kurs = €/s), Bettel-Energie regeneriert.
function genTick() {
  const now = Date.now();
  const dt = (now - S.lastGenTick) / 1000;
  S.lastGenTick = now;
  if (dt <= 0 || dt > 120) return; // lange Lücken übernimmt applyOffline
  S.energy = Math.min(maxEnergy(), S.energy + dt * energyRegen());
  const rate = kolonneRate();
  if (rate <= 0) return;
  const bottles = rate * dt;
  addGeld(bottles * sellPrice());
  S.totalFlaschen += bottles;
  addXp(bottles * B.kolonne.xpPerBottle);
  questProgress("sammeln", bottles);
}

/* ---------------- Talente ---------------- */

function buyTalent(key) {
  const t = TALENTS[key];
  const lvl = tal(key);
  if (lvl >= t.max) return;
  const cost = t.cost(lvl);
  if (S.respekt < cost) { toast("Nicht genug Respekt! Erst wieder neu anfangen.", "red"); return; }
  S.respekt -= cost;
  S.talents[key] = lvl + 1;
  toast(`${t.emoji} Talent: ${t.name} auf Stufe ${lvl + 1}!`, "gold");
  vibrate(40);
  renderTalents();
  renderProfil();
  save();
}

/* ---------------- Erfolge ---------------- */

function checkAchievements(silent = false) {
  for (const a of ACHIEVEMENTS) {
    if (!S.achievements[a.id] && a.cond(S)) {
      S.achievements[a.id] = true;
      S.geld += a.reward;
      S.totalGeld += a.reward;
      S.runGeld += a.reward;
      if (!silent) {
        toast(`🏆 Erfolg: ${a.name}! (+${fmtGeld(a.reward)})`, "gold");
        vibrate([40, 30, 40]);
        $("badge-profil").classList.add("on");
      }
    }
  }
  checkSeries(silent);
}

function checkSeries(silent = false) {
  for (const ser of SERIES) {
    let t = tier(ser.id);
    const v = ser.val(S);
    while (v >= ser.thr(t)) {
      t++;
      S.achTiers[ser.id] = t;
      if (!silent) {
        toast(`🏆 ${ser.icon} ${ser.name} ${roman(t)} – dauerhaft +1 % auf alles!`, "gold");
        $("badge-profil").classList.add("on");
      }
    }
  }
}

/* ---------------- Prestige ---------------- */

function doPrestige() {
  const gain = prestigeGain();
  if (S.level < 25 || gain <= 0) return;
  if (!confirm(`Wirklich neu anfangen?\n\nDu bekommst +${gain} Respekt-Punkte für den Talentbaum.\nLevel, Geld, Items, Skills und Kolonne werden zurückgesetzt.\nTalente, Erfolge und Streak bleiben.`)) return;
  const keep = {
    respekt: S.respekt + gain,
    respektEarned: S.respektEarned + gain,
    prestigeCount: S.prestigeCount + 1,
    talents: S.talents,
    achievements: S.achievements,
    achTiers: S.achTiers,
    streak: S.streak,
    maxCombo: S.maxCombo,
    soldHighKurs: S.soldHighKurs,
    totalFlaschen: S.totalFlaschen,
    totalGeld: S.totalGeld,
    createdAt: S.createdAt,
    quests: S.quests,
    begToday: S.begToday,
  };
  S = Object.assign(defaultState(), keep);
  if (tal("start") > 0) S.geld = B.talents.startCapitalBase * Math.pow(B.talents.startCapitalGrowth, tal("start") - 1);
  toast(`⭐ Neuanfang! +${gain} Respekt – gib sie im Talentbaum aus (Skills-Tab).`, "gold");
  checkAchievements();
  renderAll();
  save();
}

/* ---------------- Daily & Quests ---------------- */

function todayStr() { return new Date().toISOString().slice(0, 10); }
function yesterdayStr() {
  const d = new Date(); d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function genQuests() {
  const bpm = bottlesPerMin();
  const incomePerSec = Math.max(kolonneIncome(), (bpm / 60) * sellPrice());
  const reward = t => Math.max(15, Math.round(incomePerSec * 600 * t + 10 * S.level));
  const all = [
    { type: "sammeln",   target: Math.max(20, Math.round(bpm * 20 / 5) * 5), reward: reward(1) },
    { type: "verkaufen", target: Math.max(5, Math.round(bpm * 20 * sellPrice())), reward: reward(1) },
    { type: "betteln",   target: Math.min(150, 30 + S.level * 2), reward: reward(0.8) },
    { type: "touren",    target: 3, reward: reward(1.2) },
  ];
  // 3 zufällige, verschiedene Aufgaben
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }
  S.quests = { date: todayStr(), list: all.slice(0, 3).map(q => ({ ...q, prog: 0, done: false })) };
}

function questProgress(type, amt) {
  if (!S.quests) return;
  const q = S.quests.list.find(x => x.type === type && !x.done);
  if (!q) return;
  q.prog += amt;
  if (q.prog >= q.target) {
    q.done = true;
    addGeld(q.reward);
    toast(`🎁 Tagesaufgabe geschafft: +${fmtGeld(q.reward)}!`, "gold");
    vibrate([40, 30, 40]);
    renderQuests();
  }
}

function checkDaily() {
  const today = todayStr();
  if (!S.quests) genQuests();
  if (S.streak.last === today) return;
  if (S.streak.last === yesterdayStr()) S.streak.count++;
  else S.streak.count = 1;
  S.streak.last = today;
  S.streak.best = Math.max(S.streak.best, S.streak.count);
  S.begToday = 0;
  genQuests();
  // Basis + Anteil am passiven Einkommen, damit der Daily nie wertlos wird
  const reward = +(B.daily.basePerStreakTag * S.streak.count * (1 + S.level / 10) * globalMult()
    + kolonneIncome() * B.daily.kolonneSec * (1 + B.daily.kolonneStreakBonus * S.streak.count)).toFixed(2);
  addGeld(reward);
  showModal("🗓️ Täglicher Bonus",
    `<b>Tag ${S.streak.count}</b> deiner Streak!<span class="big">+${fmtGeld(reward)}</span>` +
    `Neue Tagesaufgaben sind da – und morgen wächst die Belohnung weiter.`);
  checkAchievements();
  renderQuests();
}

/* ---------------- Offline-Fortschritt ---------------- */

function applyOffline() {
  const now = Date.now();
  const offlineSecTotal = Math.max(0, (now - S.lastSeen) / 1000);
  let idleStart = S.lastSeen;
  const report = [];

  // Laufende Mission, die inzwischen fertig ist
  if (S.mission) {
    const end = S.mission.start + S.mission.dauer * 1000;
    if (now >= end) {
      const mi = S.mission;
      const found = missionBottles(mi, mi.dauer);
      S.mission = null;
      collectBottles(found, true);
      if (mi.extraG > 0) addGeld(mi.extraG);
      questProgress("touren", 1);
      report.push(`✅ ${mi.name} abgeschlossen: <b>${fmtNum(found)} 🍾</b>`);
      idleStart = end;

      // Dauerläufer: weitere volle Touren in der Restzeit simulieren
      if (tal("autotour") >= 1 && mi.idx != null) {
        const remaining = (now - end) / 1000;
        const cycles = Math.floor(remaining / mi.dauer);
        if (cycles > 0) {
          const extra = Math.floor(mi.ratePerSec * mi.dauer) * cycles;
          collectBottles(extra, true);
          questProgress("touren", cycles);
          report.push(`🔁 Dauerläufer: <b>${cycles} weitere Touren</b> → ${fmtNum(extra)} 🍾`);
        }
        const leftover = remaining - cycles * mi.dauer;
        startMission(mi.idx);
        if (S.mission) S.mission.start = now - leftover * 1000;
        idleStart = now;
      }
    } else {
      idleStart = now; // Mission läuft noch, keine persönliche Idle-Zeit
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

  // Persönliches Sammeln im Schlaf
  const idleSec = Math.max(0, (now - idleStart) / 1000);
  if (idleSec > 120) {
    const cappedSec = Math.min(idleSec, offlineMaxHours() * 3600);
    const found = Math.floor(offlineRate() * (cappedSec / 60));
    if (found > 0) {
      collectBottles(found, true);
      report.push(`🏕️ Im Schlaf gesammelt (${fmtDur(Math.round(cappedSec))}): <b>${fmtNum(found)} 🍾</b>`);
    }
  }

  // Kolonne arbeitet immer – unabhängig von deinen Touren
  if (offlineSecTotal > 60 && kolonneRate() > 0) {
    const gSec = Math.min(offlineSecTotal, offlineMaxHours() * 3600);
    const bottles = kolonneRate() * gSec * offlineGenFactor();
    const income = bottles * sellPrice();
    if (income > 0.01) {
      addGeld(income);
      S.totalFlaschen += bottles;
      addXp(bottles * B.kolonne.xpPerBottle);
      report.push(`👥 Deine Kolonne hat verkauft: <b>+${fmtGeld(income)}</b>`);
    }
  }
  S.lastGenTick = now;
  S.energy = Math.min(maxEnergy(), S.energy + offlineSecTotal * energyRegen());

  if (report.length > 0) {
    showModal("👋 Willkommen zurück!", report.join("<br><br>"));
    checkAchievements();
  }
  S.lastSeen = now;
}

/* ---------------- Rendering ---------------- */

let activeTab = "sammeln";

function renderHeader() {
  $("geld-val").textContent = fmtGeld(S.geld);
  $("flaschen-val").textContent = fmtNum(S.flaschen) + "/" + fmtNum(capacity());
  $("stat-respekt").style.display = S.respektEarned > 0 ? "flex" : "none";
  $("respekt-val").textContent = fmtNum(S.respekt);
  const need = xpNeeded(S.level);
  $("levelbar").style.width = Math.min(100, (S.xp / need) * 100) + "%";
  $("level-label").textContent = `Level ${S.level} · ${title()} · ${fmtNum(S.xp)}/${fmtNum(need)} XP`;
}

function title() {
  let t = TITLES[0][1];
  for (const [lvl, name] of TITLES) if (S.level >= lvl) t = name;
  if (S.level >= 75) t = "PFANDLORD " + roman(Math.floor((S.level - 50) / 25) + 1);
  return t;
}

function renderDistricts() {
  const wrap = $("district-list");
  wrap.innerHTML = "";
  // erstes gesperrtes Revier finden
  let firstLocked = 0;
  while (districtDef(firstLocked).lvl <= S.level) firstLocked++;
  const from = Math.max(0, Math.min(S.district - 1, firstLocked - 5));
  const to = firstLocked + 1; // 2 gesperrte als Teaser
  for (let i = from; i <= to; i++) {
    const d = districtDef(i);
    const locked = S.level < d.lvl;
    const el = document.createElement("div");
    el.className = "district" + (i === S.district ? " active" : "") + (locked ? " locked" : "");
    el.innerHTML = `<span class="d-emoji">${d.emoji}</span>
      <span class="d-name">${d.name}</span>
      ${locked ? `<span class="d-lock">🔒 Level ${d.lvl}</span>` : `<span class="d-mult">x${d.mult.toLocaleString("de-DE", { maximumFractionDigits: 1 })}</span>`}`;
    if (!locked) el.onclick = () => {
      if (S.mission) { toast("Erst die laufende Tour beenden!", "red"); return; }
      S.district = i;
      renderDistricts();
      renderMissionOptions();
      save();
    };
    wrap.appendChild(el);
  }
}

function renderMissionOptions() {
  const wrap = $("mission-options");
  wrap.innerHTML = "";
  MISSIONS.forEach((m, i) => {
    const dur = missionDuration(m.sec);
    const est = Math.floor((bottlesPerMin() / 60) * m.bonus * dur);
    const overflow = est > capacity() - S.flaschen && tal("autosell") < 1;
    const btn = document.createElement("button");
    btn.className = "mission-opt";
    if (overflow) btn.title = "Mehr als ins Gepäck passt – Überschuss verfällt! Erst verkaufen oder Stauraum kaufen.";
    btn.innerHTML = `<span class="m-name">${m.name}</span>
      <span class="m-time">⏱️ ${fmtDur(dur)}</span>
      <span class="m-yield${overflow ? " warn" : ""}">≈ ${fmtNum(est)} 🍾${overflow ? " ⚠️" : ""}</span>`;
    btn.onclick = () => startMission(i);
    wrap.appendChild(btn);
  });
}

function renderMissionState() {
  $("mission-idle").style.display = S.mission ? "none" : "block";
  $("mission-active").style.display = S.mission ? "block" : "none";
  if (S.mission) {
    $("mission-name").textContent = `${districtDef(S.district).emoji} ${S.mission.name}${tal("autotour") ? " 🔁" : ""}`;
    renderMissionLog();
  } else {
    renderMissionOptions();
  }
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
  const auto = tal("autosell") >= 1 ? " · 🤖 Auto-Verkauf aktiv" : "";
  const passive = kolonneRate() > 0 ? ` · 👥 +${fmtGeld(kolonneIncome())}/s` : "";
  $("sell-preview").textContent = (S.flaschen > 0
    ? `${fmtNum(S.flaschen)} Flaschen ≈ ${fmtGeld(S.flaschen * sellPrice())}`
    : "Gepäck ist leer.") + auto + passive;
  $("btn-sell").disabled = S.flaschen <= 0;
}

function renderQuests() {
  const wrap = $("quest-list");
  if (!S.quests) { wrap.innerHTML = ""; return; }
  wrap.innerHTML = S.quests.list.map(q => {
    const meta = QUEST_META[q.type];
    const pct = Math.min(100, (q.prog / q.target) * 100);
    return `<div class="quest ${q.done ? "done" : ""}">
      <span class="q-icon">${q.done ? "✅" : meta.icon}</span>
      <div class="q-info">
        <div class="q-txt">${meta.txt(q.target)}</div>
        <div class="progress-outer q-bar"><div class="progress-inner" style="width:${pct}%"></div></div>
      </div>
      <span class="q-reward">${q.done ? "🎁" : "+" + fmtGeld(q.reward)}</span>
    </div>`;
  }).join("");
}

function renderShop() {
  const wrap = $("shop-list");
  wrap.innerHTML = "";
  let affordable = false;
  for (const [key, item] of Object.entries(ITEMS)) {
    const lvl = S.items[key];
    const cost = itemCost(key, lvl);
    if (S.geld >= cost) affordable = true;
    const el = document.createElement("div");
    el.className = "shop-item";
    el.innerHTML = `<span class="s-emoji">${item.emoji}</span>
      <div class="s-info">
        <div class="s-name">${item.name}: ${itemStageName(key, lvl)}</div>
        <div class="s-desc">${item.desc}${key === "beutel" ? ` Aktuell: ${fmtNum(capacity())} Flaschen.` : ""}</div>
        <div class="s-level">Stufe ${lvl}</div>
      </div>
      <button class="s-buy" ${S.geld < cost ? "disabled" : ""}>
        ➜ ${itemStageName(key, lvl + 1)}<br>${fmtGeld(cost)}
      </button>`;
    el.querySelector(".s-buy").onclick = () => buyItem(key);
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
    const cost = skillCost(lvl);
    const time = skillTime(lvl);
    if (!S.training && S.geld >= cost) affordable = true;
    const el = document.createElement("div");
    el.className = "skill-item";
    el.innerHTML = `<span class="s-emoji">${sk.emoji}</span>
      <div class="s-info">
        <div class="s-name">${sk.name}</div>
        <div class="s-desc">${sk.desc}</div>
        <div class="s-level">Stufe ${lvl}</div>
      </div>
      <button class="s-buy" ${S.training || S.geld < cost ? "disabled" : ""}>
        ${fmtGeld(cost)}<br>⏱️ ${fmtDur(time)}
      </button>`;
    el.querySelector(".s-buy").onclick = () => startTraining(key);
    wrap.appendChild(el);
  }
  $("training-active").style.display = S.training ? "block" : "none";
  if (S.training) $("training-name").textContent = `${SKILLS[S.training.skill].emoji} ${SKILLS[S.training.skill].name} → Stufe ${S.skills[S.training.skill] + 1}`;
  renderTalents();
  const talentAffordable = S.respekt > 0 && Object.entries(TALENTS).some(([k, t]) => tal(k) < t.max && S.respekt >= t.cost(tal(k)));
  $("badge-skills").classList.toggle("on", affordable || talentAffordable);
}

function renderTalents() {
  const card = $("talent-card");
  const wrap = $("talent-list");
  if (S.respektEarned <= 0 && S.prestigeCount <= 0) {
    card.style.display = "block";
    $("talent-points").textContent = "";
    wrap.innerHTML = `<p class="hint">🔒 Ab Level 25 kannst du im Profil neu anfangen und bekommst <b>Respekt-Punkte</b> – hier gibst du sie für permanente Boni aus.</p>`;
    return;
  }
  card.style.display = "block";
  $("talent-points").textContent = `⭐ ${fmtNum(S.respekt)} Punkte verfügbar`;
  wrap.innerHTML = "";
  for (const [key, t] of Object.entries(TALENTS)) {
    const lvl = tal(key);
    const maxed = lvl >= t.max;
    const cost = maxed ? 0 : t.cost(lvl);
    const el = document.createElement("div");
    el.className = "skill-item";
    el.innerHTML = `<span class="s-emoji">${t.emoji}</span>
      <div class="s-info">
        <div class="s-name">${t.name}</div>
        <div class="s-desc">${t.desc}</div>
        <div class="s-level">Stufe ${lvl}${t.max !== Infinity ? "/" + t.max : ""}</div>
      </div>
      <button class="s-buy ${maxed ? "maxed" : ""}" ${maxed || S.respekt < cost ? "disabled" : ""}>
        ${maxed ? "MAX ✨" : "⭐ " + cost}
      </button>`;
    if (!maxed) el.querySelector(".s-buy").onclick = () => buyTalent(key);
    wrap.appendChild(el);
  }
}

function renderTrainingTick() {
  const t = S.training;
  if (!t) return;
  const elapsed = (Date.now() - t.start) / 1000;
  if (elapsed >= t.dauer) { completeTraining(); save(); return; }
  $("training-timer").textContent = fmtTime(t.dauer - elapsed);
  $("training-progress").style.width = Math.min(100, (elapsed / t.dauer) * 100) + "%";
}

function renderKolonne() {
  const locked = !kolonneUnlocked();
  $("kolonne-locked").style.display = locked ? "block" : "none";
  $("kolonne-main").style.display = locked ? "none" : "block";
  if (locked) {
    $("kolonne-lock-info").innerHTML = `Noch <b>${KOLONNE_UNLOCK_LVL - S.level} Level</b> – dann kennst du genug Leute auf der Straße.`;
    $("badge-kolonne").classList.remove("on");
    return;
  }
  $("kolonne-rate").textContent = fmtNum(kolonneRate() * 60) + " 🍾/min";
  $("kolonne-income").textContent = "+" + fmtGeld(kolonneIncome()) + "/s";

  const wrap = $("gen-list");
  wrap.innerHTML = "";
  let affordable = false;
  let shownTeaser = false;
  GENERATORS.forEach((g, i) => {
    const owned = gen(g.id);
    const visible = i === 0 || owned > 0 || gen(GENERATORS[i - 1].id) > 0;
    if (!visible) {
      if (!shownTeaser) {
        shownTeaser = true;
        const el = document.createElement("div");
        el.className = "shop-item gen-teaser";
        el.innerHTML = `<span class="s-emoji">❓</span><div class="s-info">
          <div class="s-name">???</div>
          <div class="s-desc">Kaufe zuerst: ${GENERATORS[i - 1].name}</div></div>`;
        wrap.appendChild(el);
      }
      return;
    }
    const n = buyAmount === "max" ? Math.max(1, genMaxBuy(g, owned, S.geld)) : buyAmount;
    const cost = genBulkCost(g, owned, n);
    const canBuy = S.geld >= cost && (buyAmount !== "max" || genMaxBuy(g, owned, S.geld) >= 1);
    if (S.geld >= genCost(g, owned)) affordable = true;
    const unitRate = genUnitRate(g, owned);
    const nextMilestone = (Math.floor(owned / GEN_MILESTONE) + 1) * GEN_MILESTONE;
    const el = document.createElement("div");
    el.className = "shop-item";
    el.innerHTML = `<span class="s-emoji">${g.emoji}</span>
      <div class="s-info">
        <div class="s-name">${g.name} <span class="gen-count">×${fmtNum(owned)}</span></div>
        <div class="s-desc">${g.desc}</div>
        <div class="s-level">${owned > 0 ? fmtNum(owned * unitRate * 60 * (1 + tal("fuehrung") * 0.25)) + " 🍾/min · " : ""}x2 bei ${fmtNum(nextMilestone)}</div>
      </div>
      <button class="s-buy" ${canBuy ? "" : "disabled"}>
        +${buyAmount === "max" ? fmtNum(n) : n}<br>${fmtGeld(cost)}
      </button>`;
    el.querySelector(".s-buy").onclick = () => buyGen(g.id);
    wrap.appendChild(el);
  });
  $("badge-kolonne").classList.toggle("on", affordable);
}

function renderProfil() {
  $("profil-title").textContent = title();
  const days = Math.max(1, Math.ceil((Date.now() - S.createdAt) / 86400000));
  const rows = [
    ["Level", S.level + " – " + title()],
    ["Respekt verdient", "⭐ " + fmtNum(S.respektEarned)],
    ["Neuanfänge", S.prestigeCount],
    ["Erfolgs-Bonus", "+" + achTierTotal() + " % auf alles"],
    ["Flaschen gesamt", fmtNum(S.totalFlaschen)],
    ["Einnahmen gesamt", fmtGeld(S.totalGeld)],
    ["Einnahmen dieser Lauf", fmtGeld(S.runGeld)],
    ["Kolonnen-Größe", fmtNum(totalGens(S))],
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
  let next = "";
  if (S.level >= 25) {
    const nextGeld = Math.pow(gain + 1, 2) * 1000;
    next = `<br><span class="hint">Nächster Punkt bei ${fmtGeld(nextGeld)} Lauf-Einnahmen.</span>`;
  }
  $("prestige-info").innerHTML = (S.level < 25
    ? `Noch <b>${25 - S.level} Level</b> bis zum Neuanfang.`
    : `Aktuell möglich: <b style="color:var(--gold)">+${fmtNum(gain)} Respekt</b>`) + next;
  $("btn-prestige").disabled = !ready;
}

function renderAchievements() {
  const wrap = $("achievement-list");
  wrap.innerHTML = "";
  // Endlose Serien mit Fortschritt zur nächsten Stufe
  for (const ser of SERIES) {
    const t = tier(ser.id);
    const v = ser.val(S);
    const next = ser.thr(t);
    const el = document.createElement("div");
    el.className = "ach done";
    el.innerHTML = `<span class="a-icon">${ser.icon}</span>
      <div style="flex:1"><div class="a-name">${ser.name} ${t > 0 ? roman(t) : "–"}</div>
      <div class="a-desc">${ser.unit}: ${fmtNum(v)} / ${fmtNum(next)} → Stufe ${roman(t + 1)} (+1 %)</div></div>`;
    wrap.appendChild(el);
  }
  // Einmalige Erfolge
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
  renderQuests();
  renderShop();
  renderSkills();
  renderKolonne();
  renderProfil();
  renderAchievements();
}

/* ---------------- Tabs ---------------- */

function switchTab(name) {
  activeTab = name;
  document.querySelectorAll(".tab-panel").forEach(p => p.style.display = "none");
  $("tab-" + name).style.display = "block";
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.toggle("active", b.dataset.tab === name));
  refreshActiveTab();
  if (name === "profil") $("badge-profil").classList.remove("on");
}

function refreshActiveTab() {
  if (activeTab === "sammeln") { renderDistricts(); renderMissionState(); renderQuests(); renderSellPreview(); }
  if (activeTab === "shop") renderShop();
  if (activeTab === "skills") renderSkills();
  if (activeTab === "kolonne") renderKolonne();
  if (activeTab === "profil") { renderProfil(); renderAchievements(); }
}

/* ---------------- Save / Load ---------------- */

function migrate(d) {
  if (!d.version || d.version < 2) {
    d.version = 2;
    d.respektEarned = d.respekt || 0;
    d.runGeld = d.totalGeld || 0;
    // alte einmalige Zahl-Erfolge sind jetzt endlose Serien
    if (d.achievements) {
      for (const k of ["f1", "f100", "f1k", "f10k", "f100k", "g100", "g1k", "g10k", "g100k", "lvl5", "lvl15", "lvl30"]) {
        delete d.achievements[k];
      }
    }
  }
  if (d.version < 3) {
    d.version = 3;
    d.energy = BALANCE.beg.energyMax; // Bettel-Energie ist neu → volle Leiste
  }
  return d;
}

function save() {
  S.lastSeen = Date.now();
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* voll/privat */ }
}

function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    const data = migrate(JSON.parse(raw));
    const def = defaultState();
    S = Object.assign(def, data);
    S.items = Object.assign(defaultState().items, data.items);
    S.skills = Object.assign(defaultState().skills, data.skills);
    S.streak = Object.assign(defaultState().streak, data.streak);
    S.generators = data.generators || {};
    S.talents = data.talents || {};
    S.achTiers = data.achTiers || {};
    checkSeries(true); // Serien-Stufen still nachziehen (auch nach Migration)
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
    const data = migrate(JSON.parse(decodeURIComponent(escape(atob(code.trim())))));
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
  genQuests();
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
  genTick();
}

let hiddenAt = 0;

function init() {
  load();
  applyOffline();
  checkDaily();
  renderAll();

  document.querySelectorAll(".tab-btn").forEach(b => b.onclick = () => switchTab(b.dataset.tab));
  $("btn-sell").onclick = () => sellAll(false);
  $("mission-abort").onclick = abortMission;
  $("btn-prestige").onclick = doPrestige;
  $("btn-export").onclick = exportSave;
  $("btn-import").onclick = importSave;
  $("btn-reset").onclick = resetSave;
  $("modal-close").onclick = () => $("modal-backdrop").style.display = "none";
  document.querySelectorAll("#buy-toggle button").forEach(b => b.onclick = () => {
    buyAmount = b.dataset.n === "max" ? "max" : parseInt(b.dataset.n, 10);
    document.querySelectorAll("#buy-toggle button").forEach(x => x.classList.toggle("active", x === b));
    renderKolonne();
  });

  $("beg-btn").addEventListener("pointerdown", e => { e.preventDefault(); beg(e); });

  setInterval(tick, 250);
  setInterval(updateKurs, 20000);
  setInterval(save, 5000);
  setInterval(refreshActiveTab, 1000);
  window.addEventListener("beforeunload", save);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { save(); hiddenAt = Date.now(); }
    else if (Date.now() - hiddenAt > 60000) { load(); applyOffline(); checkDaily(); renderAll(); }
  });

  // Debug-/Test-API (bewusst schlicht)
  window.PF = {
    state: () => S,
    balance: () => BALANCE,
    cheat(fn) { fn(S); renderAll(); },
    collect(n) { collectBottles(n); renderAll(); },
    forceEvent() { if (S.mission) { S.mission.lastEvent = 0; missionEventTick(); } },
  };
}

document.addEventListener("DOMContentLoaded", init);
