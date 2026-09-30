# STYLE STUDIO — KROK 7: PREVIEW A EXPORT Z CANONICAL ČASOVEJ OSI

Záznam merania, nie marketing. Každé číslo vzniklo spustením runnera na reálnom médiu.

Dátum: 2026-09-30 · main pred týmto PR: `412f61e`

## Čo tento krok rieši

Náhľad aj export musia ukázať **to isté**. Doteraz sa mohli rozísť:
viditeľný prehrávač mal vlastné (staršie) vrstvy a export čítal canonical projekt —
čiže dva render paths. Po tomto kroku:

- `src/core/render/canonicalFrame.ts` — **jediný zdroj pravdy**, čo sa v danom čase kreslí
  (vrstvy, poradie, keyframy, zdrojový čas, a čo sa nedá nakresliť + prečo),
- `src/core/render/renderEngine.ts` — kompozitor kreslí **presne podľa tohto plánu**
  (ten istý kód používa náhľad v prehliadači aj offline render pri exporte),
- `src/core/export/canonicalExport.ts` — zadanie pre **existujúcu** ffmpeg linku
  (titulky a strihy z canonical osi; žiadny druhý render engine),
- `src/components/CanonicalExportPanel.tsx` — náhľad + export v UI, s poctivým
  zoznamom toho, čo linka **zatiaľ nevykresľuje**.

## Reálne meranie (posledný beh)

| Krok | Výsledok |
| --- | --- |
| Médium | real_speech.mp4 (345651 B) (dĺžka meraná: 20.27 s) |
| Prepis (reálny model) | 11 / 51 |
| Apply na canonical os | aplikované / dodržané / nevykonané = 15 / 1 / 3, os zmenená: true |
| Titulkov v canonical osi | 6 |
| Zhoda canonical ↔ zadanie | áno (nič nechýba, nič navyše) |
| Stav renderu | done |
| Súbor | omnistrih-titulky-real_speech-1790754060047.mp4 (502502 B) |
| Stopa video / audio | áno / áno |
| Dĺžka výstupu | 20.27 s |
| Zvuk rovnaký ako v zdroji | áno (obsahovo) (`511feee27c325b3d → 511feee27c325b3d`) |
| Titulky v obraze | áno (obraz sa na tom mieste líši) (YAVG zmeny 7.37) |
| Verdikt | REAL EXPORT Z CANONICAL OSI PASS (súbor vznikol, má obraz aj zvuk, titulky z canonical osi sú v obraze) |

## Čo je v hotovom videu (overené snímkami zo súboru)

Šesť titulkov presne podľa reálneho prepisu: „ZA 5 MINÚT DENNE“, „NAJPRV SOM ROBIL“,
„RÁNO PLÁN, VEČER“, „STRIH O 70 %.“, „KLIENT ZAPLATIL 3 000“ — plus texty, ktoré
plán vynechal (napr. „Potom som zaviedol“), lebo na ne v pláne nebolo miesto.

Ukážky: `docs/real-export-montaz-titulky.png` (päť snímok z hotového súboru).

## Poctivo: čo tento výsledok NEznamená

- **BROWSER VERIFIED: nie** — prehliadač v prostredí nie je; panel je overený SSR renderom
  (`tests/canonicalExportPanel.test.tsx`) a appka modul naozaj servíruje (HTTP 200).
- **Kompletný canonical render: nie** — táto renderovacia linka **zatiaľ nevykresľuje**
  obrazové vrstvy (b-roll/fotky), priblíženia (motion) ani farebné filtre. Appka to
  používateľovi napíše **pred** renderom, nie až po ňom.
- **Prehrávač v appke** má zatiaľ vlastné staršie vrstvy — panel to priznáva vetou
  „rozhoduje to, čo vidíš tu: to ide do súboru“. Zjednotenie samotného prehrávača
  je samostatná (väčšia) úloha, nie tichá zmena.
- Zdrojové video použité pri meraní je takmer čierne (YAVG 35) — **nie je to chyba exportu**,
  export je verný zdroju; preto je v snímkach vidieť hlavne titulky.
- Reč v médiu je **syntetizovaná (Gemini TTS, hlas Kore)**, obraz je reálne video
  používateľa (zacyklené). Pozri `tools/build-real-media.py`.

## Ako si to zopakuješ

```bash
python3 /home/user/tools/build-real-media.py                      # postaví médium s rečou (prežije reset)
bun run tools/verify-style-real-media.ts /home/user/real-media/real_speech.mp4 \
    --plan /home/user/real-media/segments.json                    # apply + rollback na reálnych dátach
bun run tools/verify-canonical-export.ts /home/user/real-media/real_speech.mp4 \
    --plan /home/user/real-media/segments.json --out /home/user/export-z-canonical-os.mp4
bun test tests/canonicalRender.test.ts tests/canonicalExportPanel.test.tsx
```

Surový výstup posledného behu: `docs/real-export-verify-output.txt`.
