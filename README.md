# 🍾 PFANDLORD – Vom Penner zur Legende

Ein modernes Remake des Browser-Klassikers **Pennergame** – als schnelles,
mobile-first Idle-Game. Sammle Pfandflaschen, schnorr dich reich, bau dein
Equipment aus und werde vom Frischling zum **PFANDLORD**.

Komplett in Vanilla JS – keine Dependencies, kein Build-Schritt, kein Account.
Der Spielstand liegt im `localStorage` deines Browsers.

## 🎮 Features

- **Sammel-Touren** mit echten Timern (30 Sekunden bis 8 Stunden) – längere
  Touren bringen mehr Flaschen pro Minute
- **Pfandkurs-Börse** 📈 – der Flaschenpreis schwankt, verkauf zum richtigen Zeitpunkt
- **Schnorren** als Clicker-Minigame mit Combo-Multiplikator und Crits
- **6 Stadtteile** von der Vorstadt bis zur Festwiese (bis zu 9× Ausbeute)
- **Ausrüstung**: Einkaufswagen, Hund, Magnet-Angel, E-Scooter, Tiny House …
- **Weiterbildung**: 4 Skills mit Echtzeit-Training (läuft auch offline weiter)
- **Offline-Fortschritt** – dein Charakter sammelt weiter, während du weg bist
- **Daily-Login-Streak** mit wachsenden Belohnungen
- **18 Erfolge** und ein **Prestige-System** („Respekt“) für Langzeitmotivation
- Dark Mode, Touch-optimiert, Vibrations-Feedback, Spielstand-Export/-Import

## 🚀 Starten

**Direkt im Browser:** einfach `index.html` öffnen.

**Mit Python:**
```bash
python main.py
# → http://localhost:8000
```

**Mit Docker:**
```bash
docker compose up --build
# → http://localhost:8000
```

## 🗂️ Struktur

| Datei        | Inhalt                          |
| ------------ | ------------------------------- |
| `index.html` | Markup & UI-Struktur            |
| `style.css`  | Dark-Theme, Mobile-first-Layout |
| `game.js`    | Komplette Spiellogik            |
| `main.py`    | Mini-Webserver zum Ausliefern   |
