# KROK 1 — LOKÁLNA AI V NÁSTROJI (sémantika viet + VAD)

> Poradie podľa `docs/CREATIVE_DIRECTOR_INTELLIGENCE_REPORT.md` (D.4): 0 → 0b → 0c → **1** → 2 → 3 → 4 → 5.
> **Reality Gate pred kódom:** najprv audit `src/ai/`, potom meranie modelov, až potom zapojenie.

---

## 1. Reality Gate — čo tam už bolo (audit, nie dojem)

| Súbor | Čo tvrdil | Realita pred krokom 1 |
|---|---|---|
| `src/ai/index.ts` (52 r.) | LocalAIManager so 5 providermi | obal, ktorý ich len drží |
| `LocalSpeechProvider` (203 r.) | lokálny Whisper tiny | **WIRED** — používa ho `captionEngine` |
| `LocalEmbeddingProvider` (111 r.) | „Local Feature & Text Vector Embedder“ | **FAKE FALLBACK**: pri zlyhaní modelu vyrobil „hash vektor“ z `Math.sin(charCode)`, nastavil `READY` a vydával to za sémantiku. Model `all-MiniLM-L6-v2` je anglický |
| `LocalVADProvider` (195 r.) | `id = 'local_vad_silero'` | algoritmus je **reálny** (WebAudio RMS + prah), ale žiadny Silero model nepoužíva → **klamlivé pomenovanie** |
| `LocalVisionProvider` (171 r.) | Vision Engine | hrubé meranie jasu (rovnaké ako `frameMetrics` z kroku 30b) |
| `LocalTTSProvider` (161 r.) | lokálna syntéza reči | mimo tohto kroku |
| `aiCache` (92 r.) | cache | IndexedDB; v Node nie je → vracia `null` (nespadne) |

---

## 2. Meranie, ktoré rozhodlo (nie dojem)

Na slovenských vetách (4 parafrázy + 4 nesúvisiace dvojice), 384 dimenzií:

| Model | Veľkosť | Príbuzné (najnižšia) | Nesúvisiace (najvyššia) | Odstup | Verdikt |
|---|---|---|---|---|---|
| `Xenova/all-MiniLM-L6-v2` | ~23 MB | 0,540 | **0,556** | **−0,016** | **ZAMIETNUTÝ** — skupiny sa prekrývajú, prah sa nedá nájsť |
| `paraphrase-multilingual-MiniLM-L12-v2` **q8** | ~118 MB | **0,790** | 0,284 | **+0,506** | **POUŽITÝ** |

Model v plnej presnosti (fp32) bol v prostredí s 2 GB RAM **zabitý (OOM)** → `dtype: 'q8'` je
v kóde **povinné**, nie optimalizácia.

**Prah `SEMANTIC_DUPLICATE_THRESHOLD = 0,53`** je stred nameraného odstupu — a v kóde je
pri ňom napísané, z akých čísel vznikol (`src/core/media/semanticSegments.ts`).

---

## 3. Čo je implementované

| # | Zmena | Súbor |
|---|---|---|
| 1 | **Hash vektor ZMAZANÝ.** Provider buď model načíta a meria, alebo hlási `NOT_AVAILABLE` s dôvodom a `process()` vyhodí chybu | `src/ai/providers/LocalEmbeddingProvider.ts` (prepísaný) |
| 2 | Multilingual model + `q8`, dávkové `embedBatch()` (jeden prechod pre viac textov) | tamtiež |
| 3 | **Sémantické segmenty**: kosínus, prah, hľadanie opakovaní s vysvetlením, hľadanie podľa významu, jedinečné pasáže | `src/core/media/semanticSegments.ts` (nový) |
| 4 | **Nový uzol DAG** `semantic_units` (závisí od `transcript`) — v indexe pribudlo `semanticUnits` a `semanticRedundancy` | `src/core/media/mediaIntelligenceIndex.ts` |
| 5 | Rozdelenie na vety **podľa interpunkcie a pauzy** (0,8 s), nikdy „každé 2 sekundy“ | tamtiež (`splitIntoSentences`) |
| 6 | **Napojenie na existujúce zdroje**: embeddingy z lokálneho modelu, prepis z **tituliek projektu** | `src/ai/wireLocalAI.ts` (nový), volané raz v `App.tsx` |
| 7 | Inspektor: deviaty uzol „Význam viet (sémantika)“ + poctivý amber box, keď sa nemeria | `src/components/MediaIntelligenceInspector.tsx` |

**Architektúra:** jadro (`core/media`) **nemá** závislosť na AI vrstve. Vystavuje dva vstrekovacie
body (`setEmbeddingProvider`, `setTranscriptProvider`) a `wireLocalAI.ts` ich naplní. Preto sa jadro
dá testovať v Node a výmena modelu je jedna funkcia.

---

## 4. Dôkazy

| Čo | Úroveň | Výsledok |
|---|---|---|
| `bun test` | UNIT | **887 pass / 0 fail** (39 súborov; +17 v `tests/localAiWiring.test.ts`) |
| `bun run lint` / `bun run build` | STATIC | 0 chýb / exit 0 |
| `tools/verify-local-ai.ts` — model | **REAL MODEL VERIFIED** | načítaný za 1,1–2,8 s, 384 dimenzií, `MEASURED` |
| prah na reálnych SK vetách | **REAL MODEL VERIFIED** | parafrázy ≥ **0,790** > **0,53** > **0,284** ≥ nesúvisiace |
| determinizmus | REAL MODEL | dva behy = rovnaké vektory |
| 12 reálnych videí (popisy ai_ktivista) | **REAL DATA VERIFIED** | 103 pasáží → **51 opakovaní**, 15 dvojíc **naprieč rôznymi videami** (napr. „video 10 opakuje video 01, zhoda 93 %) → `docs/proof-local-ai.txt` |
| bez modelu | REAL MODEL | `NOT_AVAILABLE` + dôvod, 0 segmentov, žiadny hash vektor |
| VAD | nezávislé meranie | ffmpeg `silencedetect` na `real_speech.mp4`: 4 úseky ticha (1,48 s) |
| appka | **REAL RUNTIME** | `GET /` HTTP 200, Vite servuje `wireLocalAI.ts` aj `semanticSegments.ts` (HTTP 200) |

**NIE JE OVERENÉ:** obrazovka v prehliadači (inspektor musí otvoriť používateľka) —
teda **BROWSER VERIFIED to nie je**. Náš VAD (WebAudio RMS) som v tomto behu nemeral;
zmeral som len nezávislé ffmpeg meranie, ktoré je podkladom pre krok 4.

---

## 5. Dve chyby, ktoré odhalil až reálny beh

1. **Nekonečné načítavanie modelu → OOM.** `loadModel()` sa rozhodovalo podľa textu stavu
   (`status === 'READY'`). Po prvej dávke je stav `COMPLETE`, takže sa model načítal **znova
   a znova**, kým prostredie nezabilo proces (10 minút, exit 137). Opravené: rozhoduje
   **prítomnosť inštancie** (`isLoaded()`), nie text stavu.
2. **Ochrana proti nekonečnej slučke pri delení dávky.** Keby model vrátil `dim = 0`,
   `i += 0` by zacyklilo a naplnilo pamäť. Dnes sa to odmietne chybou, nie tichým zacyklením.

---

## 6. Čo zostáva (priznané)

1. **VAD nie je premenovaný na Silero** — algoritmus je reálny, ale názov `local_vad_silero`
   v kóde zostal; premenovanie sa dotýka ďalších miest a patrí k kroku 4 (meranie zvuku).
2. **Prepis z tituliek projektu** — časy slov sú v časoch klipu a `confidence: 0` (nie je to
   meranie reči). Pre porovnanie významu to stačí; na strihanie podľa slov to nestačí a v kóde
   je to napísané.
3. **Vizuálne embeddingy** (porovnanie záberov podľa významu) sa nerobia — vizuál zostáva
   na `frameMetrics` (krok 30b). Model pre obrázky by bol ďalších ~90 MB a v 2 GB prostredí riskantný.
4. **Cross-media Content Map je krok 2** — sémantika je hotová, chýba jej stĺpcová podoba
   (Source | Obsah | Význam | Relevance | Použitie) pre 30+ reálnych videí naraz.
