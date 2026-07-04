# ⚔️ Munchkin Stärke-Tracker

Ein kleines Web-Tool für den Spieltisch: Jeder Spieler trackt auf seinem Handy
**Level + Bonus = Stärke**, alle sehen die Werte der anderen **live** — ohne
Reload, ohne App-Installation. Das Tool nimmt das nervige Zählen und Rechnen
ab; gespielt wird weiter auf dem Brett.

## Features

- **Runden per Code, Link oder QR-Code beitreten** — Name einmal eingeben, fertig
- **Live-Sync**: Level-/Bonus-Änderungen erscheinen sofort bei allen Mitspielern
- **Kampf-Rechner** (optional): Monster-Stärke einstellen, Mitstreiter antippen,
  Einmal-Boni dazu → zeigt live „Gewinnt / Verliert / Gleichstand (nur Krieger
  gewinnen)". Alle am Tisch sehen den Kampf mit. „Sieg" gibt automatisch +1 Level.
- **Regel-Automatik ohne Eingaben**: Level klemmt bei 1 und 10, Hinweis auf
  „Level 10 nur durch Monster-Kill", Sieg-Banner, 👑 für die Führenden,
  „💀 Gestorben"-Knopf (Level bleibt, Boni weg), Weglauf-Hinweis bei Niederlage
- **Bildschirm bleibt an** (Wake Lock), solange die Runde offen ist
- **Offline-Modus**: Ohne Firebase-Setup läuft alles auf einem Gerät
  (Handy herumreichen) — gut zum Ausprobieren

## Einrichtung

Das Tool ist eine rein statische Website plus [Firebase Realtime Database]
(kostenloser Spark-Plan) für den Live-Sync. Es gibt keinen Build-Schritt und
keinen eigenen Server.

### 1. Firebase einrichten (~5 Minuten, kostenlos)

1. Auf <https://console.firebase.google.com> ein neues Projekt anlegen
   (Google Analytics kann man deaktivieren).
2. Im Menü links **Build → Realtime Database** → **Datenbank erstellen**
   (Standort z.B. `europe-west1`, Modus egal — die Regeln kommen gleich).
3. Im Tab **Regeln** den kompletten Inhalt von [`database.rules.json`](database.rules.json)
   einfügen und **veröffentlichen**.
4. Zurück in der **Projektübersicht** (Zahnrad → Projekteinstellungen):
   unter „Meine Apps" eine **Web-App** (`</>`-Symbol) hinzufügen.
   Firebase zeigt dann ein `firebaseConfig`-Objekt an.
5. Diese Werte in [`js/firebase-config.js`](js/firebase-config.js) eintragen
   (die Platzhalter ersetzen). Wichtig: `databaseURL` muss dabei sein — sie
   steht auch oben in der Realtime-Database-Ansicht.

> Die Config-Werte sind keine Geheimnisse und dürfen öffentlich im Repo
> stehen. Den Zugriff regeln die Datenbank-Regeln aus Schritt 3.

### 2. Hosten (kostenlos)

**GitHub Pages** (empfohlen, direkt aus diesem Repo):
Repo-**Settings → Pages → Source: Deploy from a branch**, Branch und `/ (root)`
wählen, speichern. Nach ~1 Minute läuft das Tool unter
`https://<user>.github.io/<repo>/`.

**Vercel** geht genauso: Repo importieren, Framework „Other", keine
Build-Einstellungen nötig. (Hinweis: Der Live-Sync läuft über Firebase, nicht
über Vercel — Vercels Free-Tier kann keine dauerhaften Verbindungen halten.)

### Lokal ausprobieren

```bash
python3 -m http.server 8080
# → http://localhost:8080  (ohne Firebase-Config im Ein-Gerät-Modus)
```

## Technik

- Statisches HTML/CSS/JS (ES Modules), kein Build-Schritt, kein Framework
- `js/store.js`: Sync-Abstraktion — Firebase-Backend oder lokaler
  Ein-Gerät-Modus hinter derselben Schnittstelle
- `js/vendor/firebase.js`: gebündelter Firebase-SDK-Build (v12, Apache-2.0),
  damit die Seite ohne CDN-Abhängigkeit läuft
- `js/vendor/qrcode.js`: QR-Code-Generator von Kazuhiko Arase (MIT)
- `database.rules.json`: Validierung + Zugriffsregeln der Realtime Database.
  Runden sind nur über ihren zufälligen 5-Zeichen-Code erreichbar; die
  Session-Liste ist nicht auslesbar.

### Datenmodell

```
sessions/{CODE}
  createdAt
  players/{playerId}: { name, level (1–10), bonus, online, joinedAt }
  combat: { fighterId, monster, oneShot, helpers{}, startedAt }   # nur im Kampf
```

## Geplant (Phase 2)

Foto-Assistent: Foto der ausliegenden Karten → eine Vision-KI (Claude API)
liest die Karten und **schlägt** den Gesamt-Bonus vor, der Spieler bestätigt.
Braucht eine kleine Serverless-Function (der API-Key darf nicht ins Frontend);
Datenmodell und Sync-Schicht sind dafür schon vorbereitet.

[Firebase Realtime Database]: https://firebase.google.com/docs/database
