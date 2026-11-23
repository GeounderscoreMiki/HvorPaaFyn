# Hvor på Fyn? – geocaching-spil

Spilleren får navnet på en tilfældig fynsk by og skal trykke på den rigtige kommune på kortet. 10 rigtige i træk (én i hver kommune), 3 liv, 1:30 pr. spørgsmål. Scoreboard gemmes i Firebase (Firestore).

## Opsætning
1. **Koordinat og byer:** Åbn `secret/spil.json`, skriv den rigtige koordinat i `finalCoordinate` og ret evt. byerne. Kør derefter `node build.mjs`, som laver `gamedata.js` (svar som hash, koordinat krypteret).
2. **Firebase:** `config.js` peger på det eksisterende Firebase-projekt, men bruger egne samlinger (`hpf_scores`, `hpf_stats`). Indsæt indholdet af `firestore.rules` under Firestore → Rules → Publish. Filen indeholder også de gamle regler uændret, så Fynsspil ikke påvirkes.
3. **GitHub Pages:** Opret et nyt repo, upload alt undtagen `secret/`, og slå Pages til (`main` / root).

## Test lokalt
`python3 -m http.server 8000` og åbn http://localhost:8000.

## Bemærk
Der er ingen server, så en erfaren programmør kan i teorien læse sig til koordinaten. Det stopper almindelig snyd, men er ikke 100 % sikkert.
