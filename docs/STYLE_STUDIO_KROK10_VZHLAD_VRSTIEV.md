# STYLE STUDIO — KROK 10: OTOČENIE, PRIESVITNOSŤ A FAREBNÉ FILTRE VRSTIEV

Záznam merania, nie marketing. Každé číslo vzniklo behom na reálnom médiu.

Dátum: 2026-09-30 · main pred týmto PR: `d31d21a` (krok 9)

## Čo tento krok rieši

Canonical os vie na obrazových vrstvách aj **otočenie**, **priesvitnosť** a **farebný filter** —
a na videu farebný filter. Export to doteraz **vynechával** a musel to priznávať:
pootočené a priesvitné vrstvy sa dokonca vôbec nekreslili.

Po tomto kroku sa všetko vykreslí — v **tej istej** ffmpeg linke, bez nového render enginu.

## Ako sa to robí (a prečo tak)

| Vlastnosť | Canonical kompozitor (canvas) | Export (ffmpeg) |
| --- | --- | --- |
| Farebný filter | `ctx.filter = 'grayscale(100%) contrast(120%)'` | `hue=s=0,eq=contrast=1.2` |
| Otočenie | `ctx.rotate()` okolo stredu | `rotate=…:ow=rotw():oh=roth():c=none` |
| Priesvitnosť | `ctx.globalAlpha = 0.6` | `colorchannelmixer=aa=0.6` |

Prepis je jeden a ten istý pre vrstvy aj pre základné video (`colorFilterForName`),
aby sa náhľad a export nemohli rozísť. Poradie: **farebný filter → otočenie → priesvitnosť**.

**Poctivo o jednej nepresnosti:** CSS `brightness(95 %)` je **násobenie**, kým `eq=brightness`
je **pripočítanie**. Preto je v kóde prepis `0,95 → -0,05`, je to aproximácia, a appka to
**píše v poznámkach**. Sépia sa naopak prekladá presne (matica sépie zmiešaná s jednotkovou).

## Namerané hodnoty (posledný beh, reálne médium)

| Krok | Výsledok |
| --- | --- |
| Vzhľad vrstvy v canonical osi | áno — **cez CommandManager**: otočenie 12°, priesvitnosť 60 %, filter BW |
| Ide do linky | „Style Studio: fotografia": 12°, 60 %, BW |
| Filter graf | priblíženie=áno · vrstvy=áno · **otočenie=áno · priesvitnosť=áno · farebný filter=áno** · titulky=áno |
| Rozmer rámu zdroj → výstup | 1080×1920 → **1080×1920 (rovnaký)** |
| Zvuk | obsahovo zhodný so zdrojom (`511feee27c325b3d`) |
| Obrazová vrstva | v okne 6,53 vs mimo 0,18 |
| Verdikt | **REAL EXPORT Z CANONICAL OSI PASS** |

## Skúška linky na syntetickom podklade

| Meranie | Hodnota | Význam |
| --- | --- | --- |
| **Otočenie 90°** v zvislom pásme | **96,03** | lišta je tam, kde po otočení má byť |
| Otočenie vo vodorovnom pásme (kontrola) | 0,02 | a nie je tam, kde byť nemá |
| **Priesvitnosť 50 %** voči nepriehľadnej | **0,66** (2,80 / 4,24) | vrstva je viditeľne priehľadnejšia |
| **Filter BW** — odchýlka farby od sivej | **0,04** (bez filtra 146,45) | červený štvorec je po filtri sivý |
| Statické priblíženie (kontrola) | 24,98 vs 1,48 mimo | stará cesta funguje |
| Animované priblíženie | 7,28 → 21,56 → 37,31 | rastie = plynulé |
| Titulky dole | 25,50 | idú navrch |
| Rám výstupu | 1080×1920 | nezmenený |
| Výsledok | **PASS** | |

Vizuálny dôkaz: `docs/real-export-krok10-vrstva.png` — vľavo vrstva pred (vodorovná, nepriehľadná),
v strede po (pootočená 12°, 60 % priesvitná, čiernobiela), vpravo mimo svojho okna (čistý obraz).

## Tretia chyba rovnakej triedy (a prečo na ňu mám test)

Náhľad filtra v runneri preposielal len časť polí vrstvy (bez otočenia/priesvitnosti/filtra),
takže **graf klamal** o tom, čo ide do videa — a runner to sám odhalil tým, že vypísal
`otočenie=nie`. Presne tá istá trieda chyby ako nezhoda `scale`/`scalePercent` v kroku 9.
Preto je v testoch **round-trip** `plán → validácia → filter graf`, ktorý stráži, že sa
na ceste nestratí ani jedno pole.

## Poctivo: čo ešte NIE je

- **BROWSER VERIFIED: nie** — v prostredí nie je prehliadač; runner obchádza UI a volá API appky.
- **Prehrávač v appke** tieto vlastnosti nemá (má vlastné staršie vrstvy) — panel to priznáva.
- **Easing medzi krokmi** animovaného priblíženia sa nezohľadňuje (priebeh je lineárny).
- **Farebný filter je aproximácia** (percepčné CSS vs. lineárne ffmpeg) — priznané v poznámkach.
- **Otočenie robí stredový `rotate` s priesvitnými rohmi**; ak by vrstva bola väčšia než plátno,
  rohy ostanú priesvitné (rovnako to robí aj canvas).

## Ako si to zopakuješ

```bash
bun run tools/verify-canonical-export.ts /home/user/real-media/real_speech.mp4 \
    --plan /home/user/real-media/segments.json --styled-overlay --out /home/user/export-krok10.mp4
bun test tests/overlayStyle.test.ts
```
