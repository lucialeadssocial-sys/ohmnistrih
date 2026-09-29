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

## 6. Testy

- `bun test tests/retentionEngine.test.ts` — 23 testov: spájanie rozsahov, doplnok,
  presun hooku, krátke zvyšky, limit platformy, orezanie mimo dĺžky videa,
  prekrývajúce sa strihy, determinizmus, varovania, prehrávanie náhľadu a slovenské
  skloňovanie v textoch.
- `bun test tests/smartCutRenderer.test.ts` — 17 testov, ktoré naozaj **vygenerujú
  video cez ffmpeg a overia výsledok** (streamy, dĺžku, dekódovanie bez chýb,
  poradie hooku, rýchlosť, zrušenie, 6 úsekov v rade, ochranu pri zlom EDL).
  Bez ffmpeg v prostredí sa korektne preskočia, nezlyhnú.

## 7. Render klipu do súboru (F2b)

Za tlačidlom **„Vyrenderovať klip"** nie je žiadny cloud ani prekódovanie. Klip sa
skladá **kopírovaním packetov** z tvojho videa (Mediabunny) — obraz aj zvuk zostávajú
bit po bite tie isté ako v zdroji, takže **žiadna strata kvality** a render je
rádovo rýchlejší než reálny čas (25 s klip ≈ 0,1 s práce).

Ako to funguje:

1. **Video** — každý úsek začína **kľúčovým snímkom**. Ak plán určil rez doprostred
   GOP, úsek sa posadí na najbližší predchádzajúci kľúčový snímok. Toto posadenie
   sa **vždy prizná** — v zhrnutí aj v zozname upozornení („najviac o 0,50 s skôr
   — cena za neprekódovanie“). Nikdy sa nekoná potichu.
2. **Zvuk** — kopíruje sa presne podľa plánu; posadenie obrazu na kľúčový snímok
   sa preto vždy hlási aj zvlášť (zvuk a obraz by inak mohli o kúsok „cestovať“).
3. **Výstupný čas sa riadi realitou, nie plánom** — kurzor sa posúva podľa toho,
   čo sa naozaj zapísalo. Vďaka tomu sa segmenty nikdy neprekryjú a súbor sa
   nezrúti ani pri mnohých krátkych rezoch za sebou.
4. **Kontajner** — podľa kodekov: H.264/H.265/AV1/VP9 + AAC/Opus/MP3/FLAC → **MP4**,
   inak **WebM** (radšej bezpečnejšie, než nefunkčný súbor).
5. **Zlé EDL sa odmietne s dôvodom** — úseky mimo dĺžky videa sa preskočia
   s upozornením; ak je mimo celý EDL, appka napíše, že plán patrí k inému videu
   (radšej jasná chyba než prázdny súbor).
6. **Zastaviť sa dá kedykoľvek** — render sa preruší a nič sa neuloží.

Bez re-encodu sa **nedajú** robiť tieto veci: presný rez na stotinu sekundy bez
posunu, zmena rozlíšenia/framerate, prechody a titulky pripečené do obrazu.
Tie patria do budúceho kroku (nadstavba nad FFmpeg/WebCodecs), nie do tohto.

## 8. Word-level časovanie (krok A) — presnosť na slová

Toto je odpoveď na to, čo v sekcii 8 stálo ako najväčšia nepresnosť: *„dnes sa časy
viet odhadujú podľa dĺžky textu"*. Odteraz to platí len vtedy, keď presnejšie údaje
nemáme.

**Odkiaľ sa berú presné časy:** automatické titulky (`Titulky → Automatické titulky`)
už od Gemini dostávajú **časovanie po slovách** (každé slovo má vlastný začiatok a koniec).
Doteraz sa tieto dáta použili len na titulky — do plánu a do strihu išiel holý text.
Teraz sa posielajú ďalej.

**Čo sa s nimi robí:**

1. **Plán** kotví vety na skutočné sekundy (nie na odhad) a v odpovedi to prizná:
   `timingPrecision: "words"`, `wordCount: počet slov`. AI navyše dostane zoznam viet
   s presnými časmi a inštrukciu strihať v pauzách — nie „od oka".
2. **Strih** sa prichytáva na **hranice slov**: začiatok strihu ide na koniec slova,
   ktoré by inak ostalo prerezané, koniec na koniec prerezaného slova. Nikdy sa
   nepretne slovo v polovici.
3. **Pauzy** (medzery medzi slovami) sú najlepšie miesta na strih — strih v pauze
   divák nepočuje. Ak je na výber medzi hranicou v pauze a tesnou hranicou,
   vyhráva pauza (do 0,25 s rozdielu).
4. **Každý posun je hlásený** v desatinách sekundy, s tým, čo sa na hranici
   nachádza: *„Strih 1: začiatok som posunul o 0.20 s skôr (pauza 2.50 s) — aby sa
   slovo nepretlo."* Posun väčší ako 0,6 s sa radšej **nepoužije** (nič neprekvapí).

**Poctivé mantinely:**

- Keď titulky nemáš, strih funguje ako doteraz a panel to **napíše**:
  „Časy sú odhad z dĺžky textu" + návod, ako získať presné.
- Keď máš menej než 3 slová, presné časovanie sa nepredstiera.
- Server berie word-level dáta len po sanitizácii (čísla, limity 500 segmentov /
  60 slov na segment) — poškodená položka posunie strih maximálne tak, že sa zahodí.

**Konkrétny príklad z ostrého behu** (30 s video, 21 slov, 4 pauzy):

| | bez časovania slov | s časovaním slov |
|---|---|---|
| strih 1 | 4,20 – 6,10 | **4,00 – 6,50** (do púaz) |
| strih 2 | 9,30 – 11,15 | **9,10 – 11,15** |
| hlásenia | — | 3 posuny, najviac 0,40 s |

## 8. Čo ešte nie je hotové (poctivo)

- **Word-level časovanie** z prepisu: dnes sa časy viet odhadujú podľa dĺžky textu.
  So skutočným časovaním slov budú strihy presné na desatinu sekundy.
- **Render s efektmi** (titulky, zoom, prechody zapečené do obrazu) — to už
  vyžaduje prekódovanie; naplánované ako ďalší krok nad FFmpeg.
- **Presné strihy bez posunu na kľúčový snímok** (smart-render cez FFmpeg s
  re-encodom len prvého GOP) — dnes je posun vždy priznaný, nie skrytý.
