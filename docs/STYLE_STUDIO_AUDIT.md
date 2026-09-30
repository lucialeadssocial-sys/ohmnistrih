# AUDIT: Visual Style Studio — čo existuje, čo chýba, čo je dnes „fake“

> Zodpovedá na 11 otázok zo zadania **pred** implementáciou (požiadavka „BEFORE CODING“).
> Dátum: 30. 9. 2026 · `main` = `cb84187` · Audit robil agent čítaním kódu, nie odhadom.
> Zdrojový workflow (referencia): `aiktivista.sk/omnistrih.html` — Google Flow / Omni,
> prompt-based editácia, klipy do 10 s, voliteľný referenčný obrázok v gride 1×4.

---

## 0. Najdôležitejšie zistenie (mení zadanie)

V OmniStrih **existujú dve vrstvy** a nie sú prepojené:

| Vrstva | Kde žije | Je naozaj funkčná? |
|---|---|---|
| **A) LIVE (RAW → READY)** — to, čo používateľka reálne používa | `src/components/RawToReadyPipeline.tsx` (13 krokov) + server `/api/*` (ffmpeg) | **ÁNO** — plán, EDL, strih, vypálené titulky; overené naživo (vrátane môjho merania 12 994 pixelov) |
| **B) KANONICKÝ EDITOR** — `ProjectModel` + `CommandManager` + 41 commands + `Sequence/Track/Clip/MediaAsset` + WebCodecs render | `src/core/command/commandSystem.ts`, `src/core/types/project.ts`, `src/render/*` | **KNIŽNICA** — `new CommandManager` sa v celej appke **nevolá ani raz**; žiadna obrazovka ju nepoužíva, export z nej nie je overený |

**Dôsledok pre zadanie:** požiadavka „APPLY STYLE musí zmeniť canonical timeline cez existujúci CommandManager“ sa **nedá splniť poctivo bez toho, aby som najprv zapojil vrstvu B do živého UI** — inak by výsledok bol presne to, čo zadanie zakazuje: `plan.status = EXECUTED` a v skutočnosti nič. To je rozhodnutie pre používateľku (viď §12, otázka 1).

Zadanie pritom v bode 27 hovorí: „Ak niektorá časť ešte nie je technicky dostupná, najprv ju označ `NOT AVAILABLE` a nevytváraj fake implementation." → Robím presne to.

---

## 1. Existujúce komponenty, ktoré viem znovu použiť

| Komponent | Cesta | Prečo je dôležitý pre Style Studio |
|---|---|---|
| `RawToReadyPipeline` | `src/components/RawToReadyPipeline.tsx` (878 riadkov, 13 krokov) | miesto, kam Style Studio patrí (nie nový editor) |
| `DirectorPlanPanel` | `src/components/DirectorPlanPanel.tsx` | **hotový vzor Accept / Reject / Apply + report** (`applyPlan()` na riadku 277), vrátane „Zapísané do strihu“ a učenia cez Edit DNA |
| `RetentionShortPanel` | `src/components/RetentionShortPanel.tsx` | EDL klipu, náhľad, render bez prekódovania |
| `BurnCaptionsPanel` + `CaptionStylePreview` | `src/components/*.tsx` | vypálenie tituliek, 9 štýlov, brand kit, náhľad bez renderu |
| `VideoPlayer` + `TimelineControls` | `src/components/*.tsx` | **existujúci preview engine** — už dnes umí zobraziť `zoomCues` a `sfxCues` |
| `TransitionPresetDrawer` | `src/components/TransitionPresetDrawer.tsx` | hotové prechody vrátane `whip_pan`, `punch`, `warp_zoom` |
| `VisualAttentionStudio`, `SmartCaptionEditor`, `AIBrollEngine` | `src/components/*.tsx` | kroky 10 / 7 / 8 živého workflow |
| `AIVisualDirectorCenter`, `AIStoryboardPanel`, `VisualReviewCenter` | `src/components/*.tsx` (tab `ai_visual_director`) | staršia vizuálna vetva: má presety a storyboard, **ale nie je napojená na projekt** |
| `src/visual/*` (16 súborov, 2148 riadkov) | `VisualStyleDNA`, `EditorialCollageEngine`, `AISceneDirector`, `AIStoryboardGenerator`, … | dá sa použiť **nápad**, nie celok — viď §8 |

## 2. Existujúce services

- **Server (Express, `server.ts`, 3845 riadkov):** `/api/analyze-video`, `/api/transcribe-video`, `/api/transcribe-speech`, `/api/director/plan`, `/api/detect-burned-subtitles`, `/api/export/*` (upload, ffmpeg, burn-captions, status, cancel, file), `/api/trends/*`, `/api/captions/profiles`, `/api/ai-voice/*`.
- **Analytické jadro (klient):** `src/core/ai/analysisEngine.ts`, `analysisCache.ts`, `editingBrain.ts`, `knowledgeBase.ts`, `creativeHub.ts`, `src/core/trends/*`, `src/core/learning/editDna.ts`.
- **Média:** `src/core/media/mediaEngine.ts`, `mediaIntelligenceIndex.ts`, `src/core/storage/opfs.ts` + `idb.ts`, workery `src/workers/{proxy,thumbnail,waveform}Worker.ts`.

## 3. Existujúce commands

`src/core/command/commandSystem.ts` — **41 tried**: `AddClipCommand`, `RemoveClipCommand`, `SplitClipCommand`, `TrimClipCommand`, `MoveClipCommand`, `InsertEditCommand`, `OverwriteEditCommand`, `SetTransformCommand`, `SetColorCorrectionCommand`, `SetTransitionCommand`, `UpdateClipPropsCommand`, `GenerateCaptionsCommand`, `UpdateTranscriptCommand`, `AddMarkerCommand`, `AddProjectNoteCommand`, `CreateEditDecisionCommand`, `UpdateEditDecisionStatusCommand`, `AddReviewCommentCommand`, `SetReviewStatusCommand`, **`CreateProjectVersionCommand`**, **`RestoreProjectVersionCommand`**, `SwitchMulticamAngleCommand` a ďalšie.

Pre Style Studio by stačili: `AddClipCommand` (supporting visual na b-roll track), `SetTransformCommand` (punch-in), `SetTransitionCommand` (whip-pan), `CreateEditDecisionCommand` (WHAT/WHY/WHEN NOT), `CreateProjectVersionCommand` + `RestoreProjectVersionCommand` (snapshot/rollback).

**ALE:** `CommandManager` sa v appke neinštancuje (0 výskytov `new CommandManager`) → dnes by tieto commands menili objekt, ktorý nikto nezobrazuje ani neexportuje.

## 4. Existujúce DirectorEngine paths

`src/core/ai/directorEngine.ts`:
- `generateDirectorPlan(...)`, `generateBriefAndPlan(...)`, `conductReview(...)` — analytická časť,
- **`safeBatchApply(commandManager, plan, acceptedDecisionIds)`** — presne vzor pre „APPLY STYLE“: najprv `CreateProjectVersionCommand` (snapshot), potom commands po jednom, pri chybe `commandManager.undo()` → vracia `{success, appliedCount, snapshotVersionId, error}`,
- `validatePlanConflicts(...)` — kontrola kolízií pred zápisom,
- `compareUserAndAiEdits(...)` — porovnanie „môj strih vs. AI“.

Živá cesta RAW→READY používa **vlastnú** obdobu: `handleApplyDirectorPlan` v `src/App.tsx:1843` premieňa prijaté zásahy na existujúce mechanizmy (`jumpSequence` markery, `zoomCues`, `sfxCues`) a vracia `DirectorApplyReport` (`applied` / `skipped` s dôvodom). Toto je „apply“ mechanizmus live vetvy.

## 5. Existujúca media pipeline

`MediaAsset` model (`src/core/types/project.ts`), OPFS (`opfs.ts`) + IndexedDB (`idb.ts`), thumbnaily/proxy/waveform cez Web Workery, server uploads (`.data/uploads`), exporty (`.data/exports`), fonty (`.data/fonts`). **Naživo overené:** upload → ffmpeg render → súbor na stiahnutie.

## 6. Existujúci export

| Cesta | Stav |
|---|---|
| `/api/export/burn-captions` (ffmpeg: strih + ASS titulky v jednom prechode) | **REAL MEDIA / REAL EXPORT VERIFIED** (mnou merané vo videu) |
| `src/core/export/smartCutRenderer.ts` (packet copy, bez prekódovania) | **REAL MEDIA VERIFIED** (25 s klip ≈ 0,06 s) |
| `src/render/WebCodecsOfflineBackend.ts` (473 riadkov, skutočný `VideoEncoder`) | existuje, **čítaný používateľom `QualityControlAndAnalytics` + `RenderBackendSelector`, ale neoverený v prehliadači** → dnes `NOT VERIFIED` |
| `ExportModal` | pre hlavné UI nefunkčný (známe z F2b) |

## 7. Existujúca provider abstrakcia

- Rozhranie: `AIProvider<TInput, TOutput>` (`src/ai/types/ai.ts:70`) — `getStatus`, `loadModel`, `subscribe`, `process`, `cancel`, `retry` + cache (`src/ai/cache/aiCache.ts`).
- Implementácie: `LocalSpeechProvider`, `LocalVisionProvider`, `LocalTTSProvider`, `LocalVADProvider`, `LocalEmbeddingProvider` (+ `@huggingface/transformers ^4.3.0`).
- Server: `@google/genai ^2.4.0` (Gemini) cez `aiOrchestrator.ts`.
- **Image/video generation provider: NEEXISTUJE** (grep na `generateImage|generateVideo|text-to-image` = 0 výskytov).

## 8. Čo chýba

1. **`StyleRecipe`** ako dátový objekt a **presety** (Editorial Collage, Documentary, …) — dnes existuje `VisualStyleDNA` v staršej vetve, ale nie je napojený na živý workflow.
2. **Style intelligence** (rozhodnutia z viet, pauzy, dôrazu, hustoty informácií) — dnes máme word-level časovanie a vetné hranice (`wordTiming.ts`), ale žiadny „style director“.
3. **Storyboard s reálnymi snímkami** — `AIStoryboardGenerator` generuje len **textové** panely (popisy), žiadne obrázky; je mimo projektu.
4. **`Reference → StyleRecipe`** — dnes `ReferenceStyleAnalyzer.analyzeReferenceStyle(referenceName, projectId)` **analyzuje názov súboru**, nie obrázok (obsahuje `if (nameLower.includes("clean")) …`). To je podľa kritérií zadania fake a musí sa nahradiť.
5. **Napojenie vizuálnych rozhodnutí na render** — `zoomCues` a `sfxCues` idú **iba do preview** (`VideoPlayer`), **do exportu nejdú**; `smartCutRenderer` ani `burn-captions` ich nepoznajú. Teda dnes: **preview ≠ export**. Zadanie pritom žiada, aby preview aj export vychádzali z tej istej canonical timeline.
6. **Frame cache** — neexistuje (0 výskytov).
7. **WebGPU compositor** — neexistuje; `WebCodecs` render existuje (viď §6).
8. **Zapojenie `CommandManager`** (vrstva B) do živého UI — chýba úplne.

## 9. Čo môže zostať local-first (0 tokenov, 0 €, bez GPU)

- `StyleRecipe` + presety, style intelligence z existujúceho transkriptu (deterministické pravidlá: vetné hranice, pauzy, hustota slov, dôraz, dĺžka záberu),
- storyboard panely kreslené na `canvas`/SVG z reálnych snímok videa (lokálne, nízke rozlíšenie),
- náhľad štýlu v existujúcom prehrávači,
- **referenčná analýza**: dominantné farby, svetlosť, kontrast, hustota hrán, pomer plôch — lokálne cez `canvas` (žiadny model, žiadny provider),
- snapshot/rollback (obyčajný JSON stav predchádzajúceho nastavenia).

## 10. Čo potrebuje GPU

- WebCodecs render v prehliadači (existuje, neoverené), prípadne WebGPU kompozícia (neexistuje).
- **Pre Style Studio to nie je potrebné:** náhľad aj storyboard stačia na CPU; plné rozlíšenie robí serverový ffmpeg.

## 11. Čo potrebuje AI provider

- Textové vizuálne koncepty (popis panelov, návrhy textov) — **máme** (Gemini, existujúca cesta),
- **generovanie obrázkov/videa — NEMÁME** → v UI sa **nesmie** objaviť „Generate Video“. Bude tam „**Generate Visual Concept**“ (text/SVG) a „**Use Existing Media**“, presne podľa bodu 22 zadania.

---

## 12. Fake veci, ktoré som pri audite našiel (a čo s nimi)

| # | Kde | Čo dnes robí | Verdikt |
|---|---|---|---|
| 1 | `App.tsx` `handleApplyBroll` | nastaví `isApplied: true` + toast „B-roll aplikovaný na timeline!“ — **nič sa nezmení** | **FAKE** — označiť a opraviť/napojeniť |
| 2 | `App.tsx` `handleApplyAttentionSuggestion` | nastaví `applied: true` + toast „Úprava aplikovaná na timeline!“ | **FAKE** |
| 3 | `src/visual/ReferenceStyleAnalyzer.ts` | „analýza“ referenčného obrázka podľa **názvu súboru** | **FAKE** — nahradiť skutočnou analýzou pixelov |
| 4 | `AIVisualDirectorCenter` + `AIStoryboardPanel` + `VisualReviewCenter` | vyrobia plán, ktorý sa nikam nezapíše | **napojené nikam** — buď napojiť, alebo označiť `NOT AVAILABLE` |
| 5 | `src/ai/providers/LocalTTSProvider.ts` | `// Create synthetic sine wave placeholder blob representing TTS duration` | **FAKE audio** — nesmie sa tváriť ako TTS |
| 6 | `zoomCues` / `sfxCues` | vidno v prehrávači, **chýbajú v exporte** | **nesúlad preview ≠ export** (porušuje zadanie bod 17) |
| 7 | `AIStoryboardPanel` | textové panely (žiadne snímky) | polovičné — doplniť reálne thumbnaily |

## 13. Úrovne overenia (bod 24 zadania) — čo dnes platí

| Oblasť | Úroveň |
|---|---|
| Strih + vypálené titulky (server ffmpeg) | **REAL MEDIA + REAL EXPORT VERIFIED** (namerané vo videu) |
| `smartCutRenderer` (packet copy) | **REAL MEDIA VERIFIED** |
| Word-level časovanie, EDL, poradca štýlov, brand kit | **UNIT TESTED** (275 testov) + live render |
| `src/visual/*` (EditorialCollage, AISceneDirector, Storyboard) | **čítané kódom, NETESTOVANÉ** (žiadny test v `tests/`), bez prepojenia na projekt |
| WebCodecs render | **existuje, neoverené v prehliadači** |
| Generovanie obrázkov/videa | **NOT AVAILABLE** (provider neexistuje) |

---

## 14. Návrh implementácie (po fázach, bez duplicitnej architektúry)

**Fáza 1 — StyleRecipe + presety + style intelligence + StylePlan** *(0 tokenov, čisto lokálne)*
- `src/core/style/styleRecipes.ts` — presety (Editorial Collage, Documentary, Modern Social, Dark Editorial, Kinetic Typography, Minimal, Cinematic, Podcast Visual, UGC Performance, Custom),
- `src/core/style/styleDirector.ts` — z existujúceho transkriptu (vety, slová, pauzy) robí rozhodnutia: `EditDecision` s **WHAT / WHEN / WHY / WHEN NOT / ALTERNATIVE / CONFIDENCE**,
- používa `wordTiming.ts` (už máme) — **žiadny nový analyzér**.

**Fáza 2 — Storyboard (reálne snímky) + Review UI**
- panely 1×4 / 2×4 v 9:16 z reálnych snímok klipu (canvas, nízke rozlíšenie),
- review: Accept / Edit / Reject nad rozhodnutiami (rovnaký vzor ako `DirectorPlanPanel`).

**Fáza 3 — Apply + Snapshot/Rollback** *(musí niečo naozaj zmeniť)*
- zapíše rozhodnutia do **existujúceho stavu** živého workflow (markery, zoom/typography cue),
- pred zápisom snapshot, po zápise možnosť vrátiť presný predošlý stav (test: presná zhoda JSON).

**Fáza 4 — Render musí vedieť to, čo sľubuje náhľad**
- rozšíriť existujúci `burn-captions`/`smartCut` render o štýlové prvky: punch-in (ffmpeg `zoompan`/`scale`), text (existujúci ASS engine), prechody (`xfade`), textúra/halftone overlay (ffmpeg filter z vygenerovanej textúry, 0 tokenov),
- **tým sa odstráni dnešný nesúlad preview ≠ export**.

**Fáza 5 — Reference → StyleRecipe** (skutočná analýza pixelov, nie názov súboru) a **generovanie vizuálov** = `NOT AVAILABLE` (tlačidlo „Generate Visual Concept“, nie „Generate Video“).

---

## 15. Otvorené rozhodnutie (potrebujem od používateľky)

1. **Kam napojiť APPLY** — (A) živá vetva RAW→READY (dnes funguje a dá sa overiť na skutočnom videu), alebo (B) najprv zapojiť `CommandManager`/kanonický projekt do UI (väčšia robota, dnes žiadna obrazovka ani export ho nepoužíva)?
2. **Nesúlad preview ≠ export** — opravovať hneď v Fáze 4 (zoom/prechody/text idú aj do exportu), alebo najprv dokončiť plán a review?

Bez odpovede na (1) by akékoľvek „APPLY“ bolo buď fake, alebo by som musel stavať druhý editor — a to zadanie zakazuje.

---

## 16. GitHub prieskum (bod 25 zadania): RESEARCH → LICENSE → IDEA → ADAPT → TEST

Postup podľa pravidla „najprv zisti, či to OmniStrih už nevie lepšie; cudzí kód sa nepridáva len tak“.

| Potreba | Čo má OmniStrih dnes | Verdikt |
|---|---|---|
| WebCodecs renderer | `src/render/WebCodecsOfflineBackend.ts` (473 riadkov, skutočný `VideoEncoder`) | **máme** — nepridávať cudzie |
| IndexedDB / media storage | `src/core/storage/idb.ts` + `opfs.ts` | **máme** |
| Deterministic rendering | `seededRandom` v `src/visual/EditorialCollageEngine.ts`, cache v `src/ai/cache` | **máme princíp** |
| Local Whisper / lokálne modely | `LocalSpeechProvider` + `@huggingface/transformers ^4.3.0`; živá cesta používa Gemini (server) | **máme** |
| Storyboard generation | `AIStoryboardGenerator` (textové panely) | máme text, **chýbajú snímky** — doplníme lokálne na `canvas`, netreba knižnicu |
| Frame cache | **nemáme** | **zatiaľ nepotrebné**: náhľad ide cez `<video>` element a export cez serverový ffmpeg |
| WebGPU compositor | **nemáme** | **zatiaľ nepotrebné** pre Style Studio (CPU náhľad stačí); GPU by dávalo zmysel až pre 4K kompozíciu v prehliadači |

Konkrétne overené licencie (keby raz bolo treba):
- **framewright** (github.com/bribeck05/framewright) — MIT, WebCodecs + workery + OPFS cache zvuku,
- **openreel-video** (github.com/Augani/openreel-video) — MIT, WebGPU + WebCodecs, **LRU frame cache**, IndexedDB, používa aj MediaBunny (rovnako ako my),
- **hyperframes** (heygen-com/hyperframes) — frame-level prístup k videu v prehliadači.

**Rozhodnutie:** dnes **nepridávam** žiadny cudzí kód. Jediná myšlienka, ktorú si odkladám na neskôr (ak by náhľad škrípal), je **LRU frame cache** — a to ako vlastná implementácia, nie prevzatý projekt. Zdôvodnenie je v súlade s pravidlom: ak to spomalí import, timeline alebo náhľad, tak to nepridávame.
