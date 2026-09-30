# Krok 13 — jeho TikTok: čo robí, ako to robí a čo z toho vie appka

**Zadanie (user):** „Pozeraj aj ďalej od neho na TikToku alebo nájdi od neho viac videí alebo postupov, ak má.“

**Výsledok:** stiahnutých a zmeraných **18 videí** (@ai_ktivista, 12× TikTok + 6× Instagram, spolu 714,6 s),
popísaných **5 formátov**, nájdený **jeho postup ukázaný priamo vo videu**, opravené **2 chyby merania**
a pridaný **15. recept** s reálnym exportom.

---

## 1. Odkiaľ dáta (a kde to nešlo)

| zdroj | čo sa podarilo | čo nie |
|---|---|---|
| Instagram `i.instagram.com/api/v1/...` | 9 videí z profilu + 3 staršie (krok 12) | `feed/user` po viacerých pokusoch vracia `Please wait a few minutes` — teda **katalóg 165 príspevkov sa celý stiahnuť nedá** |
| TikTok `www.tiktok.com/embed/@ai_ktivista` | **12 videí** s popismi a `playAddr` (55,5 MB) | `api/post/item_list` a mobilné API vracajú prázdno (bez `msToken`/podpisu); profil má **136 videí**, embed vystaví 12 |
| `youtube.com/feeds/videos.xml` | kanál `UCfnATxojdICWfa0MxZWjAwQ`, 3 videá (Mortal Kombat Slovakia, Fico vs Komár, dôchodcovia) | kanál je malý (3 videá vo feede) |
| Threads `threads.com/@ai_ktivista` | profil existuje (2,7 tis. sledujúcich) | obsah sa vykresľuje v JS — **texty sa získať nepodarilo** |
| Masterclass `aiktivista.sk/masterclass.html` | stránka existuje | **za prihlásením** (e-mail + heslo) → **obsah NOT ACCESSIBLE**, nečítal som ho |
| `aiktivista.sk` (sitemap) | 4 stránky, jeho postup nie je zverejnený ako text | — |

Klipy sú v `/home/user/referencie/` — **mimo repozitára**, na GitHub nešli a nikdy nepôjdu.

---

## 2. Päť formátov, ktoré naozaj robí (namerané, nie dohadované)

| formát | klip | trvanie | tempo | jas | sýtosť | dynamika | poznámka |
|---|---|---|---|---|---|---|---|
| **A) Retrogames skeč** | `7662872350953737495` | 35,3 s | 0,31/s | 118,1 | 37 % | 47,8 | 8-bit UI, kreslené postavičky, plochy `#F5F0EE` + `#182550` |
| **B) Titulky po jednom slove** | `7665741304122445078` | 45,5 s | 0,20/s | 142,8 | 14 % | 59,1 | rečník + vložené karty, **v snímke vždy len jedno slovo** |
| **C) Kľúčové popisky na záberoch** | `7309925373532294432` | 56,1 s | 0,25/s | 114,3 | 22 % | **107,6** | 394 500 videní, najvyššia dynamika z celého kontenta |
| **D) AI kinematografický záber** | `7678009554033970454` | 25,1 s | 0,00/s | 69,2 | 26 % | 25,0 | 0 rezov; ten istý klip je aj na IG |
| **E) Ukážka jeho postupu** | `7680609867467345174` | 22,2 s | 0,04/s | 113,8 | 18 % | 20,9 | **storyboard + červený rámik = výber časti záberu** |

### Jeho postup (to, čo sám ukazuje)

V klipe E je vidieť celý jeho pracovný krok: **hore hotové AI klipy, dole skicový storyboard**
a v ňom **červený rámik**, ktorý sa posúva medzi panelmi — čiže si najprv nakreslí zábery a potom
vyberá, ktorú časť záberu použiť. To je presne „frame selection“, ktoré appka vie (keyframy priblíženia),
len nie cez kreslený storyboard.

**Nepreháľam to:** z videa sa nedá zmerať, akú presne časť vyberá (nemám jeho projekt) — popisujem len
to, čo je v obraze vidieť.

---

## 3. Existujúci katalóg: 12 tiktokov (merané po opravách)

| klip | trvanie | tempo | záber | jas | kontrast | sýtosť | dynamika | svetlý spodok |
|---|---|---|---|---|---|---|---|---|
| `7690550368333499650` | 31,9 s | 0,06/s | 9,3 s | 116,7 | 54,0 | 41 % | 53,7 | 0,45 |
| `7278793134098648353` | 32,4 s | 0,34/s | 3,3 s | 52,4 | 46,0 | 38 % | 36,9 | 0,25 |
| `7659449820934884630` | 64,8 s | 0,76/s | 0,7 s | 76,4 | 50,0 | 37 % | 73,5 | 0,43 |
| `7662872350953737495` | 35,3 s | 0,31/s | 3,2 s | 118,1 | 56,1 | 37 % | 47,8 | 0,31 |
| `7689405350226775318` | 35,0 s | 0,03/s | 30,2 s | 65,0 | 47,8 | 37 % | 38,7 | 0,00 |
| `7658368348543012118` | 57,5 s | 0,10/s | 6,4 s | 120,0 | 58,5 | 31 % | 35,5 | 0,89 |
| `7685413335948397846` | 71,2 s | 0,21/s | 3,9 s | 83,7 | 55,8 | 28 % | 35,3 | 0,12 |
| `7678009554033970454` | 25,1 s | 0,00/s | 25,1 s | 69,2 | 56,2 | 26 % | 25,0 | 0,64 |
| `7309925373532294432` | 56,1 s | 0,25/s | 3,7 s | 114,3 | 68,4 | 22 % | 107,6 | 0,13 |
| `7673961257115979030` | 42,8 s | 0,26/s | 4,1 s | 162,8 | 55,8 | 19 % | 49,0 | 0,80 |
| `7680609867467345174` | 22,2 s | 0,04/s | 21,5 s | 113,8 | **98,3** | 18 % | 20,9 | 0,98 |
| `7665741304122445078` | 45,5 s | 0,20/s | 4,3 s | 142,8 | 54,1 | 14 % | 59,1 | 0,54 |

Súhrn (medián 12): **0,21 rezu/s · 4,17 s na záber · jas 114,0 · kontrast 55,8 · sýtosť 30 % ·
hustota hrán 0,029 · dynamika 43,2 · svetlý spodok v 5 z 12 videí**.
Žiadna farba sa neopakuje vo väčšine videí (rovnaké zistenie ako pri IG v kroku 12).

---

## 4. Dve chyby merania (našiel som ich na svojich vlastných číslach)

1. **Audio ako stopa `#0:0`, video až `#0:1`.** Jeho TikTok súbory majú zvuk prvý. Nástroj hľadal
   „Stream #0:0“, našiel zvukovú stopu bez rozmerov a vzorkoval **2×2 pixely**. Prvé čísla preto
   vyzerali, akoby jeho videá boli ploché: `kontrast 18,9 · dynamika 20,4 · svetlý spodok 0 %`.
   Po oprave: `kontrast 55,8 · dynamika 43,2 · svetlý spodok 42 %`.
2. **Zapečené čierne pruhy** (16:9 obraz v 9:16 ráme, napr. `crop=508:642:34:190`). Tie „nazbierali“
   čierne pixely a skreslili jas aj pásy. Teraz sa pruhy zmerajú (`cropdetect`) a **vyrežú** —
   meria sa len plocha obrazu; v reporte je vidieť, koľko percent rámu boli pruhy.

### Dôkaz, že meranie je odvtedy správne (cross-platform)

Tri klipy vyšli na oboch platformách, a **merajú sa takmer identicky** — to je nezávislá kontrola:

| klip | IG | TikTok |
|---|---|---|
| drak nad Bratislavou | jas 68,6 · kontrast 56,1 · dynamika 25,0 · spodok 0,64 | jas 69,2 · kontrast 56,2 · dynamika 25,0 · spodok 0,64 |
| hodinky 10:10 | jas 162,0 · dynamika 48,9 · spodok 0,80 | jas 162,8 · dynamika 49,0 · spodok 0,80 |
| storyboard | kontrast 95,8 · hrany 0,032 · spodok 0,95 | kontrast 98,3 · hrany 0,033 · spodok 0,98 |

Rozdiel do 1 % (TikTok verzia je o 0,1 s kratšia a má iné zakódovanie).

---

## 5. Nový recept `EDU_WORD_TALK` (15. v ponuke)

Z jeho najčastejšieho formátu — skupina 6 klipov, 297,2 s:

- **strihy 0,15/s · záber 5,35 s (medián)** → strih je výnimka, preto `fastZoom: false`, `whipPan: none`,
- **jas 115,5 · kontrast 55,0 · sýtosť 30 %** → čisté prostredie, žiadna textúra (`texture: clean`),
- **dynamika 46,2** → obraz menia vložené prvky, preto `motionPool: pop, slide, subtle_zoom`,
- **svetlý spodok len v 2 zo 6 klipov** → titulky nie sú vždy dole (v klipe s 0,00 nie sú vôbec),
- **`maxElementsPerScene: 1`** — v jeho snímkach je vždy len **jedno slovo** na obrazovke,
- **paleta `#FCF8FC · #110D11 · #FEC903 · #4A6C56`** — namerané „občasné“ farby; **žiadna nie je zdieľaná**.

### Čo recept priznáva (a test to stráži)

- **podiel rečníka** sa nemeria (bez detektora tvárí) — 60/40 je pracovný pomer, nie meranie,
- **krok slova** (`staggerMs`) nie je meranie — časovanie slov sa z videa nečíta,
- **jeho žltá `#FEC903`** prekročila prah palety (0,5 % plochy) len v **1 zo 6** klipov (11,9 % plochy);
  v ostatných je žltá v popiskoch vidieť, ale jej plocha je pod prahom merania,
- **AI appka negeneruje** ilustrácie ani video.

---

## 6. Reálny výsledok (nie test)

```
bun run tools/verify-canonical-export.ts /home/user/real-media/real_speech.mp4 \
  --plan /home/user/real-media/segments.json --recipe=EDU_WORD_TALK --animated-zoom \
  --out /home/user/export-krok13-edu-talk.mp4
```

**REAL EXPORT Z CANONICAL OSI: PASS** (`docs/real-export-krok13-output.txt`)
— 428 660 B, 1080×1920, 30 fps, priblíženie 100 → 145 % za 14,19 s, 3 obrazové vrstvy,
6 titulkov z canonical osi, zvuk bajtovo rovnaký ako zdroj.

### Overená medzera (server ju sám pomenoval)

> „Pri 6 titulkoch nemám časovanie slov, takže sa zvýrazňovanie slova vynechalo (text sa zobrazí celý naraz).“

Čiže **titulky po slovách sa ešte nevykresľujú**: canonical vrstva nesie len text vety, nie časovanie
slov. Recept to v `captionStyle.rationaleSk` priznáva („…overí real export, nie tento text“) a je to
ďalší krok, nie hotová vec.

---

## 7. Čo z jeho TikTokov appka (zatiaľ) nevie — a hovorím to rovno

| formát | stav | prečo |
|---|---|---|
| AI kinematografický záber | **recept + reálny export** (krok 12) | namerané, render zvládne |
| Edu talk slovo po slove | **recept + reálny export** (krok 13), titulky po slovách **NIE** | chýba časovanie slov v canonical vrstve |
| Kľúčové popisky na záberoch | čiastočne — existujúci štýl titulkov `KEYWORD_POP` | dynamika 107,6/s je z pohybu kamery, ktorú nevyrábame |
| Retrogames skeč | **len zmerané a popísané** | appka nemá pixelový filter ani 8-bitové UI prvky — **nevydávam to za recept, ktorý niečo vyrobí** |
| Storyboard + výber časti záberu | čiastočne — keyframy priblíženia | kreslený storyboard appka negeneruje |

---

## 8. Testy a reprodukcia

- `tests/referenceVideoStats.test.ts` — **52 testov** (pribudla skupina D: čítanie `ffmpeg` výpisu vrátane
  videa ako druhej stopy, `cropdetect`, vyrezanie pruhov, akcent z palety videa) a **skupina E**:
  7 testov na recept `EDU_WORD_TALK` (jedno slovo naraz, pokojné tempo, paleta ako občasná, uznané medzery).
- `tests/styleRecipes.test.ts` + `tests/styleStudioView.test.ts` — 14 → **15** receptov.
- Logy merania: `docs/reference-video-verify-output.txt` (IG) a `docs/reference-tiktok-verify-output.txt` (TikTok).
- Vizuálna ukážka: `/home/user/ukazka-krok13-tiktok.html`.

Meranie je deterministické — dva behy dali rovnaké čísla:

```
bun run tools/measure-reference-video.ts /home/user/referencie/tiktok-*.mp4 \
  --out /home/user/referencie/analyza-tiktok.json
```
