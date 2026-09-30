# KROK 0c — JEDNA HLAVA DIRECTORA (zjednotenie troch rozhodovacích ciest)

> Podklad: `docs/CREATIVE_DIRECTOR_INTELLIGENCE_REPORT.md`, bod D.3/D.4 (poradie 0 → 0b → **0c** → 1…5).
> **Reality Gate pred kódom:** najprv audit, potom zmena. Nič sa neprestavalo, žiadny nový Director nevznikol.

---

## 1. Reality Gate — stav PRED krokom 0c (audit kódu, nie dojem)

| Oblasť | Kód existuje | Zapojené | Má UI | Je interaktívne | Reálne dáta | Beží za behu | Znovupoužiteľné |
|---|---|---|---|---|---|---|---|
| A. `DirectorEngine.generateDirectorPlan` (`src/core/ai/directorEngine.ts:227`) | YES | YES (`CoreEngine`, `DirectorPlanCenter`, `DirectorProductionCenter`) | PARTIAL | NO (len generovanie) | **YES** — len z `project.analysisResults` (od kroku 29) | YES | YES |
| B. `POST /api/director/plan` (`server.ts:1401`) | YES | YES (`DirectorPlanPanel.tsx:226`) | YES | YES (prijatie/zamietnutie zásahov) | PARTIAL — text prepisu; **server nevidí projekt ani nameranú analýzu** | YES | PARTIAL |
| C. `directorTools` (`src/ai/director/directorTools.ts`, 721 r.) | YES | YES (`DirectorStudio.tsx`) | YES | YES (návrhy mutácií) | PARTIAL — číta Media Index, ale Index bol donedávna z veľkej časti vymyslený (krok 30b to opravil) | YES | YES |
| D. Slovník zásahov (`DirectorActionType`, `DirectorPlanItem`) | YES | YES | YES | — | — | — | **NO — 3 kópie** (`server.ts`, `DirectorPlanPanel.tsx`, engine) |
| E. Cieľ videa | YES (`src/core/style/videoGoal.ts`, krok 26, 9 cieľov) | YES (Style Studio) | YES | YES | — | YES | NO — **druhý, paralelný slovník** `DIRECTOR_MODES` (SOCIAL/ADS/…) |

**Nález, ktorý to celé spôsobil:** o tej istej veci (čo je cieľ videa a aké zásahy existujú)
rozhodovali **tri kópie** a **dva slovníky**. Kópia sa mohla pohnúť inam — a potom panel
zobrazuje niečo iné, než server prijme.

---

## 2. Čo som spravil (a čo to naozaj zmenilo)

| # | Zmena | Súbor | Čo to rieši |
|---|---|---|---|
| 1 | **Jeden slovník zásahov a režimov** | `src/core/ai/directorVocabulary.ts` (nový) | `DirectorActionType`, `DirectorPlanItem`, `DIRECTOR_MODES`, `DIRECTOR_ACTION_TYPES` a validácia typu sú na jednom mieste |
| 2 | Server importuje spoločný slovník | `server.ts` | zmazaná kópia typu aj tabuľky režimov; `normalizeDirectorMode` nahrádza vlastnú logiku |
| 3 | Panel importuje spoločný typ | `src/components/DirectorPlanPanel.tsx` | zmazaná kópia `DirectorActionType` aj `DirectorPlanItem` (re-export kvôli existujúcim importom) |
| 4 | **Režim len NAVRHUJE cieľ** | `directorVocabulary.ts` + server odpoveď `suggestedGoalId` | `SOCIAL → REACH`, `ADS → PREDAJ`, … `CUSTOM → žiadny`. Návrh **nikdy neprepíše** cieľ, ktorý si používateľ vybral (krok 26: 1 projekt = 1 cieľ) |
| 5 | **Poctivý pôvod plánu v odpovedi servera** | `server.ts` | nové polia `planBasis` (`transcript`/`analysis`/`estimate`) a `dataQuality`; `estimatedTimeSavedIsEstimate: true` — „ušetrený čas“ je odhad, nie meranie |
| 6 | Panel to zobrazuje | `DirectorPlanPanel.tsx` | text „Z čoho plán vznikol: …“ + „Návrh cieľa podľa režimu: … (je to len návrh)“. Žiadny fake zásah sa nepridá, len sa prizná pôvod |
| 7 | **Director Studio číta jednu hlavu** | `src/ai/director/directorTools.ts` — nový nástroj `getDirectorDecisions` | namiesto vlastnej logiky vracia to, čo rozhodol `directorEngine.generateDirectorPlan`; bez analýzy vráti **0 rozhodnutí a dôvod** |
| 8 | Jeden slovník pôvodu (`basis`) | `src/core/retention/retentionEngine.ts` | `RetentionPlanItemLike.basis` už nie je vlastný zväzok, ale `DirectorBasis` zo spoločného modulu |

**Čo to NIE JE:** nie je to nový Director, nová vrstva rozhodovania, nový engine ani refactor.
Rozhodovanie ostáva tam, kde bolo (`directorEngine` v klientovi, transcriptové pravidlá na serveri);
zjednotil sa **jazyk** a **priznanie pôvodu dát**.

---

## 3. Overenie (čo je dôkaz a akej úrovne)

| Čo | Úroveň dôkazu | Výsledok |
|---|---|---|
| `bun run lint` (tsc) | STATIC | **0 chýb** |
| `bun test` | UNIT | **870 pass / 0 fail** (38 súborov; z toho 8 nových v `tests/directorOneHead.test.ts`) |
| Kontrola, že kópie zmizli | UNIT (test číta kód bez komentárov) | `server.ts` neobsahuje `const DIRECTOR_MODES: Record<`, panel neobsahuje kópiu typu; oba importujú `directorVocabulary` |
| Odpoveď servera bez prepisu | **REAL RUNTIME** (`curl` na bežiaci server) | `planBasis: estimate`, `dataQuality: NO_PROJECT_ANALYSIS …`, `suggestedGoalId: REACH` (SOCIAL) |
| Odpoveď servera s prepisom | **REAL RUNTIME** | `planBasis: transcript`, `dataQuality: SERVER_HAS_TEXT …`, `suggestedGoalId: PREDAJ` (ADS), `anchoredSentences: 5` |
| Appka žije | **REAL RUNTIME** | `GET /` → HTTP 200 |
| Obrazovka v prehliadači | — | **NIE JE OVERENÉ** (panely som v prehliadači nevidel; musí otvoriť používateľ) |

---

## 4. Čo v kroku 0c ešte ZOSTÁVA (priznané, nie skryté)

1. **Pravidlá, nie jazyk:** server má vlastné transcriptové pravidlá (filler slová, hook, CTA)
   a `directorEngine` má pravidlá z nameranej analýzy. Zdieľajú dnes slovník a pôvod dát, ale
   **nie samotné pravidlá** — zjednotiť ich má zmysel až vtedy, keď budú mať rovnaké vstupy
   (server dnes nedostane projekt ani analýzu). Do tej doby je poctivé priznať, že ide o ten istý
   *jazyk*, ale dva *zdroje* — a presne to server vracia v `dataQuality`.
2. **Zásah z plánu ≠ canonical timeline:** `apply` v `DirectorPlanPanel` stále končí na úrovni
   projektu/panelov (nie celý reťaz CommandManager → canonical), takže panel dnes nesmie tvrdiť
   „aplikované do strihu“. Spojenie cez `CommandManager` je samostatný podkrok (dotýka sa
   existujúcej krok-16 linky, nie nového kódu).
3. **`getDirectorDecisions` je čítací nástroj** — návrhy mutácií z `directorTools` ním zatiaľ
   neprechádzajú cez kontrolu konfliktov (`validatePlanConflicts`) spoločného enginu.
