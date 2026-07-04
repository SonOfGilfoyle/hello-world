// Firebase-Konfiguration — HIER deine eigenen Werte eintragen.
//
// Anleitung (Schritt für Schritt) im README unter "Firebase einrichten".
// Kurzfassung: console.firebase.google.com → Projekt anlegen → Realtime
// Database aktivieren → Projektübersicht → Web-App hinzufügen → die dort
// angezeigte Config hier einfügen.
//
// Diese Werte sind KEINE Geheimnisse — sie identifizieren nur dein Projekt
// und dürfen öffentlich im Frontend stehen. Zugriffsschutz übernehmen die
// Datenbank-Regeln (database.rules.json).
//
// Solange hier die Platzhalter stehen, läuft das Tool im lokalen Modus
// (ein Gerät, kein Sync zwischen Handys).

export const firebaseConfig = {
  apiKey: "DEIN-API-KEY",
  authDomain: "DEIN-PROJEKT.firebaseapp.com",
  databaseURL: "https://DEIN-PROJEKT-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "DEIN-PROJEKT",
  storageBucket: "DEIN-PROJEKT.appspot.com",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:0000000000000000000000",
};
