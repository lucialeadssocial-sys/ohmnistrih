# STYLE STUDIO — KROK 9: ANIMOVANÉ PRIBLÍŽENIE (KEYFRAMY)

Záznam merania, nie marketing. Každé číslo vzniklo behom na reálnom médiu.

Dátum: 2026-09-30 · main pred týmto PR: `35c5e9c` (krok 8 + referenčné recepty)

## Čo tento krok rieši

Krok 8 vedel vykresliť **statické** priblíženie (jeden stredový orez na celý klip).
Canonical os ale vie aj **animované** priblíženie — keyframy `scale`, teda plynulý
pohyb kamery. Presne to je v referenčných reels vidieť (punch-in na pointu). Doteraz
appka také klipy renderovala **bez** priblíženia a musela to priznať.

Po tomto kroku sa animované priblíženie **naozaj vykreslí** — cez `zoompan`,
ktorý mení mierku v čase. Rám videa zostáva nezmenený (staré pravidlo z kroku 8).

## Ako sa to robí (bez nového render enginu)

Rozšírená je **existujúca** ffmpeg linka — nič paralelné:

| Miesto | Čo pribudlo |
| --- | --- |
| `canonicalExport.ts` | `animatedZoomFromClip()` — z keyframov klipu zloží priebeh (a **povie dôvod**, keď to nejde) |
| `subtitleRender.ts` | `zoomExpressionFromKeyframes()` + `animatedZoomFilter()` — priebeh ako `zoompan` výraz |
| `burnJob.ts` | validácia krokov (rozsah, čas v okne, počet, žiadne zmenšovanie) |
| `server.ts` | kroky putujú do okna priblíženia |

**Statická cesta sa nezmenila** — bez keyframov je to stále ten istý `crop` (test to stráži).

## Dve veci, ktoré odhalila realita (nie testy)

1. **Nezhoda mien polí.** Canonical plán posiela krok ako `scale`, renderovacia linka
   používala `scalePercent`. Unit testy prechádzali, lebo volali validáciu s „tým
   správnym" menom — **až reálny beh** skončil chybou *„Animované priblíženie má krok
   s neplatným časom alebo hodnotou."* Oprava: validácia prijíma obe mená + nový
   **round-trip test**, ktorý pošle do validácie presne to, čo plán vyrobí.
2. **Výraz, ktorý sa správal nepredvídateľne.** Počas vývoja sa ukázalo, že vnorená
   `if()` logika obalená `min()`/`max()` raz zoomovala a raz nie. Preto priebeh
   zakresľujeme **po častiach lineárne bez `min`/`max`** a rozsah drží konštrukcia
   (prvý krok sa pred svojím časom drží prvej hodnoty, posledná platí do konca).

## Namerané hodnoty (posledný beh, reálne médium)

| Krok | Výsledok |
| --- | --- |
| Animované priblíženie v canonical osi | áno — **cez existujúci CommandManager**, klip „real_speech.mp4": 100 % → 145 % za 14,19 s |
| Ide do linky | 1× (`0,00s=100% → 14,19s=145%`) |
| Filter pre animované priblíženie | obsahuje **`zoompan=`** (mení mierku v čase) |
| Priebeh (výraz) | `if(lt(in_time,14.190),1.0000+(1.4500-1.0000)*(in_time-0.000)/14.190,1.4500)` |
| Rozmer rámu zdroj → výstup | 1080×1920 → **1080×1920 (rovnaký)** |
| Zvuk | obsahovo zhodný so zdrojom (`511feee27c325b3d`) |
| Titulky v obraze (dole) | áno (YAVG 16,39) |
| Obrazová vrstva | v okne 6,56 vs mimo 0,00 |
| Verdikt | **REAL EXPORT Z CANONICAL OSI PASS** |

## Skúška linky na syntetickom podklade (tam je animácia merateľná)

Reálne médium je jednofarebná plocha, takže priblíženie sa na ňom nedá zmerať.
Runner preto skúša linku na syntetickom podklade (farebné terče + mriežka) —
**dve okná naraz**, aby sa oddelilo statické a animované priblíženie:

| Meranie | Hodnota |
| --- | --- |
| Rám výstupu | 1080×1920 (zachovaný) |
| Statické okno (2–4 s): rozdiel vs zdroj | 24,98 (kontrola: mimo okna 1,48) |
| **Animované okno: 5,15 / 6,00 / 6,85 s** | **7,28 → 21,56 → 37,31** (rastie = plynulé priblíženie) |
| Vrstva mimo okna (4,0 s) vs v okne (4,55 s) | 0,18 vs 6,53 |
| Titulky dole | 25,50 |
| Výsledok | **PASS** (statické aj animované priblíženie, vrstva aj titulky) |

Vizuálny dôkaz: `docs/real-export-krok9-animovany-zoom.png` (tri snímky z animovaného
okna — obraz sa zväčšuje, titulky držia dole).

## Čo sa vykreslí a čo nie (a appka to vopred povie)

**Vykreslí sa:** animované priblíženie, keď ide o samotné `scale` (100 % → viac),
bez statického posunu, bez animácie iných parametrov, v rozsahu 100–400 %, max 24 krokov.

**Nevykreslí sa (s dôvodom pri každom klipe zvlášť):**
- animuje sa aj niečo iné (posun, priehľadnosť, rotácia…),
- klip má statický posun obrazu spolu s priblížením,
- priblíženie zmenšuje obraz (pod 100 %) — v ráme by ostali okraje,
- viac ako 24 krokov.

## Poctivo: čo ešte NIE je

- **BROWSER VERIFIED: nie** — v prostredí nie je prehliadač; runner obchádza UI a volá API appky.
- **Prehrávač v appke** stále nemá animované priblíženie (má vlastné staršie vrstvy) — panel to priznáva.
- **Rotácia, priesvitnosť a farebné filtre vrstiev** sa stále nevykresľujú.
- **Easing nie je plne rešpektovaný** — priebeh je lineárny medzi krokmi (canonical easing sa zatiaľ nezohľadňuje).
- Syntetický podklad je syntetický — je to skúška **linky**, nie tvrdenie o videu používateľa.

## Ako si to zopakuješ

```bash
bun run tools/verify-canonical-export.ts /home/user/real-media/real_speech.mp4 \\
    --plan /home/user/real-media/segments.json --animated-zoom --out /home/user/export-krok9-anim.mp4
bun test tests/animatedZoom.test.ts
```
