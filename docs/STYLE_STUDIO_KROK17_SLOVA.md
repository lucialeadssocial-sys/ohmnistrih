# KROK 17 — TITULKY PO SLOVÁCH (z canonical časovej osi)

**Dátum:** 30. 9. 2026 · **Východzia main:** `695453e` (krok 16 + preklepy, PR #39/#40)
**Otázka zadania:** *„Zvýrazňuje video naozaj hovorené slovo — a prišlo to časovanie z canonical časovej osi, nie z UI?"*
**Odpoveď:** **ÁNO — REAL MEDIA VERIFIED + REAL EXPORT VERIFIED** (zmerané na hotovom MP4).

---

## 0) Reality check PRED kódom

| Čo sa overovalo pred písaním kódu | Zistenie |
|---|---|
| Vie server vôbec zvýrazniť hovorené slovo? | **ÁNO** — `subtitleRender.ts`, režim `active-word` (štýly VIRAL_BOLD, HORMOZI, KARAOKE, NEON_BOX); farba zvýraznenia je v katalógu štýlov |
| Posiela priama cesta (panel Titulky) časovanie slov? | **ÁNO** — `BurnCaptionsPanel.tsx` posiela `segments` aj s `words` (preto tam zvýrazňovanie funguje) |
| Posiela ho **canonical** cesta? | **NIE — MEDZERA 1**: `buildCanonicalExportPlan` skladal segmenty len ako `{start, end, text}` |
| Vie canonical klip časovanie slov udržať? | **NIE — MEDZERA 2**: `TextConfig` nemal pole na slová |
| Zvýrazní náhľad hovorené slovo? | **NIE — MEDZERA 3**: canvas kreslil statický text |
| Existujú čisté funkcie na prácu so slovami? | **ÁNO** — `transcript/wordTiming.ts` (krok A: index hraníc, pauzy, prichytenie strihu) — chýbalo len „aktívne slovo v čase" a prevod časov |
| Treba nový model/render engine/command? | **NIE** — všetko sa zmestilo do existujúcich modulov (`CommandManager`, `buildCanonicalExportPlan`, `buildCanonicalFramePlan`, existujúca renderovacia linka) |

**Záver:** appka zvýrazňovať **vedela** — chýbalo jej len *doviesť časovanie slov z canonical osi* a *ukázať to isté v náhľade*. Presne to krok 17 dopĺňa.

---

## 1) Čo pribudlo (všetko v existujúcich moduloch)

| Súbor | Čo | Prečo |
|---|---|---|
| `src/core/transcript/wordTiming.ts` | `RelativeWord`, `wordsToRelative`, `wordsToAbsolute`, `clampWordsToWindow`, `hasUsableWordTiming`, `activeWordAt`, `wordsShareToken` | klip nesie časy **relatívne** (dá sa presúvať), server páli v **absolútnych** → prevod na jednom mieste; a **jedno** pravidlo „ktoré slovo je hovorené" pre náhľad aj export |
| `src/core/types/project.ts` | `TextWordTiming`, `TextConfig.words?` | canonical klip má kde časovanie udržať (voliteľné pole — staré projekty fungujú ďalej) |
| `src/components/LocalCaptionStudio.tsx` | pri pridaní titulkov na os sa uloží aj časovanie slov | bez toho by canonical os slová nikdy nemala |
| `src/core/export/canonicalExport.ts` | segmenty nesú `words` v absolútnych časoch (orezané na okno klipu) + `captionsWithWords` / `captionsWithoutWords` + poctivá poznámka | časovanie sa konečne dostane do zadania pre vypálenie |
| `src/core/render/canonicalFrame.ts` | textová vrstva nesie `words` + `captionPreset` | náhľad vidí to isté, čo pôjde do videa |
| `src/core/render/renderEngine.ts` | zvýraznenie hovoreného slova v náhľade (farba z katalógu štýlov) | to, čo user vidí v náhľade, je to, čo bude vo videu |
| `src/core/export/subtitleRender.ts` | porovnanie tokenu → jedna funkcia `wordsShareToken` | náhľad a vypálenie nemôžu zvýrazniť iné slovo |

**Bezpečnostné pravidlá (držané):** žiadne vymyslené časovanie (bez slov sa zvýrazňovanie vypne a appka to povie), žiadny nový render engine, žiadny druhý CommandManager, žiadna zmena existujúceho UI okrem pridania dát.

---

## 2) Dôkaz na reálnych dátach

Runner: `tools/verify-word-captions.ts` · log: `docs/word-captions-output.txt` · strojová evidencia: `/home/user/kontrola-krok17-slova.json`

| Krok | Zmerané |
|---|---|
| Reálne médium | `real_speech.mp4` (345 651 B, 20,27 s) |
| Reálny prepis | `HTTP 200 | success=true | hasSpeech=true` → 18 viet / 49 slov (živé volanie appky) |
| Canonical os | 18 titulkov zapísaných **cez CommandManager** (rovnaká cesta ako UI), všetky s časovaním slov |
| Exportný plán | 49 slov v zadaní, všetky **v okne svojho titulku**, blokery žiadne |
| Parita náhľad ↔ zadanie | **3/3 sedí** (náhľad zvýrazní presne to slovo, ktoré pôjde do videa) |
| Server | `wordHighlight=true`, poznámka *„Zvýrazňovanie hovoreného slova je zapnuté — mám časovanie slov"* |
| **REAL EXPORT** | `/home/user/export-krok17-slova.mp4` — 1 277 034 B, 1080×1920, 20,27 s |
| Zvuk | hash zdroj → výstup `f6f5e86a16ab9e4c` = `f6f5e86a16ab9e4c` (**rovnaký**) |
| **Meranie zvýraznenia (žltá v obraze)** | **5/5 snímok** so zvýrazneným slovom · **5/5 dvojíc** sa posunulo na iné slovo · kontrola „to isté slovo + 0,03 s" **stabilná** (stred ±5 px) · **zdrojové video 0 žltých pixelov** |
| Vizuálna kontrola | snímky vytiahnuté z hotového MP4: v 0,50 s svieti žlto „ZA", v 0,70 s „PÄŤ" |

Príklady z merania (stred žltej časti v obrazovom bode X, šírka 1080 px):

```
„ZA"  @0,50 s → 2 099 px, X 381     |  „PÄŤ" @0,70 s → 3 072 px, X 653   | to isté slovo (+0,03 s) → X 376
„NAJPRV" @5,05 s → 6 671 px, X 342  |  „SOM"  @5,35 s → 3 460 px, X 820  | to isté slovo (+0,03 s) → X 342
„ZA"  @12,30 s → 2 095 px, X 331    |  „PRVÝ" @12,60 s → 4 035 px, X 645 | to isté slovo (+0,03 s) → X 324
zdrojové video v tých istých časoch: 0 žltých pixelov (zvýraznenie naozaj vyrába až export)
```

---

## 3) Finálny report

| Oblasť | Status | Dôkaz |
|---|---|---|
| Časovanie slov z reálneho prepisu | **REAL MEDIA VERIFIED** | HTTP 200, 18 viet / 49 slov, `wordTiming` (§2) |
| Canonical klip nesie slová | **REAL MEDIA VERIFIED** | 18 titulkov na osi, všetky s časovaním (§3 logu) |
| Canonical export nesie slová (absolútne, v okne klipu) | **REAL MEDIA VERIFIED** | 49 slov v zadaní, `slová sedia v okne svojho titulku: áno` |
| Zvýrazňovanie hovoreného slova vo videu | **REAL MEDIA VERIFIED** | 5/5 snímok, 5/5 posunov, zdroj 0 px; vizuálne snímky |
| Náhľad ↔ export parita (dátová cesta) | **PREVIEW PARITY — OK** | 3/3 slov sedí; rovnaká funkcia `activeWordAt` + `wordsShareToken` |
| Pôvodné audio | **REAL EXPORT VERIFIED** | hash PCM zdroj = výstup |
| TEST RESULTS | **UNIT TESTED** | `bun test` → **668 pass / 0 fail / 3334 expect / 27 files** (15 nových testov A–C) |
| BUILD | **PASS** | `vite build` → `built in 2.48 s`, exit 0 |
| LINT / type safety | **PASS** | `tsc --noEmit` exit 0 |
| Prehliadačové UI (canvas náhľad) | **NOT VERIFIED** | v prostredí nie je DOM — kód je pripravený, ale v prehliadači to musí potvrdiť user |
| Animácia zvýraznenia (karaoke štýl s pružinou) | **NOT VERIFIED** | štýly s `activeWordScale` dostávajú zvýraznenie farbou; mierkové „pruženie" som nemeral |
| Generované vizuály | **PROVIDER UNAVAILABLE** | nič sa negeneruje |
| FAIL | **žiadne** | 0 fail v testoch, linte, builde, real-media, exporte |

### Čo tento dôkaz NEznamená (poctivo)
* Runner volá API bežiacej appky — **obchádza UI** (rovnaká cesta ako kroky 8–16).
* Náhľad je doložený **dátovo** (rovnaká canonical os a rovnaké pravidlo výberu slova), nie screenshotom z prehliadača — `BROWSER VERIFIED` to nie je.
* Meranie žltou je citlivé na **konkrétny štýl titulkov** (tie, ktoré zvýrazňujú farbou). Pri štýloch s `highlightMode: none` (napr. CLEAN) sa nič nezvýrazňuje — a appka to tak aj povie.

---

## 4) Odpoveď na zadanie

> „Zvýrazňuje video naozaj hovorené slovo a ide to z canonical časovej osi?"

**ÁNO.** Reťaz je prejdená celá a zmeraná na hotovom súbore:

```
reálny prepis (HTTP 200, wordTiming)
  → canonical klip (TextConfig.words, relatívne časy)         [cez CommandManager]
  → exportný plán (absolútne časy, orezané na okno klipu)
  → plán snímky (words + captionPreset)  → náhľad zvýrazní to isté slovo (3/3)
  → existujúca renderovacia linka (wordHighlight=true, „mám časovanie slov")
  → hotové MP4: zvýraznenie sa hýbe po slovách (5/5), zvuk nedotknutý
```

**Poznámka k čistote dôkazu:** prvé meranie ukazovalo 0/4 — príčina bola v mojom meraní (vzorkoval som medzeru medzi slovami, kde podľa pravidla ešte platí predošlé slovo), nie vo videu. Po oprave merania (priame meranie žltej farby zvýraznenia + kontrola „to isté slovo") je výsledok 5/5. Toto priznávam v logu aj tu — číslo som neprispôsobil výsledku, opravil som metódu a je vidieť obe čísla.
