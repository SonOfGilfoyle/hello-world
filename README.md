# 🍾 PFANDLORD – Vom Penner zur Legende

Ein modernes Remake des Browser-Klassikers **Pennergame** – als **Endless-Idle-Game**.
Sammle Pfandflaschen, schnorr dich reich, bau eine Sammel-Kolonne auf und werde
vom Frischling zum **PFANDLORD**. Es gibt kein Ende: Alle Systeme skalieren
unendlich, und jeder Neuanfang macht dich dauerhaft stärker.

Komplett in Vanilla JS – keine Dependencies, kein Build-Schritt, kein Account.
Der Spielstand liegt im `localStorage` deines Browsers.

## 🎮 Features

- **Choreografiertes Onboarding** – kein Tutorial, eine Ouvertüre: Die ersten
  90 Sekunden spielen sich selbst frei (Flasche antippen → verkaufen → erste
  Tour), kein Text länger als eine Zeile
- **Progressive UI** – Tabs existieren erst, wenn ihr System freigeschaltet
  wird; die Oberfläche wächst mit dem Spieler und jede Freischaltung ist ein
  Belohnungsmoment
- **Sammel-Touren** mit echten Timern (30 Sekunden bis 8 Stunden) – längere
  Touren bringen mehr Flaschen pro Minute, mit ~80 handgeschriebenen
  Zufalls-Events unterwegs, davon je ein eigener Event-Pool pro Revier
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
- **Glücksfund** 🎁 – taucht unvorhersehbar auf und verschwindet schnell
  wieder (Variable-Ratio-Belohnung, skaliert mit deinem Einkommen)
- **Dein Avatar** – eine Figur im Profil, an der du deine komplette
  Ausrüstung siehst: vom Typ mit Plastiktüte zum Baron mit Königspudel
- **Sound & Juice** – synthetisierte Sound-Effekte (WebAudio, keine Assets,
  abschaltbar), Konfetti bei Meilensteinen, Geld-Roll-up, Crit-Flash,
  Pfandkurs-Sparkline; respektiert `prefers-reduced-motion`
- Big-Number-Support (Mio./Mrd./Bio. …), Dark Mode, Touch-optimiert,
  Vibrations-Feedback, Spielstand-Export/-Import

## 🚀 Starten

**Online spielen:** https://sonofgilfoyle.github.io/hello-world/
(GitHub Pages served diesen Branch – jeder Push deployed automatisch,
der Spielstand im Browser bleibt dabei erhalten.)

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
