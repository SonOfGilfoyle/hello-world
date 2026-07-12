# 🍾 PFANDLORD – Vom Penner zur Legende

Ein modernes Remake des Browser-Klassikers **Pennergame** – als **Endless-Idle-Game**.
Sammle Pfandflaschen, schnorr dich reich, bau eine Sammel-Kolonne auf und werde
vom Frischling zum **PFANDLORD**. Es gibt kein Ende: Alle Systeme skalieren
unendlich, und jeder Neuanfang macht dich dauerhaft stärker.

Komplett in Vanilla JS – keine Dependencies, kein Build-Schritt, kein Account.
Der Spielstand liegt im `localStorage` deines Browsers.

## 🎮 Features

- **Sammel-Touren** mit echten Timern (30 Sekunden bis 8 Stunden) – längere
  Touren bringen mehr Flaschen pro Minute, mit Zufalls-Events unterwegs
- **Sammel-Kolonne** 👥 – rekrutiere Kumpels, Bollerwagen-Crews, Drohnen, einen
  Recyclinghof, am Ende eine eigene Brauerei und die börsennotierte PFAND AG.
  Passives Einkommen rund um die Uhr, alle 25 Einheiten verdoppelt sich die Produktion
- **Pfandkurs-Börse** 📈 – der Flaschenpreis schwankt und wirkt auch aufs passive Einkommen
- **Schnorren** als Clicker-Minigame mit Energie-Leiste, Combo-Multiplikator
  und Crits – Burst-Einkommen, das mit dem passiven Einkommen mitwächst
- **Endlose Stadtteile** – nach den 6 handgemachten Revieren geht es prozedural
  weiter (Flughafen-Terminal, Banken-Distrikt, Mega-Festival …)
- **Endlose Ausrüstung & Skills** – keine Maximalstufen, Kosten wachsen exponentiell
- **Respekt-Talentbaum** ⭐ – Prestige ab Level 25 bringt Punkte für permanente
  Boni: Startkapital, Auto-Touren, Verkaufs-Bot, mehr Offline-Zeit …
- **Endlose Erfolgs-Serien** – jede Stufe gibt dauerhaft +1 % auf alles
- **Tagesaufgaben** 📋 und **Daily-Login-Streak** mit wachsenden Belohnungen
- **Offline-Fortschritt** – Kolonne, Touren (mit Dauerläufer-Talent) und
  Training laufen weiter, während du weg bist
- Big-Number-Support (Mio./Mrd./Bio. …), Dark Mode, Touch-optimiert,
  Vibrations-Feedback, Spielstand-Export/-Import

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
| `index.html`   | Markup & UI-Struktur            |
| `style.css`    | Dark-Theme, Mobile-first-Layout |
| `game.js`      | Spiellogik; alle Tuning-Werte zentral im `BALANCE`-Objekt |
| `BALANCING.md` | Design-Ziele, Nachrechnungen & Tuning-Checkliste |
| `main.py`      | Mini-Webserver zum Ausliefern   |
