// Sync-Schicht: gleiche Schnittstelle für Firebase (live, mehrere Geräte)
// und lokalen Betrieb (ein Gerät, localStorage). Die App spricht nur mit
// dieser Schnittstelle — so lässt sich das Backend austauschen und später
// z.B. der Foto-Assistent (Phase 2) andocken, ohne die UI umzubauen.
//
// Schnittstelle:
//   live                                  bool — synct über Geräte?
//   createSession() -> Promise<code>
//   sessionExists(code) -> Promise<bool>
//   join(code, playerId, name) -> Promise<void>   (Rejoin behält Level/Bonus)
//   subscribe(code, cb) -> unsubscribe            cb(sessionObjekt|null)
//   updatePlayer(code, playerId, fields)
//   removePlayer(code, playerId)
//   setCombat(code, combat|null)
//   setHelper(code, playerId, isHelping)

import { firebaseConfig } from "./firebase-config.js";

// Alphabet ohne verwechselbare Zeichen (0/O, 1/I/L)
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function makeCode(len = 5) {
  const rnd = new Uint32Array(len);
  crypto.getRandomValues(rnd);
  let code = "";
  for (let i = 0; i < len; i++) code += CODE_ALPHABET[rnd[i] % CODE_ALPHABET.length];
  return code;
}

function emulatorParam() {
  return new URLSearchParams(location.search).get("emu");
}

export function isLiveConfigured() {
  return emulatorParam() !== null || !firebaseConfig.apiKey.startsWith("DEIN-");
}

// ---------------------------------------------------------------- Firebase

export class FirebaseStore {
  live = true;

  async init() {
    const fb = await import("./vendor/firebase.js");
    this.fb = fb;
    const emu = emulatorParam();
    const cfg = emu
      ? { apiKey: "demo", projectId: "demo-munchkin", databaseURL: `http://${location.hostname}:9000?ns=demo-munchkin-default-rtdb` }
      : firebaseConfig;
    const app = fb.initializeApp(cfg);
    this.db = fb.getDatabase(app);
    if (emu) fb.connectDatabaseEmulator(this.db, location.hostname, 9000);
    return this;
  }

  ref(path) {
    return this.fb.ref(this.db, path);
  }

  async createSession() {
    // Kollision mit bestehender Runde ist bei 31^5 Codes praktisch
    // ausgeschlossen, wird aber trotzdem geprüft.
    for (let i = 0; i < 5; i++) {
      const code = makeCode();
      if (!(await this.sessionExists(code))) {
        await this.fb.set(this.ref(`sessions/${code}/createdAt`), this.fb.serverTimestamp());
        return code;
      }
    }
    throw new Error("Konnte keinen freien Code finden");
  }

  async sessionExists(code) {
    const snap = await this.fb.get(this.ref(`sessions/${code}/createdAt`));
    return snap.exists();
  }

  async join(code, playerId, name) {
    const playerRef = this.ref(`sessions/${code}/players/${playerId}`);
    const snap = await this.fb.get(playerRef);
    if (snap.exists()) {
      await this.fb.update(playerRef, { name, online: true });
    } else {
      await this.fb.set(playerRef, {
        name,
        level: 1,
        bonus: 0,
        online: true,
        joinedAt: this.fb.serverTimestamp(),
      });
    }
    // Bei Verbindungsabbruch serverseitig als offline markieren
    this.fb.onDisconnect(this.fb.child(playerRef, "online")).set(false);
  }

  subscribe(code, cb) {
    return this.fb.onValue(this.ref(`sessions/${code}`), (snap) => cb(snap.val()));
  }

  updatePlayer(code, playerId, fields) {
    this.fb.update(this.ref(`sessions/${code}/players/${playerId}`), fields);
  }

  removePlayer(code, playerId) {
    this.fb.remove(this.ref(`sessions/${code}/players/${playerId}`));
  }

  setCombat(code, combat) {
    const combatRef = this.ref(`sessions/${code}/combat`);
    if (combat === null) this.fb.remove(combatRef);
    else this.fb.set(combatRef, combat);
  }

  setHelper(code, playerId, isHelping) {
    const helperRef = this.ref(`sessions/${code}/combat/helpers/${playerId}`);
    if (isHelping) this.fb.set(helperRef, true);
    else this.fb.remove(helperRef);
  }

  setHelpRequest(code, playerId, isRequesting) {
    const reqRef = this.ref(`sessions/${code}/combat/helpRequests/${playerId}`);
    if (isRequesting) this.fb.set(reqRef, true);
    else this.fb.remove(reqRef);
  }
}

// ------------------------------------------------------------------ Lokal

const LOCAL_KEY = "munchkin.localSession";
export const LOCAL_CODE = "LOKAL";

export class LocalStore {
  live = false;

  async init() {
    this.listeners = new Set();
    // Multi-Tab auf demselben Gerät bleibt synchron
    window.addEventListener("storage", (e) => {
      if (e.key === LOCAL_KEY) this.notify();
    });
    return this;
  }

  read() {
    try {
      return JSON.parse(localStorage.getItem(LOCAL_KEY)) || null;
    } catch {
      return null;
    }
  }

  write(data) {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(data));
    this.notify();
  }

  mutate(fn) {
    const data = this.read() || { createdAt: Date.now(), players: {} };
    fn(data);
    this.write(data);
  }

  notify() {
    const data = this.read();
    for (const cb of this.listeners) cb(data);
  }

  async createSession() {
    this.write({ createdAt: Date.now(), players: {} });
    return LOCAL_CODE;
  }

  async sessionExists(code) {
    return code === LOCAL_CODE && this.read() !== null;
  }

  async join(code, playerId, name) {
    this.mutate((data) => {
      const existing = data.players[playerId];
      data.players[playerId] = existing
        ? { ...existing, name, online: true }
        : { name, level: 1, bonus: 0, online: true, joinedAt: Date.now() };
    });
  }

  subscribe(code, cb) {
    this.listeners.add(cb);
    cb(this.read());
    return () => this.listeners.delete(cb);
  }

  updatePlayer(code, playerId, fields) {
    this.mutate((data) => Object.assign(data.players[playerId], fields));
  }

  removePlayer(code, playerId) {
    this.mutate((data) => delete data.players[playerId]);
  }

  setCombat(code, combat) {
    this.mutate((data) => {
      if (combat === null) delete data.combat;
      else data.combat = combat;
    });
  }

  setHelper(code, playerId, isHelping) {
    this.mutate((data) => {
      if (!data.combat) return;
      data.combat.helpers = data.combat.helpers || {};
      if (isHelping) data.combat.helpers[playerId] = true;
      else delete data.combat.helpers[playerId];
    });
  }

  setHelpRequest(code, playerId, isRequesting) {
    this.mutate((data) => {
      if (!data.combat) return;
      data.combat.helpRequests = data.combat.helpRequests || {};
      if (isRequesting) data.combat.helpRequests[playerId] = true;
      else delete data.combat.helpRequests[playerId];
    });
  }
}

export async function createStore() {
  return isLiveConfigured() ? new FirebaseStore().init() : new LocalStore().init();
}
