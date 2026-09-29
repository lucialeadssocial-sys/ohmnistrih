# RETENTION SHORT — ako to funguje (F2)

Tento dokument vysvetľuje, čo presne sa stane, keď v kroku 3 klikneš
**„⚡ Postaviť strih"**. Je krátky zámerne — má sa dať prečítať do dvoch minút.

## 1. Vstup: tvoje schválené zásahy

Engine berie **iba to, čo si označila a potvrdila** („Použiť vybrané"). Nič si
nedomýšľa a nič nepridáva. Ak v tvojom výbere nie je žiadny `CUT` zásah, engine
to povie: klip by bol rovnako dlhý ako RAW (titulky, zoom či hudba strih neskracujú).

## 2. Postup (deterministický — rovnaký vstup dá vždy rovnaký strih)

1. **Vystrihnuté rozsahy** — z `CUT` zásahov. Prekrývajúce sa strihy sa spoja,
   aby sa čas neodpočítal dvakrát, a všetko sa oreže do dĺžky videa.
2. **Zachované úseky** — doplnok k vystrihnutým (od 0 do konca videa).
3. **Hook na začiatok (front-loading)** — nepresúva sa celý dlhý úsek
   (tým by sa hook nepredsunul). **Vyrezáva sa samotná hook veta** a ide na
   začiatok klipu. Toto je zmena poradia rozprávania, preto je vždy ohlásená
   s upozornením, aby si si prehrala prvých 5 sekúnd.
4. **Krátke zvyšky do 0,6 s sa zahodia** — inak klip trhá.
5. **Limit platformy** — čo sa nezmestí, odreže sa **z konca** (nie z prostriedku)
   a v zozname strihov uvidíš presne, o čo prišlo.
6. **Kontroly** — engine varuje, keď je niečo podozrivé.

## 3. Čo engine povie vždy (žiadne ticho)

| Stav | Príklad hlášky |
|---|---|
| Hook presunutý | „Vyrezal som hook z 68,0 s a dal ho na začiatok klipu (4,0 s)." + rada overiť súvislosť |
| Priveľa vystrihnuté | „Strih odstráni 77 % videa." + rada skontrolovať, či pointy zostali celé |
| Klip pod minimom | „Výsledný klip má 6,0 s — pod minimom pre Instagram Reels (7 s)." |
| Odrezané kvôli limitu | „Kvôli limitu Reels som odrezal 2 úseky z konca (203,5 s)." |
| Plán nič nestrihá | „Plán v tomto behu nič nestrihá — klip by bol rovnako dlhý ako RAW." |
| Časy sú odhad | „Časy v strihu sú odhad (plán nie je kotvený na prepis)." |
| Hook vo vystrihnutom úseku | „Hook leží vo vystrihnutom úseku — plán si navzájom odporuje." (STOP) |

## 4. Náhľad bez renderovania

Tlačidlo **„Prehrať náhľad klipu"** zapne preskakovanie: kedykoľvek sa prehrávanie
dostane do vystrihnutého úseku, skočí na jeho koniec. Vidíš teda **presne to, čo
by vzniklo** — okamžite, bez jedinej sekundy renderu a bez čakania.

## 5. EDL (edit decision list)

Tlačidlo **„EDL (JSON)"** stiahne zoznam:

```
{ platform, totalDurationSec, segments: [{ sourceStart, sourceEnd, timelineStart, duration }],
  removedRanges: [{ start, end, label, reason }], warnings: [...] }
```

EDL je most k renderu: tie isté čísla sa dajú vložiť ako klipy do timeline
(Mediabunny render) alebo odovzdať do DaVinci / Premiere. Je to len zoznam čísel —
dá sa prečítať a skontrolovať očami.

## 6. Testy (`bun test tests/retentionEngine.test.ts`)

23 testov: spájanie rozsahov, doplnok, presun hooku, krátke zvyšky, limit platformy,
orezanie mimo dĺžky videa, prekrývajúce sa strihy, determinizmus, varovania,
prehrávanie náhľadu a slovenské skloňovanie v textoch.

## 7. Čo ešte nie je hotové (poctivo)

- **Render do súboru** zatiaľ beží cez existujúce Export centrum, ktoré renderuje
  core timeline. EDL je na to pripravené (klipy s časmi), ale samotné napojenie
  EDL → timeline → MP4 je ďalší krok (F2b).
- **Word-level časovanie** z prepisu: dnes sa časy viet odhadujú podľa dĺžky textu.
  So skutočným časovaním slov budú strihy presné na desatinu sekundy.
