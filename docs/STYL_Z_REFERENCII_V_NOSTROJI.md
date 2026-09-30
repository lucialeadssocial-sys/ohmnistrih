# Štýl z ich referencií — čo je naozaj v OmniStrihe (a čo nie)

**Dátum:** 2026-09-30 · **Reality check:** áno, štýly z **denis_vencel** a **ai_ktivista** sú v nástroji — ako **namerané recepty**, nie ako odhad.
**Dôkaz tohto behu:** nižšie (reálne médium → reálny štýl → canonical os → náhľad → export plán).

---

## 1. Ktoré štýly z ich tvorby sú v nástroji

| Štýl v appke | Odkiaľ (referencia) | Čo sa z jeho videa nameralo | Podiel rečníka |
|---|---|---|---|
| **AI karta (zadaj → výsledok)** | denis_vencel — IG klip | 18,0 s · **0 rezov** (jeden statický záber) · 9:16 · rečník dole, cez obraz karta s výsledkom AI | 85 % |
| **Filmová montáž** | denis_vencel — IG klip | 54,3 s · **88 rezov = 1,62 rezu/s** · priemerný záber **0,61 s** · 720×1280 | 25 % |
| **Expert + koláž na obrazovke** | denis_vencel — IG klip | 93,6 s · **43 rezov** · koláž doplnkových prvkov na obrazovke | 60 % |
| **AI kinematografický záber** | ai_ktivista — 6 IG klipov (medián) | **0,14 rezu/s · 9,25 s na záber**, pohyb vnútri záberu (dynamika 24,5/s), jas **87,51** / kontrast **55,92** | 30 % |
| **Edu talk — slovo po slove** | ai_ktivista — 12 TikTokov (medián) | jas **114,04** / kontrast **55,8**, sýtosť ~30 %, vložené ilustrácie/karty k tomu, čo hovorí | 60 % |

Čísla sú zapísané priamo v receptoch (`src/core/style/styleRecipes.ts`, pole `measuredLight.sourceSk`) — appka pri každom štýle vie povedať, z čoho to číslo je.

## 2. Čo ten štýl na tvojom surovom videe naozaj spraví

Reťaz je tá, ktorú appka má od kroku 16 (žiadny obchádzkový režim):

```
surové video → prepis (časovanie slov) → štýl (recept) → Style Intelligence (lokálne, deterministicky)
   → rozhodnutia s WHY / WHEN NOT → REVIEW (prijať / upraviť / odmietnuť)
   → snapshot → CommandManager → CANONICAL ČASOVÁ OS → náhľad + export z tej istej osi
```

Konkrétne to znamená: **pribudnú/zmiznú klipy na časovej osi** (titulky/grafické texty podľa viet, ktoré naozaj povieš), **zmenia sa časy a dĺžky** textov, **pribudnú/zmiznú pohyby (priblíženia)** podľa receptu, a všetko sa to prejaví **v náhľade aj v exporte** — pretože obe idú z tej istej canonical osi.

## 3. Dôkaz tohto behu (reálne médium, reálny štýl)

Surové video `real_speech.mp4` (20,27 s, reálny prepis 6 viet / 48 slov). Pre každý štýl sa spustil celý reťazec a meralo sa **pred/po**:

| Štýl | BEFORE ≠ AFTER | Úprava rozhodnutia (Edit) prejde do osi | Parita náhľad ↔ export | Verdikt behu |
|---|---|---|---|---|
| AI_CINEMATIC_TAKE (ai_ktivista) | **true** | áno | **OK** | **ÁNO** |
| EDU_WORD_TALK (ai_ktivista) | **true** | áno | **OK** | **ÁNO** |
| AI_CARD_DEMO (denis) | **true** | áno | **OK** | **ÁNO** |
| FILM_MONTAGE (denis) | **true** | áno | **OK** | **ÁNO** |
| EXPERT_COLLAGE_TALK (denis) | **true** | áno | **OK** | **ÁNO** |

Logy: `docs/proof-styl-aktivista-na-surovom-videu.txt`, `docs/proof-styl-denis-na-surovom-videu.txt`.
Rollback v každom behu obnoví stav presne (líši sa len evidencia verzií — odkaz na snapshot pred aplikovaním, čo je zámer).

## 4. Ako to použiješ v appke

1. Nahraj surové video, daj ho prečítať (analýza + prepis).
2. Otvor **Style Studio** → vyber jeden z tých štýlov (alebo nahraj vlastnú referenciu).
3. Pozri si, **čo appka z referencie odmerala** a čo navrhuje (pri každom návrhu je WHAT / WHY / WHEN NOT / ALTERNATIVE).
4. **Prijať / Upraviť / Odmietnuť** — čo odmietneš, sa do časovej osi nedostane.
5. **Apply** → zmení sa canonical časová os (predtým sa uloží verzia, na ktorú sa vieš vrátiť).
6. **Export** — vypáli sa presne to, čo vidíš v náhľade.

## 5. Čo to NIE je (aby si nečakala niečo, čo appka nerobí)

| Očakávanie | Realita |
|---|---|
| „Appka vygeneruje vizuály ako on" | **NIE** — generovanie obrázkov/videa appka nemá (`PROVIDER UNAVAILABLE`). Vie ich **načasovať**, keď ich máš (B-roll, karty, screenshoty). |
| „Skopíruje presne jeho strih" | **NIE** — preberá **namerané parametre** (tempo strihu, dĺžka záberu, svetlo, typografia, podiel rečníka), nie konkrétne zábery. |
| „Zmení zvuk/hudbu" | **NIE** — pôvodné audio sa nemení bez tvojho výslovného pokynu. |
| „Vygeneruje titulky z ničoho" | **NIE** — texty sú **z tvojej reči** („text prevzatý z vety, nie vygenerovaný"). |
| Podiel rečníka napr. 30/70 | Pri niektorých štýloch je to **z jeho zverejneného workflow, nie z merania videa** (bez detektora tvárí sa podiel rečníka zmerať nedá) — v recepte je to napísané. |

## 6. Priznaná chyba tohto behu (a jej oprava)

Prvý beh na štýle **AI_CINEMATIC_TAKE** hlásil `PREVIEW PARITY — FAIL` a verdikt NIE. **Príčina bola v mojej meracej pomôcke, nie v appke:** runner vybral to isté rozhodnutie ako „textové" aj „pohybové", takže druhý zápis do toho istého kľúča ticho prepísal textovú úpravu. Opravené v `tools/verify-style-to-timeline.ts` (pohybové rozhodnutie musí byť iné; úpravy sa skladajú cez merge; pohybovú úpravu verdikt vyžaduje len vtedy, keď recept také rozhodnutie naozaj má). Po oprave prešlo **všetkých 5 štýlov**. Appka sa pritom nemenila.
