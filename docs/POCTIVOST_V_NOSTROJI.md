# POCTIVOSŤ V NÁSTROJI (krok 29 — honesty fix)

> **Prečo tento dokument existuje:** výskumný report `docs/CREATIVE_DIRECTOR_INTELLIGENCE_REPORT.md`
> našiel v OmniStrihu miesta, kde appka **tvrdila veci, ktoré nemala zmerané** — a jedno z nich
> dokonca ukazovalo „PASS“ bez merania. Zadanie hovorí jasne: žiadne fake analysis, žiadne
> fake scores, chýbajúce dáta = `NOT VERIFIED`. Tento krok to napravil.

---

## 1. Čo bolo vymyslené (nájdené v kóde, s dôkazom)

| # | Kde | Čo to tvrdilo | Prečo to bola nepravda |
|---|---|---|---|
| 1 | `QualityControlAndAnalytics.tsx` (pôvodná verzia) | „SPUSTIŤ STRESS TEST“ → **všetky kontroly na PASS**, odôvodnenie „STRESS TEST VERIFIED: Plne vyhovuje…“ | Nič sa nemeralo; status sa nastavil na PASS priamo v kóde |
| 2 | ten istý panel | „Reálny WebM bitstream bol overený“ + kontajner, kodeky, 742 s, 154,8 MB, 1080×1920, VP9 | Hodnoty boli pevne napísané v kóde; žiadny súbor sa nečítal |
| 3 | ten istý panel | „-14 LUFS, peak -0,1 dBFS, redukcia šumu -18 dB, ducking -15 dB“ | Žiadne meranie zvuku neexistuje |
| 4 | ten istý panel | 10 „extrahovaných snímok“ s časmi (00:04.12, 08:14.22…) a 9 „fyzických prvkov“ | Pevné zoznamy, žiadne snímky z videa |
| 5 | ten istý panel | „USER LOCK CHECK: seg_user_02 — Úspešne uzamknuté (0 zmien)“ | Vymyslené segmenty; v projekte neexistujú |
| 6 | ten istý panel | „Reach Multiplier 5.8x“ (Content Graph), „Hook Score: 98 %“ | Vymyslené čísla |
| 7 | `RetentionSimulator.tsx` | „AI nesimuluje náhodu“ + krivka retencie a skóre 96/45/20/92/35 % | Krivka sa kreslila cez `Math.random()`; skóre bolo pevné v `App.tsx` |
| 8 | `App.tsx` (retencia) | 5 hotových segmentov so skóre a text „AI simuluje správanie diváka“ | Žiadny divák sa nemeral |
| 9 | `App.tsx` (A/B) | „estimatedRetention 94/82/88 %“ + „AI branching your edit“ | Žiadne dáta o divákoch; žiadne varianty sa nevytvárali |
| 10 | `App.tsx` (Content Pack) | 5 klipov s „viralityScore 98/92/89 %“ a vymyslenými hookmi + hotové popisy | Žiadny výber momentov neexistuje |
| 11 | `App.tsx` (OpusStudio) | „overallScore 92, hookScore 90…“ a hashtagy | Vymyslené |
| 12 | `App.tsx` (multi-export) | simulácia `Math.random()` → „✅ Všetky verzie boli úspešne vygenerované!“ + signál `export_finished` | **Export sa nikdy nespustil**; signál klamal sprievodcu |
| 13 | `ContentGraphStudio.tsx` | 3 artefakty (YouTube Master 742 s, „hookStrengthScore: 94“, vymyslený titulok a kapitoly) | Neboli z používateľovho videa |
| 14 | `directorEngine.generateDirectorPlan` | pauza „4,2–5,8 s“ (0,95), hook „0–3 s“ (0,94), J-cut „12,0 s“ (0,98), titulky/ducking/farba 0–15 s, `confidence: 0.92`, `createdAt: Date.now()` | Fallbacky sa vydávali za znalosť; plán nebol deterministický |
| 15 | `knowledgeBase.CREATIVE_PATTERNS_DB` | 2 vzory s confidence 0,91/0,94 a zdrojom „OmniStrih SK Content Intelligence Data 2026“ | Taký dataset neexistuje; `observedAt: Date.now()` = nedeterminizmus |

---

## 2. Čo je namiesto toho (a odkiaľ to vie)

### 2.1 Nový merací modul `src/core/qc/qcMeasure.ts`
Deterministicky meria **len canonical časovú os** (`coreEngine.getProject()`):
klipy podľa typov stôp, dĺžka osi, strihy, medián/priemer záberu, zábery pod 1,5 s,
strihov/min, **hustota strihu pozdĺž osi** (12 úsekov), kolízie na tej istej stope,
prechody, titulky (počet, texty, najdlhšia medzera, prekrytia), zvuk (stopy, stlmené klipy),
prepis (vety, slová s časmi, najdlhšia medzera medzi slovami), formát/fps z použitých médií,
chýbajúce médiá. Žiadny `Date.now()`, žiadny `Math.random()`, žiadne odhady.

`verdictForCheck(checkId, measurement)` vracia verdikt pre každú z 25 kontrol:
* **PASS/WARNING/REVIEW/FAIL** — len ak je `evidenceSource: "measured"` a dôkaz je číslo z osi,
* **NOT_VERIFIED** — pre všetko ostatné, s dôvodom, *prečo* meranie nie je (napr. hlasitosť, zámery kamery,
  emocionálny oblúk, čistota záberov, relevancia B-rollu).

### 2.2 QC panel (`QualityControlAndAnalytics.tsx`) — prepísaný
* Zobrazuje **namerané hodnoty** + tabuľku 25 kontrol s filtrami.
* Tlačidlo **ZMERAŤ ZNOVA** spustí reálne meranie (predtým „SPUSTIŤ STRESS TEST“).
* Sekcia **„Čo tento panel NEOVERUJE“** vymenúva, čo sa nemeria, a odkazuje na dôkazové nástroje
  (`tools/verify-*.ts`) — tie pracujú s reálnym videom.
* Žiadny auto-fix, žiadne zapisovanie PASS. Panel **nemení** canonical stav.

### 2.3 Retenčný prehľad (`RetentionSimulator.tsx`) — prepísaný
* Ukazuje **nameranú hustotu strihu** a úseky (husté/normálne/riedke/bez strihu) s počtom strihov.
* Text priamo hovorí: *„Predpoveď retencie diváka OmniStrih NEMÁ.“*
* Žiadne `Math.random()`, žiadne percentá, žiadne „+15 %“ odporúčania.

### 2.4 Director (`directorEngine.generateDirectorPlan`) — prepísaný
* Rozhodnutia vznikajú **len z `project.analysisResults`** (pauzy, hooky, B-roll, informačná hustota).
* Ak analýza chýba → **nula rozhodnutí** + otvorená otázka v `unresolvedAmbiguities`.
* J-cut, titulky, ducking, farba, multicam už nie sú „rozhodnutia s časom na osi“ — sú to
  otvorené otázky (nemáme meranie zvuku ani dôrazu v reči).
* `confidence` = priemer dôvery reálnych rozhodnutí (alebo 0), `createdAt` = čas zmeny projektu (deterministické).

### 2.5 Knowledge base
* `CREATIVE_PATTERNS_DB` je **prázdny** (vymyslené vzory a fake zdroj odstránené).
  Reálny zdroj vzorov sú namerané referencie (`tools/measure-reference-video.ts` → `referencie/analyza-*.json`).

### 2.6 Signál `export_finished` už neklame
* Predtým ho zapisovala simulácia multi-exportu. Teraz ho zapisuje **reálna exportná linka**
  (`CanonicalExportPanel` → stav `done` z renderu) cez nový callback `onExported` → `StyleStudioPanel`
  → `App.recordLive("export_finished")`. Sprievodca tak odškrtne krok len po skutočnom súbore.

---

## 3. Dôkazy (krok 29)

| Dôkaz | Výsledok |
|---|---|
| `bun run lint` (tsc) | **0 chýb** |
| `bun run build` | **exit 0** |
| `bun test` | **850 pass / 0 fail** (z toho 15 nových v `tests/honesty.test.ts`) |
| `bun run tools/verify-honesty.ts` | **PASS** — 6 pravidiel, 238 kombinácií súbor×pravidlo, 0 porušení → `docs/proof-honesty.txt` |
| `bun run tools/verify-qc-measure.ts` | **REAL MEDIA VERIFIED** na `real_speech.mp4`: 1 skutočný strih, medián záberu 32,72 s, 0,9 strihov/min, 1080:1920 @ 30 fps, determinizmus OK, žiadna kontrola bez merania nemá PASS → `docs/proof-qc-measure.txt` |

**Úrovne dôkazu (nezvyšujem ich):** tieto dôkazy sú **UNIT TESTED** a **REAL MEDIA VERIFIED**
(pre meranie). **BROWSER VERIFIED to nie je** — obrazovky musí otvoriť používateľ v appke
(záložka „Kontrola kvality“ a „Retenčný prehľad“). Panel som v prehliadači nevidel.

---

## 4. Čo ešte NIE JE poctivo doriešené (krok 30, druhá polovica)

1. **A/B varianty** — dnes sa nevytvárajú; chýba reálna cesta „variant = aplikovaný iný štýl/cieľ“ (dá sa postaviť na `applyStylePlan`).
2. **Content Pack** — chýba reálny výber momentov (viac-médiová analýza + výber podľa cieľa).
3. **Content Graph** — formáty pre platformy sa nevyrábajú; panel je dnes poctivý prázdny stav, ale bez funkcie.
4. **Meranie zvuku** — hlasitosť (LUFS), špičky, ducking. Bez neho ostávajú kontroly QC-06/QC-07 ako WARNING/NOT_VERIFIED.
5. **Diarizácia rečníkov** — `speaker: "A"` je stále natvrdo v `server.ts`; bez nej nie je multicam ani rozhovory.
6. **Relevancia B-rollu** — merajú sa len počty a pokrytie.
7. **`RawToReadyPipeline`** — predvolené `virality: { score: 92, … }` (zobrazuje sa v náhľade) treba zosúladiť s poctivým stavom.

Každý z týchto bodov patrí do ďalšieho kroku; nič z toho nie je skryté.
