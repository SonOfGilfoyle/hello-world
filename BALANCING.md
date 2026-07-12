# ⚖️ PFANDLORD – Balancing

Alle Tuning-Konstanten leben zentral im `BALANCE`-Objekt am Anfang von
`game.js`. Die Daten-Tabellen direkt darunter (`ITEMS`, `GENERATORS`,
`DISTRICTS`, `TALENTS`) sind der zweite Teil der Konfiguration: Basiskosten,
Raten und Multiplikatoren pro Eintrag. Formeln lesen ausschließlich von dort –
wer balanciert, muss keine Spiellogik anfassen.

**Achtung:** Einige UI-Texte (Item-/Skill-/Talent-Beschreibungen) nennen
Prozentwerte im Klartext. Wer `BALANCE` ändert, passt die Texte mit an.

## Rollen der Mechaniken

Jede Einkommensquelle hat eine Rolle. Balance-Änderungen müssen diese Rollen
erhalten – nicht die absolute Höhe, sondern die *Verhältnisse* zählen:

| Mechanik   | Rolle                                   | Soll-Verhältnis |
| ---------- | --------------------------------------- | --------------- |
| Betteln    | Einstieg + Burst für aktive Minuten     | Dauerschnitt ≈ Tour-Einkommen, nie mehr |
| Touren     | Aktives Kern-Gameplay, **beste XP-Quelle** | Bester €/min-Wert der *aktiven* Spielzeit früh; XP/min immer über Kolonne bei gleichem Ausbaustand |
| Kolonne    | Der Geld-Motor (Idle)                   | Überholt Touren beim Geld ab ~Level 5–10 und zieht exponentiell davon – gewollt |
| Verkaufen  | Timing-Minispiel (Kurs ±50 %)           | – |
| Daily/Quests | Retention                             | Daily ≈ 5 min passives Einkommen, Quest ≈ 10 min |

## Warum Betteln eine Energie-Leiste hat

Ohne Limit war Betteln ~25× lukrativer als Touren (Level 10: ~130 €/min vs.
~5 €/min), weil sich drei Faktoren multiplizierten: unbegrenzte Tap-Rate ×
Combo x3 × Crit-Erwartungswert ~2. Ein Autoclicker hätte das trivial
ausgenutzt.

Der Fix hat zwei Teile:

1. **Energie** (`BALANCE.beg.energyMax` = 100 Tipps, Regeneration
   `regenPerSec` = 0,5/s → volle Leiste ≈ 3,3 min). Betteln wird Burst:
   volle Leiste bei Level 10 ≈ 26 €, danach warten → **Ø ≈ 7 €/min**, auf
   Augenhöhe mit Touren.
2. **Skalierung umgehängt**: Statt `0,006 × Level` (wuchs unbegrenzt linear
   mit) gibt es jetzt `0,002 × Level` plus **1 % des Kolonnen-€/s pro Tipp**
   (`passiveShare`, Cookie-Clicker-Prinzip). Betteln fühlt sich dadurch immer
   lohnend an, ist aber strukturell an das passive Einkommen gekoppelt und
   kann es nie überholen (Burst-Maximum ≈ 24 % des passiven Einkommens
   obendrauf, energielimitiert).

## Nachgerechnete Befunde & Fixes (Stand v3)

| Befund | Zahlen | Fix |
| ------ | ------ | --- |
| Betteln 25× über Touren | s. o. | Energie-System + Passiv-Kopplung |
| Kolonne dominierte auch **XP** | Phase 3: 1.260 XP/min passiv vs. 110 XP/min aktiv | `kolonne.xpPerBottle` 0,05 → 0,005; Touren bleiben der XP-Motor |
| Erster Kumpel machte Touren sofort obsolet | 4,5 €/min für 25 € (Payback 5,6 min) vs. Tour 1,5 €/min | Kumpel-Rate 0,3 → 0,2 F/s (Payback ~8 min, Tour bleibt anfangs konkurrenzfähig) |
| Lange Touren ohne Mega-Beutel sinnlos | 8h-Expedition bräuchte Beutel-Stufe 17 (~48 Mio. €), Überschuss verfiel stumm | Kapazität wächst 1,5 → 1,6, Beutel-Kosten 2,4 → 2,2; ⚠️-Warnung an Tour-Optionen; Verkaufs-Bot verwertet Überschuss statt ihn zu verwerfen |
| Daily-Bonus wurde wertlos | Phase 3: 88 € = 1 s Kolonnen-Einkommen | Daily = Basis + 5 min passives Einkommen (skaliert mit Streak) |

## Die zwei geometrischen Kurven

Das Endless-Design lebt vom Wettrennen zweier Exponentialkurven:

- **Kosten** wachsen geometrisch (Items ×2,2–2,7/Stufe, Skills ×1,7,
  Kolonne ×1,15/Einheit) bei linearem Nutzen → Fortschritt wird zäh
  (Soft-Wall), endet aber nie.
- **Einkommen** wächst ebenfalls geometrisch (Kolonnen-Stufen ×6–8,
  Meilensteine ×2 alle 25, Prestige-Multiplikatoren) → nach jedem Neuanfang
  fühlen sich zähe Upgrades wieder schnell an.

Faustregeln beim Tuning:

- Kleine Wachstumsfaktoren (Kolonne 1,15) = viele häufige Käufe.
  Große (Items ~2,5) = seltene Meilenstein-Käufe. Mischung ist Absicht.
- `prestigeGain = √(runGeld/1000)`: Da runGeld exponentiell wächst, kommt
  jeder Lauf messbar weiter – Kern-Motivation fürs Prestigen.
- Skill-Trainingszeiten (×1,38/Stufe) sind die Zeit-Soft-Wall:
  Stufe 15 ≈ 1,4 h, Stufe 20 ≈ 7 h (Lehrmeister-Talent bis −65 %).

## Tuning-Checkliste

Nach jeder `BALANCE`-Änderung prüfen:

1. Betteln-Ø (volle Leiste ÷ Regenerationszyklus) ≤ Tour-€/min derselben Phase?
2. Tour-XP/min > Kolonnen-XP/min bei gleichem Ausbaustand?
3. Payback des ersten Generators ≥ ~8 min?
4. Passt der Ertrag der längsten Tour in eine *erreichbare* Beutel-Stufe
   derselben Phase (Kostenfaktor ≤ ~10× Tour-Ertrag)?
5. Daily + 3 Quests zusammen ≈ 30–60 min Einkommen der aktuellen Phase?
