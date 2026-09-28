# Technický a licenčný audit open-source projektov

> Overené cez GitHub API dňa **28. 9. 2026**. Všetky čísla nižšie sú z reálneho
> volania API, nie z odhadov.
> Toto je **technický audit, nie právne stanovisko.**

---

## 1. Overené údaje

| Repo | ★ | Licencia | Jazyk | Posledný push | Poznámka |
|---|---|---|---|---|---|
| [WyattBlue/auto-editor](https://github.com/WyattBlue/auto-editor) | 5 379 | **Unlicense** (public domain) | **Nim** | 2026-09-19 | zrelý projekt, CLI |
| [SYSTRAN/faster-whisper](https://github.com/SYSTRAN/faster-whisper) | 25 611 | MIT | Python | 2025-11-19 | stabilný, ~10 mes. bez zmeny |
| [snakers4/silero-vad](https://github.com/snakers4/silero-vad) | 10 314 | MIT | Python | 2026-09-23 | aktívny, má ONNX variant |
| [timkulbaev/ai-video-editor](https://github.com/timkulbaev/ai-video-editor) | **11** | MIT | Python | 2026-02-24 | malý projekt |
| [waseemnasir2k26/reelforge](https://github.com/waseemnasir2k26/reelforge) | **6** | MIT | HTML/Python | 2026-09-16 | malý projekt |
| [vorniches/cutstorm](https://github.com/vorniches/cutstorm) | **19** | MIT | TypeScript | 2026-05-08 | malý projekt |
| [OpenCut-app/OpenCut](https://github.com/OpenCut-app/OpenCut) | 90 849 | MIT | TypeScript | 2026-09-24 | veľký projekt (prepis) |
| [computerlovetech/video-edit-cli](https://github.com/computerlovetech/video-edit-cli) | **2** | MIT | Python | 2026-07-19 | veľmi malý projekt |
| [Vanilagy/mediabunny](https://github.com/Vanilagy/mediabunny) | 7 206 | **MPL-2.0** | TypeScript | 2026-09-28 | **naše jadro** |
| [pyannote/pyannote-audio](https://github.com/pyannote/pyannote-audio) | 10 598 | MIT | Python | 2026-09-24 | ťažké závislosti |

### ⚠️ Upozornenie k pôvodnému prehľadu

V pracovnom prehľade boli niektoré projekty hodnotené „⭐⭐⭐⭐". Realita je iná:
**`ai-video-editor` (11★), `reelforge` (6★), `cutstorm` (19★) a `video-edit-cli` (2★)
sú malé hobby projekty**, nie zrelé produkty. Kód v nich existuje a je použiteľný
ako *inšpirácia pre logiku*, ale určite nie ako hotová „pipeline na prevzatie“.
Skutočne zrelé sú: **auto-editor, faster-whisper, silero-vad, mediabunny, OpenCut, pyannote**.

---

## 2. Kľúčové technické zistenia (menia spôsob integrácie)

### 🔴 auto-editor je napísaný v **Nim**, nie v TypeScripte
Je to **skompilovaný CLI nástroj**, nie knižnica. Do Vite/React bundlu sa
nedá importovať. Možnosti:

1. **Spúšťať jeho CLI** ako podproces (treba pribaliť binárku alebo ju mať
   nainštalovanú) — rýchle, ale pridáva externú závislosť a platformové binárky.
2. **Preimplementovať jeho logiku** (labels/actions, margin, smooth, EDL export)
   v TypeScripte nad našimi dátami — viac práce, ale nulová závislosť a plná
   kontrola. **Preferované pre náš Director Engine.**

### 🔴 faster-whisper a silero-vad sú **Python**
Nedajú sa importovať do frontendu. Potrebujú **sidecar worker proces** (Python)
komunikujúci so `server.ts` (napr. lokálny HTTP/stdio). Dôsledky:

- analýza beží mimo hlavného procesu editora → editor zostane svižný,
- treba riešiť balenie/inštaláciu (modely + venv) pre používateľa,
- pre „zero-install“ variant zostáva možnosť analýzy cez existujúce Gemini API.

### 🟡 Licencia auto-editoru — dôležitý detail
README uvádza:
> „Everything in this repository is under the Public Domain… **Binary artifacts
> in the Releases section may be under various open source licenses.**“

A ďalej, že webová verzia používa assety z repa (Unlicense), ale
„their own unique assets are under a separate proprietary license“.

→ Kód repa je public domain, ale **pri preberaní binárok/služby treba licenciu
overiť samostatne.**

### 🟢 Mediabunny je čisté
`package.json`: runtime závislosti len `@types/*` (typové, nie runtime),
žiadne peer závislosti, licencia **MPL-2.0** = použiteľné komerčne aj
v closed-source, pri úprave MPL kódu treba zverejniť príslušné zmeny.

---

## 3. Verdikt po jednotlivých projektoch

| Projekt | Čo zobrať | Ako | Verdikt |
|---|---|---|---|
| **auto-editor** | logika silence/speed, margin/smooth, EDL/DaVinci export | **preimplementovať v TS** (nie binárka) | ✅ hlavný zdroj edit logiky |
| **silero-vad** | detekcia reči/ticha (lacná prvá vrstva) | Python sidecar (ONNX) | ✅ áno, prvé na rade |
| **faster-whisper** | transcript + word-level timestamps | Python sidecar, len na požiadanie | ✅ áno |
| **ai-video-editor** (11★) | pravidlá: filler words, false starts, opakované začiatky | inšpirácia → vlastná implementácia | ✅ pravidlá, nie kód |
| **reelforge** (6★) | caption styling, word timing, hook karta, 9:16 | inšpirácia + vlastná implementácia | ✅ vybrané časti |
| **cutstorm** (19★) | UX nápady pre titulkový editor | iba inšpirácia | ❌ celý neintegrovať |
| **OpenCut** (90k★) | architektúra, plugin/headless nápady | zatiaľ nie | ❌ neskôr |
| **video-edit-cli** (2★) | AI-agent workflow | iba inšpirácia | ❌ celý nie |
| **pyannote** | speaker diarization (kto hovorí) | neskôr (PyTorch stack) | ⏳ keď budú rozhovory |
| **mediabunny** | prehrávanie + spracovanie | **zostáva jadro** | ✅ nemeníme |

---

## 4. Odporúčaný postup integrácie

```
Krok 1  Silero VAD (sidecar)  →  reálne dáta o tichu/reči z RAW videa
Krok 2  Director Engine v TS  →  Edit Plan (CUT/KEEP/SPEED/ZOOM/CAPTION/HOOK)
Krok 3  Review UI             →  človek schvaľuje jednotlivé zásahy
Krok 4  Mediabunny execution  →  aplikovanie schváleného plánu
Krok 5  faster-whisper        →  titulky a word-level timing (až keď treba)
Krok 6  DaVinci XML export    →  editovateľný projekt
Krok 7  Quality Check + profily režimov + Learning mode
```

**Prečo VAD pred Whisperom:** VAD je rádovo lacnejší (malý model, rýchlejší než
real-time na jednom CPU vlákne) a stačí na rozhodnutia o tichu a tempe.
Whisper púšťame až tam, kde naozaj potrebujeme text — titulky, fillery,
opakovania. Tým sa vyhneme tomu, aby analýza trvala dlho a „zjedla“ celý zážitok.

---

## 5. Pravidlá, ktoré platia pre každú ďalšiu integráciu

1. **LICENSE audit** — bez jasnej licencie sa kód nepreberá.
2. **Dependency audit** — koľko balíkov to prinesie?
3. **Bundle-size audit** — o koľko narastie build?
4. **Runtime/RAM audit** — nepribrzdí import, timeline ani preview?
5. **Duplicita s Mediabunny** — nerobíme to isté dvakrát.
6. **Až potom** návrh integrácie.

> Ak existujúca funkcia OmniStrihu robí to isté dobre → **cudzí kód sa nepridá.**
> Ak by integrácia spomalila import/timeline/preview → **nepoužijeme ju.**

---

## 6. Zoznam na neskoršie overenie

- Konkrétne modely (Whisper veľkosť, VAD verzia) a ich licenčné podmienky
  (osobitne modely stiahnuté z Hugging Face).
- Fonty, LUT, zvukové banky, ikony — vlastné licencie mimo GitHub repozitárov.
- Podmienky Gemini API pri komerčnom používaní.
