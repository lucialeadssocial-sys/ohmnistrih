# CREATIVE DIRECTOR INTELLIGENCE — RESEARCH REPORT

> **Fáza:** výskum a pochopenie. **Žiadna implementácia.** Tento dokument je podklad pre rozhodnutie, čo (a či vôbec) stavať.
> **Dátum:** 30. 9. 2026 · **Stav repa pri audite:** `main == origin/main == 16c2fa0` (kroky 1–27)
> **Autor auditu:** OmniStrih (Arena.ai Agent Mode) — všetko nižšie je overené v kóde, nie odhad. Kde som si nebol istý, píšem `UNKNOWN`.

---

## A. EXISTUJÚCA ARCHITEKTÚRA (mapa, ktorá už je v repozitári)

### A.1 Jadro a dáta

| Vrstva | Súbor | Čo to naozaj je |
|---|---|---|
| Projektový model | `src/core/types/project.ts` (376 r.) | `ProjectModel`, `MediaAsset`, `ClipModel`, `TrackType` (`video/b-roll/audio/sfx/caption/adjustment`), `EditDecision` (r. 121), `LearningExplanationModel` (r. 35) |
| CommandManager + snapshoty | `src/core/index.ts` (`coreEngine`), `commandManager`, `createProjectVersion` | Reálne mutácie canonical osi; Apply zo Style Studia tadiaľto ide a je overený |
| Analýza (typy) | `src/core/ai/analysisTypes.ts` (319 r.) | **Celý model „Creative Director“ už existuje v typoch:** `ShotItem`, `SceneItem`, `ContentStructure`, `ContentTypeCandidate`, `HookCandidate`, `CTACandidate`, `BrollOpportunity`, `EditingInsight`, `CreativePattern`, `DirectorDecisionItem`, `DirectorStrategy`, `DirectorPlan`, a **`TeachMeExplanation` (WHY/WHEN/WHEN NOT/HOW/antiPattern/source/confidence)** |
| Analýza (engine) | `src/core/ai/analysisEngine.ts` (462 r.) | `analyzeShots`, `analyzeScenes`, `analyzeContentStructure`, `getTeachMeExplanation` — **implementované heuristikami, nie meraním (detaily v časti B)** |
| Knowledge base | `src/core/ai/knowledgeBase.ts` (349 r.) | `EDIT_KNOWLEDGE_BASE` — **10 princípov** (J_CUT, L_CUT, PAUSE_TRIMMING, BROLL_INSERTION, HOOK_PUNCHIN, CAPTIONS_EMPHASIS, AUDIO_DUCKING, COLOR_BALANCING, TRANSITION_SELECTION, INFORMATION_DENSITY) + `CREATIVE_PATTERNS_DB` (2 záznamy) |
| Director | `src/core/ai/directorEngine.ts` (702 r.) | `generateDirectorPlan` (client, mock fallbacky), `generateStylePlan` (reálny Style Plan), `conductReview`, `validatePlanConflicts`, `safeBatchApply`, `compareUserAndAiEdits` |
| Director (2. cesta) | `server.ts` `/api/director/plan` | Gemini + `local-fallback`; vracia `DirectorPlanItem[]` s WHY, accept/reject, apply report |
| Štýl | `src/core/style/*` | `styleRecipes.ts` (15 receptov, 5 z referencií), `styleIntelligence.ts` (`buildStylePlan`), `styleApply.ts` (CommandManager), `styleDecisionTypes.ts`, `styleExplicitness.ts`, `videoGoal.ts` (9 cieľov — krok 26), `creatorReference.ts`, `styleCard.ts` (vizuály — krok 27) |
| Reálne meranie videa | `src/core/style/referenceVideoStats.ts` (619 r.), `referencePixels.ts` (562 r.), `referenceGrid.ts` (605 r.), `export/lightMatch.ts` | Počítanie strihov, dĺžok záberov, dynamiky, jasu, kontrastu, sýtosti, palety, pásov obrazu |
| Retencia (EDL) | `src/core/retention/retentionEngine.ts` (554 r.) | `buildRetentionEdl` — deterministické keep/remove intervaly, `carveRange`, `edlToClipSpecs`, varovania |
| Učenie z používateľa | `src/core/learning/editDna.ts` (378 r.) | Profil z accept/reject rozhodnutí používateľa (localStorage), `recordDecisions`, `biasPlan` |
| Export | `src/core/export/canonicalExport.ts`, `subtitleRender.ts`, `transitions.ts`, `burnJob.ts`, `ffmpegEnv.ts` | Canonical os → ffmpeg; prechody, titulky po slovách, pruženie, svetlo; overené na reálnych videách |
| Pomôcky dôkazov | `tools/*` (15 runnerov) | `measure-reference-video.ts`, `verify-style-to-timeline.ts`, `verify-canonical-export.ts`, `verify-goal-to-timeline.ts`, `verify-light-match.ts`, `verify-transitions.ts`, `verify-own-visual.ts`, … |
| Testy | `tests/*` | **835 testov / 35 súborov**, s úrovňami UNIT / JSDOM / REAL MEDIA / REAL EXPORT |
| UI | `src/App.tsx`, `src/components/*` | **43 nástrojov** v `src/ui/toolGuides.ts` + výučba + živý sprievodca (11 reálnych signálov) |

### A.2 Čo z toho tvorí dnešný reťazec

```
transcript (Gemini, word-level)  +  canonical timeline  +  namerané hodnoty referencií
        ↓                                    ↓                        ↓
   StylePlan (15 receptov)          retention EDL (strihy)      styleRecipes (measuredLight…)
        ↓                                    ↓                        ↓
   EditDecision[] ── Review (accept/edit/reject) ── Apply (snapshot → CommandManager) ── canonical os
        ↓
   náhľad (rovnaká os)  ·  export (existujúci engine)  ·  pokus o QC panel
```

---

## B. REALITY GATE (YES / NO / PARTIAL / UNKNOWN)

Význam: **Code exists** = kód je v repe · **Wired** = niečo ho naozaj volá (nie len test) · **UI** = je viditeľný v rozhraní · **Interactive** = dá sa s ním pracovať (potvrdzuje sa v prehliadači — u nás bez DOM ⇒ UNKNOWN) · **Real data** = pracuje so skutočným médiom/prepisom, nie s maketou · **Runtime** = overené spustením (test/runner) · **Reusable** = dá sa rozšíriť bez prepísania.

| Oblasť | Code exists | Wired | UI | Interactive | Real data | Runtime | Reusable |
|---|---|---|---|---|---|---|---|
| Transcript | YES | YES (`/api/transcribe-speech`, `/api/transcribe-video`) | YES | UNKNOWN (bez DOM) | **YES** (reálne audio → slová s časmi) | YES | YES |
| Word timestamps | YES | YES | YES | UNKNOWN | YES | YES (835 testov, REAL MEDIA) | YES |
| Speaker analysis | **NO** | NO | NO | NO | **NO** (`speaker: "A"` natvrdo v `server.ts:2432`) | NO | — |
| Shot analysis | PARTIAL | YES (`analysisEngine.analyzeShots`) | PARTIAL | UNKNOWN | **NO** — odhad z dĺžky klipu (`>10 s ⇒ talking_head`, `confidence: 0.95`), bez analýzy obrazu | NO | PARTIAL |
| Scene analysis | PARTIAL | YES (`analyzeScenes`) | PARTIAL | UNKNOWN | **NO** — každé 3 „shots“ = scéna, `topic: "Téma N"` | NO | PARTIAL |
| DirectorEngine | YES | YES (2 cesty — viď Riziká) | YES | UNKNOWN | PARTIAL (jeden fallback je maketa) | YES (testy) | YES |
| DirectorPlan | YES | YES | YES | UNKNOWN | PARTIAL | YES | YES |
| EditDecision | YES | YES | YES | UNKNOWN | YES | YES | YES |
| WHY | YES (`whySk` v `EditDecision`, `TeachMeExplanation.why`) | PARTIAL (Style Studio áno, `TeachMe` len v 2 paneloch) | YES | UNKNOWN | YES | YES | YES |
| SHOW ME HOW | YES (`manualWorkflowSteps`, `howToManual`) | PARTIAL | PARTIAL | UNKNOWN | YES (ručné kroky sú poctivo označené) | YES | YES |
| StyleRecipe | YES (15) | YES | YES | UNKNOWN | **YES** (5 z nich z nameraných videí) | YES | YES |
| CommandManager | YES | YES | — | YES (cez Apply) | YES | YES (rollback `restoredExactly`) | YES |
| Snapshot | YES | YES | YES | UNKNOWN | YES | YES | YES |
| Rollback | YES | YES | YES | UNKNOWN | YES | YES | YES |
| Canonical Timeline | YES | YES | YES | UNKNOWN | YES | YES | YES |
| Preview | YES (rovnaká os) | YES | YES | UNKNOWN | YES | PARTIAL (parita overená v runneroch) | YES |
| Export | YES | YES | YES | UNKNOWN | YES | **YES** (REAL EXPORT na reálnych videách) | YES |
| QC | PARTIAL (25 kontrol) | YES (panel) | YES | UNKNOWN | **NO** — „stress test“ nastaví všetko na PASS s vymysleným odôvodnením | NO | PARTIAL |

**Dodatočné položky, ktoré som našiel a ktoré v tabuľke chýbali (a sú dôležité):**

| Oblasť | Stav | Dôkaz |
|---|---|---|
| **Content Map (viac médií)** | **NO** | `project.analysisResults` je jedna kolekcia na projekt; `analysisEngine` `assetId` pozná, ale Content Map naprieč 30 videami neexistuje |
| **Retention simulácia (krivka)** | **NO — maketa** | `RetentionSimulator.tsx` r. 134: `{/* Dummy curve bars */}` + `Math.random() * 10` |
| **Content Graph** | **NO — maketa** | `ContentGraphStudio.tsx` r. 30: `INITIAL_ARTIFACTS` (pevné ukážky, nie používateľov obsah) |
| **QC „auto-fix“** | **NO — fake** | `QualityControlAndAnalytics.tsx` r. 282 a 382: `status: "PASS"`, `evidenceSk: "STRESS TEST VERIFIED: Plne vyhovuje…"` bez merania |
| **Vizuálne meranie referencie** | **YES — najsilnejšia časť** | `tools/measure-reference-video.ts`: **57 metrík** na video (strihy, dĺžky záberov, jas, kontrast, sýtosť, teplota, hustota hrán, pásy obrazu, dynamika, pokoj, paleta, akcent…) |
| **Namerané referencie** | **YES — 23 videí** | `referencie/analyza-tiktok.json` (12), `analyza-nove.json` (2), `analyza-videa.json` (6), 3× `ref-*.mp4` |

**Kde sú natvrdo vložené (falošné) dáta — musí sa to pomenovať:**
1. `directorEngine.generateDirectorPlan`: fallback pauza `4.2–5.8 s`, fallback hook `0–3 s` (`confidence 0.94`), J-cut „v 12.0 s“ (`confidence 0.98`).
2. `analysisEngine.analyzeShots`, `analyzeScenes`, `analyzeContentStructure`: odhady + `present: true` + `pauseDensity: 0.18`.
3. `knowledgeBase.CREATIVE_PATTERNS_DB`: zdroj „**OmniStrih SK Content Intelligence Data 2026**“ — taký dataset v repozitári **neexistuje** ⇒ neoveriteľný zdroj.
4. QC panel a Retention/ContentGraph panely (vyššie).

---

## C. EXISTUJÚCE SCHOPNOSTI (čo OmniStrih naozaj dokáže — s dôkazom)

1. **Prepis reči so slovami a časmi** (Gemini API) — reálne, použité v exportoch.
2. **Rezanie a spájanie videa z canonical osi** (`trim/atrim/concat`), s pôvodným zvukom ako masterom — REAL EXPORT.
3. **Prechody** (17 vykresliteľných typov, `xfade` + `acrossfade`) — REAL EXPORT, dĺžka sa skrátila presne o súčet prekrytí.
4. **Titulky po slovách + animácia zvýrazneného slova** — merané na hotovom MP4.
5. **Merané svetlo z referencie → do náhľadu aj exportu** (jas/kontrast sa trafili; kontrast pri jednofarebnom zdroji priznaný ako neúspech).
6. **Štýl z referencií** (5 receptov z nameraných videí) → `EditDecision` → Apply → canonical os (BEFORE ≠ AFTER, rollback presný).
7. **Cieľ videa (9 cieľov)** ako stratégia nad rozhodnutiami — iný canonical stav pre rovnaké video a iný cieľ.
8. **Vlastné vizuály** (karta v palete receptu, voľná knižnica s licenčnou politikou, súbor z disku/telefónu) — REAL EXPORT.
9. **Retenčný EDL** (deterministické keep/remove) a **EditDNA** (učenie z rozhodnutí používateľa).
10. **Nameraná vizuálna charakteristika referencie** (57 metrík/video) — základ pre „Creator Intelligence“, ktorý už existuje v dátovej podobe.

---

## D. MISSING CAPABILITIES (čo naozaj chýba pre „senior editor“)

| Pre ktorý „mozog“ | Chýba | Prečo to dnes nejde |
|---|---|---|
| **Content Brain** | Content Map naprieč **viacerými** médiami (30 videí) s významom, nie kľúčovými slovami | `project.analysisResults` je jedna kolekcia; analýza je „na projekt“ |
| | **Detekcia opakovania podľa významu** (Video 12 hovorí to isté ako Video 07) | neexistujú embeddingy ani iná podobnosť textu; iba presná zhoda |
| | **Reálna vizuálna analýza** (záber, scéna, rekvizity, produkt) | dnešné „shots/scenes“ sú odhad z dĺžky klipu |
| **Story Brain** | Delenie na **hook/problém/riešenie/dôkaz/payoff/CTA** z reálneho prepisu | `analyzeContentStructure` vracia pevné hranice (0–3–7–10 s) |
| | Informačný oblúk a **pointa** ako dáta | nikde sa nepočíta „hlavné posolstvo“ z materiálu |
| **Editor Brain** | **Výber najlepšej verzie tej istej myšlienky** medzi viacerými zdrojmi | chýba porovnanie variantov (rovnaká myšlienka, iné médium) |
| | **WHY NOT na úrovni materiálu** (ktoré médium a prečo vypadlo) | `EditDecision` má `alternativeSk`, ale nie „toto médium som vyradil a prečo“ |
| **Visual Brain** | Vzťah **B-roll ↔ tvrdenie** (kde vizuál dokazuje vetu) | hľadanie B-rollu je dnes samostatný panel (`finder`), nie rozhodnutie Directora |
| | Vyhodnotenie **talking-head vs supporting** z reálneho materiálu | pomer je len parameter receptu, nemeria sa v tvojom videu |
| **Audio Brain** | Hudba/SFX/ducking ako rozhodnutia s dôkazom | audio sa chráni (master), ale plán hudby/SFX neexistuje |
| | Diarizácia (kto hovorí) | chýba (`speaker: "A"`) |
| **Retention Brain** | Reálna predpoveď straty pozornosti | „simulátor“ je dnes `Math.random()` |
| **Creator Intelligence** | **Princípy s dôkazom** (nie recept s číslami) | recepty majú namerané hodnoty, ale nemajú „prečo“ a „kedy nie“ z referencií |
| | Typografia, prechody, audio správanie v referenciach | `measure-reference-video.ts` meria obraz a strih, **nie** titulky/hudbu |
| **QC** | Merané kontroly | QC panel je dnes statický zoznam + „stress test“ |

---

## E. CREATOR INTELLIGENCE MODEL (návrh, postavený na tom, čo už existuje)

**Zásada: žiadny nový engine.** Creator Intelligence = **dve nové dátové vrstvy a jedna nová úloha**, všetko v existujúcich moduloch.

```
REFERENČNÉ VIDEÁ (dnes 23)
        ↓  tools/measure-reference-video.ts  (57 metrík — UŽ JE)
NAMERANÉ HODNOTY     (dnes analyza-*.json — UŽ JE)
        ↓  NOVÉ: agregácia na princípy (nie na čísla)
CREATIVE PRINCIPLES  { tvrdenie, dôkaz (N videí, medián, rozptyl), kedy platiť, kedy nie, confidence }
        ↓  už existuje
STYLE RECIPE / DIRECTOR ENGINE / EDIT DECISION
```

**Ako musí vyzerať princíp (aby to nebol preset):**

```ts
interface CreativePrinciple {
  id: string;                       // napr. "SHORT_TAKE_ON_INTENSITY"
  claimSk: string;                  // "Kratší záber sa používa v mieste zvýšenej informačnej alebo emočnej intenzity."
  notClaimSk: string;               // explicitne: "NIE je pravda, že sa strihá každé 2 sekundy."
  evidence: {
    source: "reference_measured";   // inak sa princíp NEZOBRAZÍ
    videos: number;                 // koľko videí to podporuje
    metric: string;                 // ktorá metrika (napr. median_zaberu_s)
    values: number[];               // konkrétne čísla
    spreadSk: string;               // rozptyl (aby bolo vidieť, že to nie je univerzálne)
  };
  appliesWhenSk: string[];          // situácie (z reálnych signálov vety: číslo, otázka, emócia…)
  doesNotApplyWhenSk: string[];     // výnimky
  confidence: number;               // 0–1, odvodená z počtu videí a rozptylu (nie „pocitová“)
}
```

Vstup do rozhodovania: `buildStylePlan` dostane **princípy ako obmedzenia a preferencie**, ale **nikdy ako príkaz „urob X v čase Y“** — čas určuje obsah (veta/myšlienka), nie referencia.

---

## F. CONTENT / STORY / EDITOR REASONING (čo použiť z existujúceho kódu)

### F.1 Content Brain (bez nového modelu)
* **Vstup na médium:** `MediaAsset` + `transcript` segmenty (už existujú) + namerané hodnoty (`referenceVideoStats` pre **tvoje** médiá takisto funguje — je to len ffmpeg meranie).
* **Jednotka analýzy = médium (`assetId`)**, nie projekt. `AnalysisEngine` už `assetId` a cache pozná → rozšíriť, nie prepísať.
* **Význam bez providera:** vety → embeddingy **lokálne** (transformers.js; viď časť O). Z toho: zhoda tém, **detekcia opakovania** (cosine > prah), klastrovanie myšlienok.
* **Význam s providerom:** zhrnutie po klastroch („čo táto skupina tvrdí“) — jedna dávka na projekt, nie na klip.

### F.2 Story Brain
Z reálneho prepisu (existujúce signály z kroku 26: `isHook`, `isQuestion`, `numberWords`, `isEmotional`, `topicShift`, `pauseBefore/After`) sa dá poskladať **oblúk**:
* `HOOK` = prvá veta s najvyšším „spojením“ na tému + najvyššou hustotou (existujúce metriky),
* `PROBLÉM/RIEŠENIE/DÔKAZ/PAYOFF/CTA` = **klasifikácia viet**, nie pevné časy: marker-based lokálne (napr. „problém“, „výsledok“, „zaplatil“, „napíš“), embeddingy na overenie zhody s prototypom.
* Čo sa nedá: „pointa“ bez jazykového modelu pri nejasnom texte → potom appka **povie, že pointu nevie určiť**.

### F.3 Editor Brain (výber z 30 videí)
1. Kandidáti = segmenty (vety/myšlienky) zo všetkých médií.
2. Skóre = cieľ (krok 26 `scoreSentenceForGoal`) × dôkaz (číslo/emócia/otázka) × odlišnosť od už vybraných (embedding) × **kvalita média** (namerané: dynamika, jas, kontrast, ostré hrany).
3. Výber = greedy s rozpočtom času (dĺžka cieľa) a **kvótou na typ** (hook 1, proof ≥1, CTA ≤1) — všetko deterministické a testovateľné.
4. Každé vyradenie dostane **dôvod** (duplicita / slabá pointa / mimo témy / horšia kvalita) → `considered[]` (mechanizmus už existuje zo Style Studia).

---

## G. GOAL REASONING (dnes už existuje, treba len rozšíriť na výber materiálu)

* `src/core/style/videoGoal.ts` — 9 cieľov, `intentMarkers`, `actionMarkers`, `weights`, `caps`, `requiresSk`, `neverDoesSk`.
* Dnes cieľ pôsobí **na jeden zdroj** (jedno video, jeden prepis).
* Rozšírenie (bez nového modelu): tie isté váhy sa použijú na **skórovanie segmentov naprieč médiami** (časť F.3). Cieľ tak zostáva jediná „severná hviezda“ a zároveň jediné miesto, kde sa rozhoduje o dôraze.
* **Goal neurčuje štýl; štýl neurčuje cieľ** — to je už v kóde oddelené a testované (krok 26).

---

## H. CREATOR STYLE REASONING (proti „presetu“)

Dnešný stav: `StyleRecipe` = namerané hodnoty (rytmus, svetlo, typografia, textúra…). To je správne pre **vizuálnu DNA**, ale nestačí na „prečo“.

Navrhovaná zmena je **malá a aditívna**: k receptu pridať **`principlesSk`** (zoznam princípov z časti E), ktoré sa **zobrazujú v Style Studiu a v rozhodnutiach** (WHY odkazuje na princíp + jeho dôkaz). Recept bez princípov funguje ďalej presne ako dnes — princípy sú nadstavba, nie podmienka.

**Čo sa NIKDY nestane automaticky:** princíp „použi punch-in“ neznamená „punch-in v 5. sekunde“ — čas a miesto určuje veta/myšlienka a cieľ.

---

## I. DIRECTOR ENGINE INTEGRATION PLAN (žiadny druhý Director)

**Súčasný stav (problém, ktorý treba riešiť):** existujú **dve** plánovacie cesty:
1. `DirectorEngine.generateDirectorPlan` (client; fallbacky-makety) — používa `DirectorStudio` a `DirectorProductionCenter`.
2. `/api/director/plan` (server; Gemini + local-fallback) — používa `DirectorPlanPanel` v `RawToReadyPipeline`.

To je presne to, čo zadanie zakazuje („nevytváraj druhý AI Director“). **Odporúčanie: zjednotiť ich v prospech reálnej cesty** (server alebo spoločná funkcia) a makety vo fallbacku **odstrániť** (nahradiť prázdnym plánom + poctivou vetou „nemám dáta“).

Navrhovaný tok (všetko existujúce prvky + 3 nové dátové štruktúry):

```
MediaAsset[] (30)                       ← existuje
   ↓ per-asset analýza (assetId)         ← existuje v AnalysisEngine (rozšíriť)
TranscriptSegment[] per asset            ← existuje
   ↓ Content Map (NOVÁ dátová štruktúra) ← {assetId, význam, sila, použitie, duplicita}
   ↓ Story Map  (NOVÁ)                   ← {hook, problem, solution, proof, payoff, cta}
   ↓ Video Goal (existuje, krok 26: 9 cieľov)
   ↓ Creator Style (existuje: recept + NOVÉ princípy)
   ↓ EDIT STRATEGY (deterministické skórovanie + výber, NOVÁ funkcia)
   ↓ EditDecision[] (existuje) — s pôvodom (assetId, sourceStart/End)
   ↓ WHY / WHY NOT (existuje rám; doplniť dôvody vyradenia)
   ↓ USER REVIEW (existuje)
   ↓ COMMAND MANAGER (existuje) → CANONICAL TIMELINE (existuje) → PREVIEW → EXPORT → QC
```

**Jediný nový „engine“ je funkcia, nie trieda:** `buildCreativeStrategy(input) → EditDecision[]`, postavená na tých istých typoch ako `buildStylePlan`. Volá ju `DirectorEngine` (rozšírenie o jednu metódu), takže navonok ide o **jeden DirectorEngine**.

---

## J. EDIT DECISION MODEL (rozšírenie existujúceho)

`EditDecision` (r. 121) už má: `id, timestamp, type, reason, alternatives, impact, status, learningNote, clipId, actionPayload, style{…whySk, whenNotSk, alternativeSk, confidence, evidenceSk, signals, action, goalId, goalFit…}`.

**Návrh (aditívne, spätne kompatibilné):**

```ts
interface EditDecision {
  …existujúce polia…
  /** Odkiaľ obsah pochádza (pri viacerých médiách je to nutné pre WHY aj pre strih). */
  source?: { assetId: string; assetName: string; startSec: number; endSec: number };
  /** Prečo práve tento zdroj (a nie iný s tou istou myšlienkou). */
  selectedBecauseSk?: string;
  /** Prečo bol iný zdroj vyradený (WHY NOT na úrovni materiálu). */
  rejectedSk?: { assetId: string; reasonSk: string }[];
  /** Princíp, o ktorý sa rozhodnutie opiera + jeho dôkaz (z referencií). */
  principleId?: string;
}
```

Bez týchto štyroch polí sa „editorial reasoning“ nedá vysvetliť — a bez vysvetlenia by to bol presne ten fake, ktorý zadanie zakazuje.

---

## K. WHY / WHY NOT (konkrétne, ako to spraviť v existujúcom rámci)

* **WHY** je vyriešené: `style.whySk` + `evidenceSk` + `signals` (+ `goalFitSk`). Rozšírenie: pridať odkaz na princíp a na zdrojové médium.
* **WHY NOT** dnes existuje len ako `considered[]` („čo som zvážil a nevybral“) v rámci jedného videa. Pre 30 videí treba **dve úrovne**:
  1. **Úroveň materiálu:** „Video 12 som nepoužil — opakuje myšlienku z Videa 07 (podobnosť 0,91) a má nižšiu kvalitu obrazu (dynamika 12/s vs 43/s).“
  2. **Úroveň rozhodnutia:** „Punch-in som nedal — cieľ 🎓 Vzdelávanie ho v tomto mieste nechce.“ (už existuje)
* **UI:** dnes `considered` vidno v Style Studiu. Pre Content Map treba jeden zoznam „Použité / Nepoužité / Prečo“ (krok 4 v Implementation Order).

---

## L. PERFORMANCE STRATEGY (30 videí, 2 GB RAM, bez blokovania UI)

| Problém | Riešenie (a čo už existuje) |
|---|---|
| 30 videí × pixelová analýza | **Už je vyriešené v `measure-reference-video.ts`**: vzorkovanie do malého rastra (napr. 270×480), nie full-res snímky; rovnaký prístup pre používateľove médiá |
| 30 × prepis (Gemini) | Dávkovo, po jednom médiu, s viditeľným postupom; medzivýsledky ukladané per `assetId` (**cache už existuje**) |
| Blokovanie UI | Analýza v serveri/workeri (existujúci vzor `/api/...` + job store v `burnJob.ts`), nie v hlavnom vlákne |
| Embeddingy | transformers.js v **workeri**, dávkovo po vetách; výsledky do IndexedDB (`idbManager` existuje) |
| Pamäť | držať **vektory a časy**, nie snímky; snímky len na požiadanie (storyboard z existujúceho náhľadu) |
| „AI pri každom seeku“ | zakázané — AI len v analýze a v pláne; prehrávanie číta canonical os |

**Rozpočet na jedno 30-minútové natáčanie (odhad, nie meranie):** pixelová analýza ~1–3 min CPU (vzorkovanie), prepis dominantne závisí od providera, embeddingy ~10–30 s CPU/1 000 viet.

---

## M. LOCAL-FIRST STRATEGY (čo vieme bez providera)

| Schopnosť | Dnes | Môže byť lokálne? |
|---|---|---|
| Strihy, dĺžky záberov, dynamika, svetlo, kontrast, paleta | **áno, lokálne (ffmpeg)** | áno |
| Detekcia strihov presnejšie (obsahová, nielen prahová) | prahová | **áno** — PySceneDetect (BSD-3) ako *princíp* alebo vlastná implementácia obs. rozdielu (už máme `motionBetweenFrames`, `normalizeCutTimes`) |
| Prepis reči | Gemini | **áno** — transformers.js + Whisper (Apache-2.0) v prehliadači; nutné stiahnuť model (120–590 MB) ⇒ musí byť **voľba**, nie tichý download |
| Význam viet (podobnosť, duplicita) | neexistuje | **áno** — embeddingy lokálne (multilingual model, Apache-2.0) |
| Textové zhrnutie / „pointa“ | Gemini | **čiastočne** (malý model v prehliadači je slabý; poctivo označiť ako „návrh, nie istota“) |
| Rezanie, prechody, titulky, export | **áno, lokálne** | áno |

---

## N. AI PROVIDER REQUIREMENTS (čo bez providera NEJDE)

| Úloha | Provider? | Poznámka |
|---|---|---|
| Prepis reči (presný, SK) | **áno** (alebo lokálny Whisper s kompromismi) | dnes Gemini; free tier je obmedzený |
| Zhrnutie „o čom to je“ na úrovni myšlienok | áno | jedna dávka na projekt |
| Klasifikácia viet na hook/proof/CTA v nejasných prípadoch | čiastočne | marker-based + embeddingy zvládnu väčšinu |
| Generovanie vizuálov | **nedostupné** (limit 0 na obrázkových modeloch Gemini — overené) | appka to hlási presne |
| Hudba/SFX generovanie | nedostupné | iba z existujúcich médií |

**Pravidlo ostáva:** žiadne veľké modely pri otvorení appky; provider len na výslovnú akciu; pri každej odpovedi vidieť, či to bolo AI alebo meranie.

---

## O. OPEN-SOURCE RESEARCH (RESEARCH → LICENSE → FIT → IDEA → ADAPT → TEST)

Overené dnes (licencie z oficiálnych zdrojov, nie z pamäti):

| Projekt | Licencia | Idea, ktorú berieme | Fit / CPU-GPU / prehliadač | Čo NEpreberáme |
|---|---|---|---|---|
| **PySceneDetect** | **BSD-3-Clause** ([repo](https://github.com/breakthrough/pyscenedetect)) | obsahová detekcia strihov (obsahový rozdiel medzi snímkami) — presnejšia než dnešný prah | Python/OpenCV, CPU (GPU netreba), **nie** do prehliadača → použiť ako referenciu algoritmu, nie kód | celý projekt, Python závislosti do appky |
| **TransNetV2** | **MIT** ([repo](https://github.com/soCzech/TransNetV2)) | neurónová detekcia hraníc záberov (presnejšia pri rýchlych strihoch) | Python + TF, CPU zvládne krátke videá; do prehliadača len cez ONNX (práca navyše) | váhy/model do appky (veľkosť, licenčné dôsledky datasetov) |
| **Transformers.js** | **Apache-2.0** (npm `@huggingface/transformers`) | beh modelov v prehliadači (WebGPU/WASM) | **vhodné**: on-device, žiadne API; pozor na stiahnutie modelu a pamäť | nič (len ako knižnica, ak vôbec) |
| **Whisper (porty onnx)** | **Apache-2.0** (napr. `Xenova/whisper-tiny.en`) | lokálny prepis bez API | CPU/WebGPU; SK kvalita pri `tiny` slabá → `base/small` (väčšie stiahnutie) | modely bez overenia kvality na SK |
| **sentence-transformers / all-MiniLM-L6-v2** | **Apache-2.0** (karta modelu) | embeddingy na detekciu opakovania a podobnosti myšlienok | CPU zvládne rýchlo; **pozor**: karta uvádza trénovacie dáta (MS MARCO) s otázkou komerčného použitia ([diskusia](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2/discussions/34)) → overiť a radšej použiť **multilingual** variant | trénovacie dáta a právne riziko neoverené ⇒ pred nasadením overiť |
| **ONNX Runtime Web** | MIT | beh modelov vo workeri | WebGPU/WASM | — |

**Zásada z minula ostáva:** cudzí kód nepridávame, ak to OmniStrih vie alebo by to spomalilo import/náhľad. Zatiaľ čo **vieme sami** (ffmpeg meranie, strihy, svetlo) — **berieme len myšlienku**.

---

## P. REAL-MEDIA TEST PLAN (konkrétne kroky s dôkazom)

**Dáta, ktoré mám k dispozícii (legálne, lokálne, mimo repa):**
* **23 referenčných videí s meraniami** (`referencie/analyza-tiktok.json` 12, `analyza-nove.json` 2, `analyza-videa.json` 6, 3× `ref-*.mp4`).
* **6 reálnych videí AI_KTIVISTU** (`referencie/aikt-*.mp4`, 15–71 s) — legálne stiahnuté cez verejné API TikToku, určené len na meranie v prostredí.
* **3 videá Denisa Vencela** (`ref-*.mp4`) + ich náhľady.

**Plán testov (každý test musí povedať, čo je reálne a čo syntetizované):**

1. **Content Map na 3–5 médiách** z jedného zdroja: appka musí vypísať, ktoré médium nesie akú myšlienku, a **označiť, že analýza je textová** (nie vizuálna), ak vizuál nemeria.
2. **Duplicita:** umelo vytvorený testovací set (jedna myšlienka povedaná v 3 verziách) → appka musí vybrať jednu a **pomenovať, prečo**; druhé dve musia byť vo WHY NOT.
3. **Story Map:** overiť na videu, kde hook/proof/CTA **naozaj sú** (jeho videá) — a na videu, kde **nie sú** (appka to musí povedať, nie si vymyslieť).
4. **Princípy z referencií:** z 23 nameraných videí vygenerovať princíp, ktorý má dôkaz (N videí, rozptyl), a overiť, že **nie je** formulovaný ako „každé 2 s strih“.
5. **Goal × materiál:** to isté 30-video zadanie s cieľom 🛒 Predaj a 👤 Odber → **iný výber** (dôkaz: zoznam vybraných/vyradených sa líši).
6. **REAL EXPORT:** vybraný materiál → canonical os → **skutočný render** (ako pri krokoch 24–27) + snímky.
7. **Performance test:** 30 médií × 30–60 s; merať čas analýzy, pamäť, či appka zostane reagovať.

---

## Q. IMPLEMENTATION ORDER (odporúčané poradie, malé kroky s dôkazom)

| # | Krok | Prečo teraz | Dôkaz, ktorý musí priniesť |
|---|---|---|---|
| 0 | **Honesty fix** (odstrániť makety: QC „stress test PASS“, `Dummy curve`, `INITIAL_ARTIFACTS`, mock fallbacky v Directore) | pravidlo „žiadne fake analysis“ je porušené **dnes**; každý ďalší krok by stál na nepravde | test, že sa nedá nastaviť PASS bez merania; UI to napíše |
| 1 | **Zjednotiť dve Director cesty** | zadanie: žiadny druhý Director | jeden vstup, jedna odpoveď; stará cesta len ako tenký adaptér alebo odstránená |
| 2 | **Per-asset analýza** (`assetId` naprieč `analysisResults`) | bez toho nie je Content Map | test: 2 médiá → 2 sady analýz, cache funguje |
| 3 | **Content Map (význam textu)** — klasifikácia viet + lokálne embeddingy na duplicitu | jadro „editorial reasoning“ | test na syntetickom sete + reálne video |
| 4 | **UI „Content Map / Použité a nepoužité“** s WHY a WHY NOT | používateľ musí vidieť rozhodnutia | render test + (u používateľa) prehliadač |
| 5 | **Story Map** (hook/problém/riešenie/dôkaz/payoff/CTA) | skladba príbehu z reálneho materiálu | test: video s CTA → nájde ho; bez CTA → povie „nie je“ |
| 6 | **Creator Principles** z nameraných referencií (23 videí) | „učiť sa princípy, nie presety“ | princíp s dôkazom + rozptylom; test zakazuje formuláciu „každé 2 s“ |
| 7 | **Výber materiálu podľa cieľa** (goal × skóre × duplicita × kvalita) | „Použiteľné: 7 z 30“ | meranie: rovnaký set, 2 ciele → iný výber |
| 8 | **Apply vybraného materiálu** do canonical osi (cez existujúci `importMediaFile` + CommandManager) | až teraz má zmysel strihať | BEFORE ≠ AFTER, rollback, REAL EXPORT |
| 9 | **QC merané** (nahradiť statický panel meraniami, ktoré máme) | dôvera v kvalitu | každá kontrola musí ukázať zdroj čísla alebo „NOT VERIFIED“ |

---

## R. RISKS

| Riziko | Dopad | Ako ho držať na uzde |
|---|---|---|
| **Fake intelligence** (dnešný stav: QC PASS, dummy krivka, mock fallbacky) | strata dôvery; používateľ sa rozhoduje podľa nepravdy | krok 0; pravidlo „bez merania = NOT VERIFIED“; testy, ktoré zakazujú PASS bez dôkazu |
| **Dva Directori** | rozbitie architektúry, nezrovnalosti | krok 1 |
| **Lokálne modely (Whisper/embeddingy) na 2 GB RAM / v prehliadači** | zaseknutie appky, veľké sťahovanie | len na výslovnú akciu, worker, kvantizované modely, viditeľný postup a možnosť zrušiť |
| **Licencie modelov a trénovacích dát** | právne riziko pri komerčnom použití | overiť pred nasadením (časť O), radšej vlastné/potvrdené zdroje |
| **Slovenčina v malých modeloch** | slabá kvalita prepisu/embeddings | testovať na SK videách; keď je slabšie, povedať to a použiť providera |
| **Zložitosť pre používateľa** | presne to, čo nechceme („nerob mi ďalšieho chatbota“) | jedna obrazovka: použité/nepoužité + WHY; žiadne nové prekvapenia |
| **Čas analýzy pri 30 videách** | používateľ čaká | dávkovanie, cache, možnosť pracovať počas analýzy; nikdy neblokovať UI |
| **Determinizmus** | rovnaké zadanie musí dať rovnaký plán | žiadne `Math.random()`; zoradenie s pevnými pravidlami (dnes už testované) |

---

## S. EXACTLY WHAT IS NOT VERIFIED (poctivo)

1. **UI v prehliadači** — v prostredí nie je prehliadač s DOM. Všetko „Interactive“ v tabuľke je `UNKNOWN`. Platí pre Style Studio, Vlastný vizuál, Content Map (keď vznikne), QC.
2. **Zvuková analýza** (hudba, SFX, ducking, diarizácia) — v appke neexistuje; nič som nemeral.
3. **Detekcia titulkov/hudby v referenčných videách** — `measure-reference-video.ts` ich **nemeria** (meria obraz a strih). Princípy o typografii by boli dnes **výmysel** — preto sa nesmú vygenerovať.
4. **Kvalita lokálneho Whisperu na slovenčine** — netestované.
5. **Embeddingy na SK** — netestované (žiadny model nie je v projekte).
6. **30-video scenár end-to-end** — neexistuje; dnes je analýza na jedno médium.
7. **AI generovanie obrázkov/videa** — provider nedostupný (limit 0), overené opakovane.
8. **„Pointa“ a „hlavné posolstvo“** — v kóde sa nikde nepočíta; akýkoľvek text by dnes bol vymyslený.
9. **Kontrast svetla na jednofarebnom videe** — priznaná nepresnosť z kroku 24.
10. **Žiadne tvrdenie „aplikované“** v tomto reporte neznamená zmenu canonical osi — report nemení nič; je to čítanie kódu a meraní.

---

## DODATOK — odpovede na 27 otázok zo zadania

1. **Čo OmniStrih už vie?** Rezať a spájať video z canonical osi, vypáliť titulky po slovách, animovať zvýraznené slovo, prechody, zosúladiť svetlo, aplikovať štýl z referencie, držať cieľ videa, pridať vlastné vizuály, exportovať. (Všetko s dôkazmi z krokov 16–27.)
2. **Čo vie DirectorEngine?** Vyrába `DirectorPlan` s rozhodnutiami (WHAT/WHY/WHEN NOT/alternatives/manual steps), konflikty, batch apply, porovnanie s používateľom — **ale fallbacky sú makety** a existujú dve plánovacie cesty.
3. **Čo vie analyzovať?** Reálne: prepis so slovami (API), obrazové metriky z ffmpeg (57 metrík), strihy a dĺžky záberov, svetlo/kontrast/sýtosť, dynamiku. Nereálne: „shots/scenes/content structure“ (heuristiky).
4. **Čo dokáže reálne z transcriptu?** Vety, slová s časmi, pauzy medzi slovami, otázky, čísla, emóciu (markery), témy (topic shift), dôraz. (Krok 26 `StyleSentenceSignal`.)
5. **Čo dokáže reálne z videa?** Strihy/rytmus, dĺžku záberov, dynamiku, jas, kontrast, sýtosť, teplotu, hustotu hrán, pásy obrazu, paletu a akcent — merané z pixelov, deterministicky.
6. **Ako vyberá najlepšie klipy?** Dnes **nevyberá z viacerých** — plánuje zásahy v jednom médiu podľa receptu/cieľa. Výber z 30 médií neexistuje.
7. **Ako chápe pointu?** **Nechápe** — `analyzeContentStructure` vracia pevné hranice; „pointa“ sa nikde nepočíta.
8. **Ako chápe cieľ?** 9 cieľov s markermi, váhami a stropmi; cieľ mení rozhodnutia a canonical os (overené), ale zatiaľ v rámci jedného videa.
9. **Ako funguje StyleRecipe?** 15 receptov, z toho 5 z nameraných referencií; obsahujú rytmus, typografiu, kameru, textúru, paletu, pomery, `measuredLight`; idú do `buildStylePlan` → `EditDecision` → Apply.
10. **Ako funguje EditDecision?** `EditDecision` + `StyleDecisionDetail` (what/when/why/whenNot/alternative/confidence/evidence/signals/action) + `goalId/goalFit`; cez Review a CommandManager sa mení canonical os; rejected = žiadna zmena.
11. **Ako funguje WHY?** Texty z plánu (`whySk`) + dôkazy (`evidenceSk`) + signály; UI v pláne a v Style Studiu; `considered[]` = čo sa nevybralo a prečo.
12. **Ako funguje SHOW ME HOW?** `manualWorkflowSteps` (ručné kroky) + `TeachMeExplanation` (princíp, príklad, anti-pattern, zdroj) — dnes v `AnalyzePanel` a `ContextualAcademyBar`.
13. **Čo chýba pre Content Brain?** Viac-médiová analýza (per `assetId`), význam viet (embeddingy), detekcia opakovaní, vizuálna analýza záberov.
14. **Čo chýba pre Story Brain?** Klasifikácia viet na hook/problém/riešenie/dôkaz/payoff/CTA a výpočet „hlavnej myšlienky“ — dnes len pevné časy.
15. **Čo chýba pre Editor Brain?** Porovnávanie viacerých verzií tej istej myšlienky, výber podľa cieľa a kvality, vyradenie s dôvodom.
16. **Čo chýba pre Visual Brain?** Prepojenie B-roll ↔ tvrdenie; meranie pomeru rečník/vizuály v tvojom videe; rozhodnutia o kompozícii sú len z receptu.
17. **Čo chýba pre Audio Brain?** Hudba, SFX, ducking, diarizácia; dnes sa audio chráni (správne), ale nič sa o ňom nemeria.
18. **Čo chýba pre Retention Brain?** Akákoľvek reálna predpoveď — dnes je „simulátor“ `Math.random()`.
19. **Čo chýba pre Creator Intelligence?** Principy s dôkazom (nie čísla), a merania typografie/audio/prechodov v referenciách.
20. **Čo možno napojiť na existujúci DirectorEngine?** Content Map, Story Map, výber materiálu, WHY NOT — všetko ako vstupy/výstupy existujúcich typov (`EditDecision`, `considered[]`, `DirectorPlan`).
21. **Čo možno spraviť local-first?** Strihy, rytmus, svetlo, paleta (už), obsahová detekcia strihov, embeddingy, prípadne prepis (Whisper) — s výhradami.
22. **Čo vyžaduje AI provider?** Presný SK prepis, zhrnutie myšlienok, „pointa“ v nejasných prípadoch, dnešná klasifikácia viet, ktorá je textová.
23. **Čo vyžaduje GPU?** Nič z dnešného; GPU (WebGPU) by zrýchlil len lokálne modely (Whisper/embeddingy), nie je podmienkou.
24. **Čo je mock/simulation?** `analyzeShots`, `analyzeScenes`, `analyzeContentStructure`, fallbacky v `generateDirectorPlan`, QC „stress test“, `RetentionSimulator` krivka, `ContentGraphStudio` artefakty, `CREATIVE_PATTERNS_DB` so zdrojom, ktorý neexistuje.
25. **Čo je runtime verified?** 835 testov, 15 dôkazových runnerov, canonical apply/rollback, exporty.
26. **Čo je real-media verified?** Prepis, strih, prechody, svetlo, titulky, pruženie slova, štýly z referencií, cieľ, vlastné vizuály — vždy na `real_speech.mp4` alebo `aikt-*.mp4`.
27. **Čo je real-export verified?** Kroky 18, 24, 25, 26, 27 (+ canonical export runner) — s meraniami na hotových MP4.

---

## ZÁVER (jedna veta na rozhodnutie)

**OmniStrih už má polovicu „Creative Directora“ postavenú — a druhú polovicu má ako maketu, ktorú treba buď dorobiť meraním, alebo poctivo odstrániť.** Najväčší prínos nie je nová AI, ale **editorial reasoning nad existujúcimi dátami**: Content Map + Story Map + výber z viacerých médií + WHY NOT, s princípmi, ktoré sa opierajú o 23 nameraných videí — a bez jedinej vymyslenej vety.

**Odporúčaný prvý krok po schválení:** krok 0 (honesty fix) — pretože dnes appka v QC paneli ukazuje „PASS“ bez merania a to je presne tá nepravda, ktorú zadanie zakazuje.
