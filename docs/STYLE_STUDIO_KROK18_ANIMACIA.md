# Krok 18 — ANIMÁCIA ZVÝRAZNENÉHO SLOVA (pruženie hovoreného slova)

**Dátum:** 2026-09-30 · **Vetva:** `krok-18-pruzenie-slova` · **Základ:** `main f3baeb6` (krok 17)
**Zadanie:** „Animacia zvýraznenie slova pokracuj“ → hovorené (zvýraznené) slovo sa má v čase **hýbať** (pružiť), nie len stáť zväčšené.

---

## 1. Čo je hotové a čím to je dokázané

| Oblasť | Status | Dôkaz |
|---|---|---|
| Pravidlo pruženia v jednom mieste (`wordPopSecForStyle`, `activeWordScaleAt`) | IMPLEMENTED + UNIT TESTED | `src/core/export/subtitleRender.ts`; `tests/wordAnimation.test.ts` 17 pass |
| Export vypáli animované `\t` na hovorené slovo | REAL EXPORT VERIFIED | 49× `\t(0,<ms>,\fscx118\fscy118)` v ASS z canonical osi, video `/home/user/export-krok18-pruzenie.mp4` (1 409 022 B) |
| Zvýraznené slovo sa v čase **naozaj zväčšuje** (merané na hotovom MP4) | REAL EXPORT VERIFIED | 4/4 merané slová rastú 30–56 px a potom držia (`kontrola-krok18/pruzenie-slova.json`) |
| Nezvýraznené (biele) slová počas pruženia **stoja** — rastie teda slovo, nie celý titulok | REAL EXPORT VERIFIED | zmena bielych pixelov ≤ 0,67 % (kompresný šum), `lineDriftPct` v dôkaze |
| Zvuk zdroja zostal nedotknutý | REAL EXPORT VERIFIED | SHA-256 `f6f5e86a16ab9e4c` → `f6f5e86a16ab9e4c` (rovnaký) |
| Pomer strán, fps, rozmer | REAL EXPORT VERIFIED | 1080×1920, 30 fps, server to hlási z reálneho súboru |
| Náhľad (canvas) pruží rovnakým pravidlom | IMPLEMENTED (zdieľaná funkcia) — **NOT VERIFIED v prehliadači** | `renderEngine.ts` volá `activeWordScaleAt`; v prostredí nie je DOM, prehliadačové overenie nie je |
| libass vie animovať veľkosť jedného slova | MEASURED | `kontrola-krok18/libass-sondy.json` (statické = 400 px, `\t` = 416→518 px) |

**Odpoveď na zadanie: ÁNO — zvýraznené slovo sa hýbe (pruží), nezostáva len stáť zväčšené.**

---

## 2. Pravidlo (jedno pre náhľad aj export)

```
pruženie = min(activeWordPopMs, polovica trvania slova)      // lineárne, ako ASS \t
veľkosť   = zväčšenie štýlu (napr. 118 %) dosiahnuté za [0, pruženie], potom drží
```

* HORMOZI 112 % / 150 ms · KARAOKE 118 % / 130 ms · VIRAL_BOLD pruženie nemá (len farba).
* Krátke slovo (napr. 0,2 s) sa oreže na 100 ms — pruženie nikdy nepresiahne polovicu slova.
* Zdola/nahor ohraničené: `OVERRIDE_LIMITS.activeWordPopMs = [0, 400]`.
* Export: `{\c<farba>\fscx100\fscy100\t(0,<ms>,\fscx<peak>\fscy<peak>)}` · náhľad: `ctx.translate/scale` okolo stredu slova.
* Keď štýl zväčšuje slovo, **vstup celého titulku ostáva `fade`** — kombinácia „pop udalosti + inline zväčšenie“ animáciu slova v libass potlačí (zmerané).

---

## 3. Meranie na hotovom videe (REAL EXPORT)

Reálne médium `real_speech.mp4` → reálny prepis (HTTP `/api/transcribe-speech`) → canonical os (`AddClipCommand`) → existujúca exportná linka → meranie žltých vs. bielych pixelov v MP4.

| Slovo | začína | šírka žltého v čase (s) | rast | zmena bielych |
|---|---|---|---|---|
| som | 8,10 s | 232 → 242 → 254 → 262 → **262** (drží) | **+30 px** | 0,46 % |
| plán, | 10,70 s | 278 → 292 → 304 → 316 → **316** (drží) | **+38 px** | 0,39 % |
| prvý | 12,40 s | 254 → 264 → 274 → 286 → **286** (drží) | **+32 px** | 0,43 % |
| zaplatil | 16,30 s | 426 → 446 → 466 → 482 → **482** (drží) | **+56 px** | 0,67 % |

Prepis: 6 viet / 48 slov · ASS: **49× animovaný tag, 0× staré statické zväčšenie** · slov meraných 4, pružiacich 4, držiacich po pružení 4.

Vizuálne potvrdenie: pás piatich snímok slova „som“ (`kontrola-krok18/pruzenie-som-pas.png`) — žlté slovo rastie, biele „Potom / zaviedol“ stoja na mieste.

Úplný log: `docs/word-animation-output.txt`. Dôkaz: `/home/user/kontrola-krok18/pruzenie-slova.json`.

---

## 4. Čo bolo po ceste chybné a je opravené (priznané)

1. **Runner posielal neexistujúci preset.** Canonical os pozná presety `clean|bold|social|minimal|kinetic`; poslanie „KARAOKE“ znamenalo potichu `VIRAL_BOLD` (štýl bez pruženia) — prvý beh teda meral iný štýl, než tvrdil. Opravené mapovaním `KARAOKE→kinetic` + ochrana (exit 2 pri neznámom štýle).
2. **Falošný poplach „48× staré statické zväčšenie“.** Regex hľadal `\fscx` v celom ASS a našiel cieľové hodnoty vnútri `\t(...)`. Teraz sa `\t` skupiny najprv odstránia → výsledok **0×**.
3. **Kontrola „celý riadok stojí“ bola nesprávna.** „Celý riadok“ obsahuje aj zvýraznené slovo, takže pri slove na kraji rastie nevyhnutne s ním. Nahradené meraním **nezvýraznených (bielych)** pixelov; kritérium `rast ≥ 8 px && zmena bielych ≤ 2 %`.
4. **Poznámka servera „počas čítania text stojí“ klamala.** Nahradená pravdivou poznámkou o pružení (krok 18); po zmene `subtitleRender.ts` bolo nutné appku reštartovať.

---

## 5. FILES / TEST / BUILD / REAL MEDIA / REAL EXPORT / NOT VERIFIED

* **FILES:** `src/core/export/subtitleRender.ts`, `src/core/render/renderEngine.ts`, `tests/wordAnimation.test.ts`, `tools/verify-word-animation.ts`, `docs/word-animation-output.txt`, `docs/STYLE_STUDIO_KROK18_ANIMACIA.md`
* **TEST:** `bun test` — 685 pass / 0 fail / 28 files (z toho 17 nových v `wordAnimation.test.ts`)
* **BUILD:** `tsc --noEmit` = 0 chýb; `bun run build` = 0
* **REAL MEDIA:** `real_speech.mp4` (345 651 B, 20,27 s), reálny prepis 6 viet / 48 slov
* **REAL EXPORT:** `export-krok18-pruzenie.mp4` 1 409 022 B, 1080×1920, 30 fps, zvuk hash nezmenený
* **NOT VERIFIED:** pruženie v náhľade priamo v prehliadači (prostredie bez DOM); UI panel Style Studia sme v prehliadači neklikali
* **UKÁŽKA:** `/home/user/ukazka-krok18-pruzenie.html` (vložené klipy so zmeraným pružením, bez externých zdrojov)
