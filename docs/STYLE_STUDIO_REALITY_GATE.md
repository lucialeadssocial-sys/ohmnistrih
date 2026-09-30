# REALITY GATE — Visual Style Studio (audit pred kódom)

> Povinný audit pred implementáciou (bod 0 zadania). **Nič nebolo implementované.**
> Dátum: 30. 9. 2026 · `main` = `8619334` · Prostredie: 11. reset session (obnovené, viď §E)
> Zdrojový workflow (referencia): `aiktivista.sk/omnistrih.html` (Google Flow / Omni — prompt-based, klipy do 10 s, referenčný grid 1×4)

**Legenda (povolené hodnoty):** `YES` · `NO` · `PARTIAL` · `UNKNOWN`
**Platí:** IMPLEMENTED ≠ WIRED ≠ UI VISIBLE ≠ INTERACTIVE ≠ REAL DATA ≠ RUNTIME VERIFIED

---

## 0. MATICA REALITY GATE

| Oblasť | Code Exists | Wired | UI Visible | Interactive | Real Data | Runtime Verified | Reusable |
|---|---|---|---|---|---|---|---|
| **Canonical Project (ProjectModel)** | YES | PARTIAL | NO | NO | NO | NO | YES |
| **CommandManager (41 commands)** | YES | PARTIAL¹ | NO | NO | NO | NO | YES |
| **PlayheadStore** | YES | YES | PARTIAL | YES | YES | UNKNOWN | YES |
| **Sequence / Track / Clip model** | YES | PARTIAL¹ | NO | NO | NO | NO | YES |
| **MediaAsset + import do projektu** | YES | PARTIAL¹ | NO | NO | NO | NO | YES |
| **OPFS / IndexedDB storage** | YES | PARTIAL | NO | NO | UNKNOWN | UNKNOWN | YES |
| **Snapshot / Rollback (commands)** | YES | NO² | NO | NO | NO | NO | YES |
| **DirectorEngine (plan, review)** | YES | PARTIAL³ | PARTIAL | PARTIAL | PARTIAL | NO | YES |
| **Dynamic `DirectorPlan`/`EditDecision` (live)** | YES | YES | YES | YES | PARTIAL⁴ | YES⁵ | YES |
| **Transcript – reálne audio (`/api/transcribe-speech`)** | YES | PARTIAL⁶ | YES⁷ | YES | **NO**⁸ | NO⁸ | YES |
| **Transcript – „rýchla“ cesta (`/api/transcribe-video`)** | YES | YES | YES | YES | **NO**⁹ | YES (vracia vymyslený text) | NO |
| **Word timestamps** | YES | YES | PARTIAL | PARTIAL | NO⁸ | YES (na vstupe, ktorý dodám) | YES |
| **Sentence boundaries / pauzy (wordTiming)** | YES | YES | YES | PARTIAL | NO⁸ | YES | YES |
| **Vetné/hustotné pravidlá pre style intelligence** | PARTIAL¹⁰ | NO | NO | NO | NO | NO | PARTIAL |
| **Speaker activity / diarizácia** | PARTIAL¹¹ | NO | NO | NO | NO | NO | UNKNOWN |
| **Scene / shot analysis (server)** | **NO**¹² | NO | NO | NO | NO | NO | — |
| **Scene / shot analysis (klient, LocalVisionProvider)** | YES | PARTIAL¹³ | YES¹⁴ | PARTIAL | UNKNOWN | **NO** | YES |
| **Audio analysis (VAD, ticho)** | YES | PARTIAL¹³ | YES¹⁴ | PARTIAL | UNKNOWN | **NO** | YES |
| **Beat analysis** | PARTIAL¹⁵ | PARTIAL | YES | YES | UNKNOWN | NO | PARTIAL |
| **Preview engine (VideoPlayer)** | YES | YES | YES | YES | YES | YES¹⁶ | YES |
| **`zoomCues` / `sfxCues` v prehrávači** | YES | YES | YES | PARTIAL | YES | UNKNOWN | YES |
| **`zoomCues` / `sfxCues` v exporte** | **NO**¹⁷ | NO | NO | NO | NO | NO | — |
| **Transitions (`TransitionPresetDrawer`)** | YES | YES | YES | YES | YES | NO | YES |
| **Export: titulky do obrazu (ffmpeg)** | YES | YES | YES | YES | YES | **YES**¹⁸ | YES |
| **Export: čistý strih (packet copy)** | YES | YES | YES | YES | YES | **YES**¹⁸ | YES |
| **Export: ExportModal + WebCodecs backend** | YES | **NO**¹⁹ | NO | NO | NO | NO | YES |
| **Export: MultiPlatformExport** | YES | YES | YES | YES | **NO**²⁰ | NO | NO |
| **AI provider abstraction (`AIProvider`)** | YES | PARTIAL | PARTIAL | PARTIAL | NO²¹ | NO | YES |
| **Lokálne modely (transformers.js)** | YES | PARTIAL²² | YES | YES | UNKNOWN | **NO** | YES |
| **Gemini (text/vision cez server)** | YES | YES | YES | YES | **NO**²³ | NO | YES |
| **Image generation** | **NO** | NO | NO | NO | NO | NO | — |
| **Video generation** | **NO** | NO | NO | NO | NO | NO | — |
| **Reference image analýza (reálna)** | **NO**²⁴ | NO | NO | NO | NO | NO | — |
| **Reference image analýza (existujúca „analyzer“)** | YES | YES²⁵ | YES | YES | **NO**²⁶ | NO | NO |
| **Storyboard (textové panely)** | YES | YES²⁷ | YES | PARTIAL | NO²⁸ | NO | PARTIAL |
| **Storyboard so snímkami** | **NO** | NO | NO | NO | NO | NO | — |
| **`src/visual/*` (16 súborov, 2148 riadkov)** | YES | PARTIAL²⁹ | YES³⁰ | PARTIAL | NO | **NO**³¹ | PARTIAL |
| **Apply: Director Plan → live strih** | YES | YES | YES | YES | PARTIAL⁴ | YES³² | YES |
| **Apply: B-roll / Attention (live)** | YES | YES | YES | YES | NO | **NO**³³ | NO |
| **Frame cache** | **NO** | NO | NO | NO | NO | NO | — |
| **WebGPU compositor** | **NO** | NO | NO | NO | NO | NO | — |
| **Web Workery (proxy/thumb/waveform)** | YES | PARTIAL | PARTIAL | UNKNOWN | YES | UNKNOWN | YES |

### Poznámky k matici (čo presne to znamená)

1. `CoreEngine` singleton (`src/core/index.ts:617`) **vytvára** `new CommandManager(createInitialProject())` (riadok 167) a má celé API (`importMediaFile`, `addClip`, `setTransform`, `setTransition`, `generateCaptions`, `createEditDecision`…). **Ale žiadna obrazovka ho nepoužíva.** Jediný konzument s reálnou render cestou je `ExportModal`, ktorý **nie je nikde vykreslený**.
2. `CreateProjectVersionCommand` / `RestoreProjectVersionCommand` existujú, ale v žiadnom `.tsx` sa nevyskytujú → CORE ONLY.
3. `DirectorEngine.generateDirectorPlan` / `safeBatchApply` / `validatePlanConflicts` existujú a sú použiteľné; živá vetva používa vlastnú obdobu `handleApplyDirectorPlan` (`src/App.tsx:1843`).
4. Živý plán je reálny **len ak** príde text z reálneho prepisu; bez kľúča je vstup vymyslený (pozri 8/9).
5. Overené mnou naživo: `App.tsx` → markery, EDL, render.
6. Volá ho `AutoVideoCaptionsPanel` (`/api/transcribe-speech` s `audioBase64`) — reálna cesta existuje.
7. `AutoVideoCaptionsPanel` je vykreslený (App.tsx:3814).
8. **Bez Gemini kľúča nefunguje** — stav práve teraz: `/api/health` → `hasGeminiKey:false, totalKeys:0`.
9. `App.tsx:2178` posiela `/api/transcribe-video` **len** `filename, topic, duration, style` — **nie médium**. Server má fallback, ktorý pri chýbajúcom kľúči vygeneruje vymyslené slovenské vety s vymyslenými časmi.
10. `wordTiming.ts` má vetné hranice a pauzy; „hustota informácií / emocionálne beaty“ neexistujú.
11. `transcript.segments` majú pole `speaker`, ale žiadna diarizácia sa nerobí.
12. `/api/analyze-video` **neanalyzuje video** — prijíma `topic, duration, category, rawTranscript` (text) a generuje marketingový plán.
13. `LocalVisionProvider` (klient) vzorkuje snímky cez `OffscreenCanvas` (1 snímka/s); `LocalVADProvider` existuje — obe sú za `LocalAIControlCenter`, ktorý je v UI (App.tsx:4374).
14. `LocalAIControlCenter` je vykreslený, ale či modely naozaj načítajú a spracujú, **nebolo overené v prehliadači** (chýba browser automation) → NOT VERIFIED.
15. Existuje `BeatSyncStudio` + `handleAnalyzeBeats` v `App.tsx` (stav + UI).
16. Overené nepriamo: prehrávač hrá a reaguje na `zoomCues`; samotné vykreslenie zoomu v prehliadači som nemeral.
17. `smartCutRenderer.ts` ani `subtitleRender.ts` `zoomCues`/`sfxCues` **nečítajú** (grep = 0) → **preview ≠ export** (porušuje bod 21 zadania).
18. **REAL EXPORT VERIFIED** — mnou merané: profil so zlatou `#FFC400` → 12 994 zlatých pixelov vo výslednom MP4; klip 3,2 s, rozmery a fps zachované.
19. `ExportModal` je lazy-importovaný (App.tsx:22), ale `<ExportModal` sa v `App.tsx` **nenachádza** → orphaned.
20. `handleStartMultiExport` (`App.tsx:938`) simuluje priebeh v `setTimeout` a **nevytvára súbor**.
21. `@google/genai ^2.4.0` je v závislostiach; lokálne providery používajú `@huggingface/transformers ^4.3.0`.
22. 5 providerov existuje; `LocalTTSProvider` má **placeholder** tón (`// Create synthetic sine wave placeholder`).
23. Práve teraz 0 kľúčov → AI cesta nepobeží.
24. Neexistuje žiadny modul na analýzu obrázka podľa pixelov.
25. `AIVisualDirectorCenter` (tab `ai_visual_director`) je v UI.
26. `ReferenceStyleAnalyzer.analyzeReferenceStyle(referenceName, projectId)` rozhoduje podľa **názvu súboru** (`if (nameLower.includes("clean"))`) → fake analýza.
27. `AIStoryboardPanel` je vykreslený vo vnútri `AIVisualDirectorCenter`.
28. Panely sú textové popisy, žiadne snímky z videa.
29. `src/visual/*` používajú 4 komponenty (`AIVisualDirectorCenter`, `AIStoryboardPanel`, `VisualReviewCenter`, `EditingBrainPanel`).
30. Tab `ai_visual_director` je dostupný v UI.
31. V `tests/` **neexistuje ani jeden test** pre `src/visual/*` (grep = 0).
32. Overené naživo (markery/EDL → render).
33. `handleApplyBroll` a `handleApplyAttentionSuggestion` nastavia príznak `isApplied/applied: true` a zobrazia toast „aplikované na timeline“ — **nič sa nezmení**. Označené `IMPLEMENTED BUT NOT FUNCTIONALLY APPLIED`.

---

## 1. INVENTORY (pred kódom)

### 1.1 Existujúce komponenty (presné názvy)
`RawToReadyPipeline`, `DirectorPlanPanel`, `RetentionShortPanel`, `BurnCaptionsPanel`, `CaptionProfileBar`, `CaptionStylePreview`, `TrendRadar`, `LiveSignalsPanel`, `VideoPlayer`, `TimelineControls`, `ProTimeline`, `SmartCaptionEditor`, `AutoVideoCaptionsPanel`, `BilingualEditor`, `AIBrollEngine`, `TransitionPresetDrawer`, `VisualAttentionStudio`, `ObjectEraserSuite`, `ExportModal`, `MultiPlatformExport`, `ContentPackMachine`, `AIVisualDirectorCenter`, `AIStoryboardPanel`, `VisualReviewCenter`, `LocalAIControlCenter`.

### 1.2 Služby
- **Server (`server.ts`, 3845+ riadkov):** `/api/health`, `/api/keys*`, `/api/analyze-video`, `/api/transcribe-video`, `/api/transcribe-speech`, `/api/detect-burned-subtitles`, `/api/director/plan`, `/api/export/{ffmpeg,upload,burn-captions,burn-captions/status,burn-captions/cancel,file,status}`, `/api/trends/{status,signals,refresh,settings}`, `/api/captions/profiles`, `/api/ai-voice/*`.
- **Klient:** `src/core/ai/{analysisEngine,analysisCache,editingBrain,knowledgeBase,creativeHub,directorEngine}.ts`, `src/core/trends/*`, `src/core/learning/editDna.ts`, `src/core/retention/retentionEngine.ts`, `src/core/transcript/wordTiming.ts`, `src/core/export/*`.

### 1.3 Commands (41, `src/core/command/commandSystem.ts`)
Relevantné pre Style Studio: `AddClipCommand`, `RemoveClipCommand`, `SplitClipCommand`, `TrimClipCommand`, `MoveClipCommand`, `SetTransformCommand`, `SetTransitionCommand`, `UpdateClipPropsCommand`, `InsertEditCommand`, `OverwriteEditCommand`, `GenerateCaptionsCommand`, `CreateEditDecisionCommand`, `UpdateEditDecisionStatusCommand`, `CreateProjectVersionCommand`, `RestoreProjectVersionCommand`, `AddMarkerCommand`.
**Nový command nie je potrebný** (bod 17 zadania splnený na úrovni existujúceho inventára).

### 1.4 DirectorEngine — presné cesty
`src/core/ai/directorEngine.ts`

| Funkcia | Input | Output | Stav napojenia |
|---|---|---|---|
| `generateDirectorPlan(...)` | projekt + brief | `DirectorPlan` | code-level (volá ho `DirectorPlanCenter`?) |
| `generateBriefAndPlan(...)` | projekt + intent | plán + brief | **PARTIAL** (UI: `AIVisualDirectorCenter`/`DirectorProductionCenter`) |
| `safeBatchApply(cm, plan, ids)` | `CommandManager` + prijaté id | `{success, appliedCount, snapshotVersionId, error}` | **code-level** (nepoužité v UI) |
| `validatePlanConflicts(plan, project)` | plán + projekt | `{valid, conflicts, updatedPlan}` | code-level |
| `compareUserAndAiEdits(project, plan)` | projekt + plán | `EditComparison[]` | code-level |
| `conductReview(...)` | plán | `DirectorRevisionPlan` | code-level |
| **Živá obdoba** `handleApplyDirectorPlan` | prijaté zásahy | `DirectorApplyReport` | **WIRED + runtime overené** |

### 1.5 Media pipeline
Import: `<input file>` → `App.tsx` (`getSourceBlobForRender`) → server `/api/export/upload` → `.data/uploads`; **paralelne** existuje `CoreEngine.importMediaFile(file, trackType)` (code-level, nepoužité).
Dekódovanie/analýza: `LocalVisionProvider` (klient), `LocalVADProvider`, `/api/transcribe-speech` (server, reálne audio → Gemini).
Workery: `src/workers/{proxyWorker,thumbnailWorker,waveformWorker}.ts`.
Cache: `src/ai/cache/aiCache.ts`, `src/core/ai/analysisCache.ts`, server `.data/trends-cache.json`.
Preview: `VideoPlayer` (live), `RenderBackendSelector` → `WebCodecsOfflineBackend` (canonical).
Export: `/api/export/burn-captions` (ffmpeg) a `smartCutRenderer` (packet copy).

### 1.6 Timeline
- **Kanonický model:** `ProjectModel` → `SequenceModel` → `TrackModel` → `ClipModel` (`src/core/types/project.ts`), s `transform`, `crop`, `colorCorrection`, `effects[]`, `transitions{in,out}`, `textConfig`, `captionStyle`, `keyframes[]`.
- **Živá os:** `ProTimeline` je **len scrub bar** (props: `duration, currentTime, isPlaying, onSeek, onTogglePlay, language`) — **nie je to clip timeline**.
- **Zmeny v živom workflow:** markery v `jumpSequence` (CUT/KEEP), `zoomCues`, `sfxCues`, EDL pre server.

### 1.7 Preview (presná cesta)
`App.tsx` → `<VideoPlayer>` (element `<video>`) + `zoomCues`/`sfxCues`; seek cez `playheadStore` + EDL preskakovanie (`nextKeepTime`). **Jediný preview engine.**

### 1.8 Export (presné cesty)
1. `/api/export/burn-captions` → ffmpeg (strih + ASS titulky) → súbor v `.data/exports` → `GET /api/export/file/<meno>` — **REAL EXPORT VERIFIED**.
2. `src/core/export/smartCutRenderer.ts` → MP4 bez prekódovania — **REAL MEDIA VERIFIED**.
3. `ExportModal` → `RenderBackendSelector` → `WebCodecsOfflineBackend` alebo `RealtimeCanvasBackend` → `.webm` — **orphaned, NOT VERIFIED**.
4. `MultiPlatformExport` → simulovaný priebeh — **nevytvára súbor**.

### 1.9 AI providers
Rozhranie `AIProvider<TInput,TOutput>` (`src/ai/types/ai.ts:70`): `getStatus`, `subscribe`, `loadModel`, `unloadModel`, `cancel`, `retry`, `process`.
Reálne implementované (kód): `LocalSpeechProvider` (transformers.js), `LocalVADProvider`, `LocalVisionProvider`, `LocalEmbeddingProvider`; **`LocalTTSProvider` má placeholder tón**.
Server: Gemini (`@google/genai`) — **bez kľúča nefunguje** (stav: 0 kľúčov).
**Image generation: NOT AVAILABLE. Video generation: NOT AVAILABLE. Reference image analysis (pixelová): NOT AVAILABLE.**

### 1.10 Snapshot / Rollback
`CreateProjectVersionCommand` (snapshot do `project.versions[]`) + `RestoreProjectVersionCommand` (obnova). **Použité iba v kóde (`DirectorEngine.safeBatchApply`), v UI nikde** → CORE ONLY, NEFUNGUJE v používateľskom toku.

---

## 2. IMPLEMENTATION GATE

| Kategória | Čo sem patrí |
|---|---|
| **AVAILABLE NOW** | `wordTiming` (vety, pauzy, silné slová), plán/EDL, ffmpeg export titulkov, packet-copy strih, `VideoPlayer` preview, `TransitionPresetDrawer`, `CaptionProfileBar` (brand kit), Trend Radar, `DirectorEngine` knižnica, 41 commands, `PlayheadStore` |
| **AVAILABLE BUT NOT WIRED** | `CoreEngine` + `CommandManager` (nikto ho nevolá), `CreateProjectVersionCommand`/`RestoreProjectVersionCommand` (v UI nikde), `ExportModal` (nie je vykreslený), `src/visual/*` (plán sa nikam nezapíše), `CoreEngine.importMediaFile` |
| **PARTIAL** | DirectorEngine (`safeBatchApply` nepoužitý), storyboard (text bez snímok), `zoomCues`/`sfxCues` (len preview), lokálne modely (existujú, v prehliadači neoverené) |
| **NOT AVAILABLE** | Scene/shot analysis na serveri, **frame cache**, **WebGPU compositor**, **image generation**, **video generation**, **pixelová analýza referenčného obrázka**, storyboard so snímkami, diarizácia rečníkov |
| **REQUIRES REAL AI PROVIDER** | Reálna transkripcia (Gemini kľúč), AI vizuálne koncepty, generované vizuály (dnes NEMÁME provider) |
| **REQUIRES GPU** | WebCodecs/WebGPU render v prehliadači (pre Style Studio **nie je potrebný** — plné rozlíšenie zvládne serverový ffmpeg) |
| **CAN RUN LOCAL-FIRST** | `StyleRecipe` + presety, style intelligence z existujúceho transkriptu, storyboard z reálnych snímok na `canvas`, náhľad, snapshot/rollback stavu |
| **IMPLEMENTED BUT NOT FUNCTIONALLY APPLIED** | `handleApplyBroll`, `handleApplyAttentionSuggestion`, `handleStartMultiExport`, `ReferenceStyleAnalyzer` |
| **UI PRESENT — FUNCTIONALITY NOT VERIFIED** | `AIVisualDirectorCenter`, `AIStoryboardPanel`, `VisualReviewCenter`, `LocalAIControlCenter`, `BeatSyncStudio` |

---

## 3. NÁVRH IMPLEMENTÁCIE (v poradí z bodu 40 zadania)

**Kľúčové rozhodnutie (bez neho by APPLY bol fake):** kanonická vrstva dnes **nie je napojená na žiadnu obrazovku**. Preto navrhujem presne to, čo zadanie žiada, ale s dôkazom:

1. **StyleRecipe + presety** — `src/core/style/styleRecipes.ts` (10 štýlov vrátane Editorial Collage a Custom briefu). Žiadny nový model — `StyleRecipe` určuje len „AKO“.
2. **Style intelligence** — `src/core/style/styleDirector.ts`, ktorý **rozširuje existujúci `DirectorEngine`** (nie nový Director) a stavia na `wordTiming` (vety, pauzy, silné slová). Žiadne „každé 2 sekundy“.
3. **EditDecision[]** s WHAT / WHEN / WHY / **WHEN NOT** / ALTERNATIVE / CONFIDENCE — zapisované cez existujúci `CreateEditDecisionCommand` do `project.decisions`.
4. **UI v existujúcom workflow** — nová sekcia v kroku 3 (DIRECTOR PLAN) / nový tab `visual_style` s presne zadanými ovládačmi (intensity, talking head ratio, motion, typography, reference image, generated visuals, preserve audio = ON).
5. **Snapshots** — `CreateProjectVersionCommand` pred apply (existujúci command).
6. **Apply** — `CoreEngine` + existujúce commands (`AddClipCommand` pre supporting visuals na b-roll track, `SetTransformCommand` pre punch-in, `SetTransitionCommand` pre whip-pan, `UpdateEditDecisionStatusCommand`). **Dôkaz:** JSON projektu pred/po + test „APPLY naozaj zmenil projekt“ + rollback test (presná zhoda JSON).
7. **Preview + Export z tej istej osi** — náhľad v existujúcom `VideoPlayer`; export cez existujúci server `burn-captions` (tam doplním punch-in/typography/transition), aby platilo **preview = export**.
8. **Reference image** — **NOT AVAILABLE** (pixelová analýza ešte nie je) → tlačidlo bude písať „REFERENCE ANALYSIS — NOT AVAILABLE“, žiadna fake analýza; starej fake ceste (podľa názvu súboru) **odoberiem** tvárenie sa ako analýza.
9. **Style Board** — **GENERATE STYLE BOARD: PROVIDER UNAVAILABLE** v UI (žiadny fake obrázok). Reálne panely (snímky z videa + text nad nimi) prídu ako lokálna funkcia bez providera.
10. **Generated visuals** — `Off / Suggested / Automatic`; dnes len „Use Existing Media“, tlačidlo „Generate Visual“ sa **nezobrazí**, kým provider neexistuje.

**Povinné značenie pri každom výsledku:** UNIT TESTED / BROWSER VERIFIED / REAL MEDIA VERIFIED / REAL EXPORT VERIFIED / NOT VERIFIED. „REAL VIDEO GENERATION VERIFIED“ sa nikdy neobjaví — provider nebol spustený (neexistuje).

---

## E. DÔKAZY Z TOHTO AUDITU (čo som naozaj spustil)

| Príkaz / kontrola | Výsledok |
|---|---|
| `bun test tests/` | **275 pass / 0 fail / 1421 expect** (10 súborov) |
| `bun run lint` | **0 chýb** |
| `git rev-parse origin/main` | `8619334` |
| byte-verify 6 kľúčových súborov | **zhoda 6/6** (po 11. resete prostredia nič nestratené) |
| `curl /api/health` | `{"status":"ok","hasGeminiKey":false,"totalKeys":0,"activeKeys":0}` |
| `curl /api/export/ffmpeg` | `available: true` |
| `curl /api/trends/status` | `success: true` (bez kľúča funguje) |
| `curl /` | HTTP 200 (appka beží) |
| `grep "new CommandManager"` | 1× — `src/core/index.ts:167` (vo vnútri `CoreEngine`) |
| `grep "<ExportModal"` | **0×** → orphaned |
| `grep "CreateProjectVersionCommand" src/**/*.tsx` | **0×** → core only |
| `grep "zoomCues\|sfxCues"` v exportných moduloch | **0×** → preview ≠ export |
| testy pre `src/visual/*` | **0** |
| `App.tsx:1190` → `completeRawAnalysis()` | hardcoded dáta: `OMNISTRIH_RAW_4K.mp4`, 2712 s, 3840×2160, vymyslená transkripcia |
| `App.tsx:2178` → `/api/transcribe-video` | posiela `filename, topic, duration, style` (bez média) |

**Bez kľúča (stav teraz) sú AI závislé funkcie NEFUNKČNÉ — vrátane reálnej transkripcie.**
Toto je najdôležitejší fakt pre Style Studio: style intelligence **musí fungovať aj bez AI** (deterministicky z existujúcich dát), inak by bola fake.

---

## F. OTVORENÉ ROZHODNUTIE

1. **Apply cieľ:** navrhujem zapojiť **kanonickú vrstvu** (`CoreEngine` + existujúce commands) tak, aby APPLY menil reálny `ProjectModel` — s dôkazom JSON pred/po — a súčasne zrkadliť zmeny do živého renderu (server ffmpeg), aby používateľka hneď videla video. Bez tohto by APPLY bol `plan.status = EXECUTED` a nič viac.
2. **Poradie:** najprv StyleRecipe + presety + intelligence + StylePlan + review (bez providera, plne lokálne a testovateľné), potom Apply + snapshot/rollback, potom render (preview = export), až nakoniec Reference/Style Board s poctivým „NOT AVAILABLE“.
