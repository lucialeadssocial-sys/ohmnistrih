# KROK 16 — STYLE-TO-TIMELINE REALITY GATE

**Dátum:** 30. 9. 2026 · **Východzia main:** `909b16e` (krok 15, PR #38)
**Otázka zadania:** *„Keď vyberiem Editorial Collage a stlačím Apply Style, zmení sa skutočný canonical timeline?“*
**Odpoveď:** **ÁNO — REAL MEDIA VERIFIED** (dôkaz BEFORE → accepted/editované EditDecision → CommandManager → AFTER nad reálnym videom, s rollbackom).

Nikde v tejto správe nie je nič „aplikované“ len preto, že sa zmenil status, plán alebo text v UI.
Každé tvrdenie nižšie má buď meranie, alebo je označené ako **NOT VERIFIED**.

---

## 0) Reality check PRED kódom (bez neho by kód nemal zmysel)

| Čo sa overovalo pred písaním kódu | Zistenie |
|---|---|
| Existuje celý reťaz Style → EditDecision → CommandManager → canonical? | **ÁNO** — `styleApply.ts` (krok 5–6): `applyStylePlan`, `rollbackStyleApply`, `fingerprintStyleState`, 3 mutačné cesty (titulok `addClip`, `setTransform`, b-roll `addClip`) |
| Existuje Review (Accept/Reject)? | **ÁNO** — `StyleStudioPanel.tsx` (`mark()`, `decisionIds`) |
| Dá sa rozhodnutie **upraviť** (Edit) pred zápisom? | **NIE** — chýbal jediný kus reťaze |
| Existuje command na zmenu priblíženia a titulku? | **ÁNO** — v inventári 42 commands; **žiadny nový command netreba** (žiadna „COMMAND GAP“) |
| Existuje snapshot/rollback? | **ÁNO** — `CommandManager` (snapshot l. 129, restore l. 135) |
| Vie preview aj export čítať tú istú canonical os? | **ÁNO** — `buildCanonicalFramePlan` + `CanonicalExportPanel` |
| Treba nový editor / timeline model / AI Director / render engine? | **NIE** — zakázané a ani nebolo potrebné |

**Záver reality checku:** reťaz existovala, medzera bola iba v tom, že používateľ nemohol rozhodnutie *upraviť* a že to nebolo nikdy dokázané na **reálnej zmene canonical osi**. Krok 16 preto nedopĺňa nový mechanizmus, ale **uzatvára a dokazuje** ten existujúci.

---

## 20) Finálny report

### A) Reťaz Style → canonical timeline

| Oblasť | Status | Dôkaz |
|---|---|---|
| StyleRecipe + presety (Editorial Collage) | **REAL MEDIA VERIFIED** | `je v presets: true`, `provider receptu: NONE (deterministické)` — `docs/style-to-timeline-output.txt` §3 |
| Style Intelligence (WHAT/WHEN/WHY/WHEN NOT/ALTERNATIVE/CONFIDENCE) | **REAL MEDIA VERIFIED** | 15 rozhodnutí, `presnosť časov z dát: words`, `podiel rečníka 30 % (recept 30 %)`, klasifikácia `LOCAL DETERMINISTIC HEURISTIC` §3 |
| Reálny prepis + wordTiming | **REAL MEDIA VERIFIED** | `prepis (HTTP) 200 | success=true | hasSpeech=true` (živé volanie appky na 20,27 s reálnom videu) §2 |
| Review: Accept | **REAL MEDIA VERIFIED** | 2 prijaté; apply beží len na prijaté §4, §6 |
| Review: **Edit** (nové v kroku 16) | **REAL MEDIA VERIFIED** | text `„Za päť minút“` → `„UPRAVENÉ POUŽÍVATEĽOM: 3 000 €“`; priblíženie **1,30** (recept 1,12); poznámka „s TVOJIMI hodnotami“ §4, §6 |
| Review: Reject | **REAL MEDIA VERIFIED** | zamietnuté `talking_head` → `zamietnuté rozhodnutie v osi: žiadny klip / žiadny efekt` §4, §7 |
| Snapshot pred Apply | **REAL MEDIA VERIFIED** | `snapshot verzia: ver_5da8cfa2-d813-42e0-bc50-67a1271d053c` §6 |
| **Apply → CommandManager → SKUTOČNÁ canonical zmena** | **REAL MEDIA VERIFIED** | `aplikované / dodržané / nevykonané: 2 / 0 / 0`, `časová os zmenená: true` §6 |
| BEFORE ≠ AFTER (klipy/časy/transformácie/texty) | **REAL MEDIA VERIFIED** | `+ style_caption_xnrsex [caption] 0,2–5,5 s „UPRAVENÉ POUŽÍVATEĽOM: 3 000 €“`, `~ clip_main_video: scale 100 → 130`, `BEFORE ≠ AFTER: true`, `visualJson zmenený: true` §7 |
| Pôvodné audio chránené | **REAL MEDIA VERIFIED** | `audioJson nezmenený (bajty): true` + `audio nedotknuté (bajty): true` §6, §7 |
| Rollback | **REAL MEDIA VERIFIED** | `obnovené presne (bajty): true`, klipy späť 1/0/0; jediný rozdiel `verzie` (projekt si schváne drží odkaz na verziu pred aplikovaním) §9 |
| Preview parity | **PREVIEW PARITY — OK (dátová cesta)** | vrstvy @0,4 s: 1 → 2 (text `UPRAVENÉ POUŽÍVATEĽOM: 3` + obraz), rovnaká funkcia `buildCanonicalFramePlan` ako export §8 |
| Exportný plán z tej istej osi | **REAL MEDIA VERIFIED** | 1 titulok, 1080×1920, `parity: sedí (chýbajúce texty: 0, navyše: 0)`, `upravený text v export pláne: áno`, `blokery: žiadne` §8b |
| Svetlo (`measuredLight`) | **MEASURED STYLE PARAMETER — NOT WIRED TO RENDER** | je v recepte a v WHY, ale render engine ho nekreslí; nikde sa netvrdí opak |
| Generované vizuály | **PROVIDER UNAVAILABLE** | `PROVIDER UNAVAILABLE — generovanie vizuálov nie je dostupné (žiadny provider)`; `generated_visual` sa **nikdy** neprijme |
| Prehliadačové UI (tlačidlá „Upraviť“, canvas) | **NOT VERIFIED (v prostredí nie je DOM)** | SSR prostredie bez DOM; UI je prítomné (`Pencil` + mini-editor), správanie v prehliadači netestované |

### B) Testy a build

| Oblasť | Status | Dôkaz |
|---|---|---|
| TEST RESULTS | **UNIT TESTED** | `bun test` → **653 pass / 0 fail / 3274 expect() / 26 files** (z toho 21 testov A–D práve pre Review+Edit) |
| BUILD | **PASS** | `bunx vite build` → `built in 2.69s`, exit 0 (súbor `index-CDHX_z2L.js`, 1457,59 kB) |
| LINT / type safety | **PASS** | `bun run lint` (`tsc --noEmit`) → exit 0 |
| REAL MEDIA | **REAL MEDIA VERIFIED** | `tools/verify-style-to-timeline.ts` na `/home/user/real-media/real_speech.mp4` (345 651 B, 20,27 s) |
| REAL EXPORT | **REAL EXPORT VERIFIED** | `/home/user/export-krok16-editorial.mp4` (490 104 B, 20,27 s, 1080×1920, video+audio, titulky z canonical osi v obraze, `hash zvuku zdroj → výstup: 511feee27c325b3d → 511feee27c325b3d`) |
| FAIL | **žiadne** | 0 fail v testoch, 0 v lint, 0 v build, 0 v real-media, 0 v exporte |

### C) Nové API kroku 16 (`src/core/style/styleApply.ts`)

| Prvok | Význam |
|---|---|
| `StyleDecisionEdit` | používateľské hodnoty: `typographyText` (≤240 znakov, prázdny sa neprijme), `punchInScale` (clamp 1,00–1,60), `motion`, `composition`, `elementType`, `noteSk` |
| `applyStylePlan(host, plan, { decisionIds, edits })` | Apply berie aj upravené hodnoty — ide to cez ten istý CommandManager, žiadna tichá mutácia |
| `reviewStyleDecision(decision, edit)` | čistá funkcia → `{ decision, changedSk, ignoredSk }` (deterministická, testovaná: clamp, `NaN`, neznáme hodnoty, `generated_visual` zamietnutý, WHEN sa needituje) |
| `recordOrRevert()` | keď sa rozhodnutie nepodarí zapísať, zmena sa **VRÁTI** a krok je `SKIPPED` — appka to napíše, nezamlčí |
| `CoreEngine.undoLastCommand()` | poistka pre `recordOrRevert` (bez nej by appka zmenu nevedela vrátiť a prizná to) |

### D) Čo tento dôkaz NEznamená (poctivo)

* **Prehliadač (BROWSER VERIFIED) — netestované.** V prostredí nie je DOM, takže tlačidlá „Upraviť“ / „Uložiť a prijať“ / „Zrušiť úpravu“ som v prehliadači neskúšal: **UI PRESENT — FUNCTIONALITY NOT VERIFIED**.
* Runner volá API bežiacej appky — **obchádza UI** (rovnaká cesta ako krok 8–15).
* Farebný filter v exporte je **aproximácia** (CSS percepčné vs ffmpeg lineárne), easing animovaného priblíženia je **lineárny**, zvuk sa porovnáva **obsahovo (PCM)**, nie bajtovo v AAC.
* Svetlo a generované vizuály sú označené vyššie — **nič sa negenerovalo ani nekreslí**.
* Preview parity je dôkaz **dátovej cesty** (rovnaká canonical os a rovnaká funkcia plánu snímky), nie pixelová zhoda náhľadu a exportu.

---

## Odpoveď na konečnú otázku

> „Keď vyberiem Editorial Collage a stlačím Apply Style, zmení sa skutočný canonical timeline?“

**ÁNO.** Reťaz je doložená na reálnom videu, nie na pláne:

```
reálne video (20,27 s) + reálny prepis (HTTP 200, wordTiming)
   → StyleRecipe EDITORIAL_COLLAGE (deterministicky, bez AI providera)
   → 15 rozhodnutí (WHAT / WHEN / WHY / WHEN NOT / ALTERNATIVE / CONFIDENCE)
   → Review: 2 prijaté · 2 upravené · 1 zamietnuté
   → snapshot ver_5da8cfa2-… (pred zápisom)
   → CommandManager → CANONICAL TIMELINE
        + titulok „UPRAVENÉ POUŽÍVATEĽOM: 3 000 €“ (0,2–5,5 s)
        ~ priblíženie clip_main_video 100 % → 130 %
   → BEFORE ≠ AFTER (true) · audio nezmenené (bajty) · zamietnuté rozhodnutie bez efektu
   → preview parity OK (rovnaká os) → export plán z tej istej osi (bez blokérov)
   → rollback: obnovené presne (bajty) true
```

Dôkazy: `docs/style-to-timeline-output.txt` (168 riadkov, meranie), `/home/user/kontrola-krok16-style-to-timeline.json` (strojová evidencia) a `docs/real-export-krok16-output.txt` (zmeraný hotový MP4).

**Klasifikácia celku:** `REAL MEDIA VERIFIED` + `REAL EXPORT VERIFIED` pre reťaz Style → canonical → export.
`NOT VERIFIED`: prehliadačové UI. `PROVIDER UNAVAILABLE`: generované vizuály. `NOT WIRED TO RENDER`: merané svetlo.
