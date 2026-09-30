# Krok 12 — štýl tvorcu @ai_ktivista (Tomáš Jevčik), meraný z reálnych videí

**Zadanie (user):** „Skús aj od tohto tvorcu mať jeden s výsledkom v aplikácii vo videu, aby vyzerali
ako tento robí“ + odkaz `https://aiktivista.sk/index.html`.

**Čo to znamená v praxi:** z jeho **reálnych videí** namerať, ako vyzerajú, zapísať to ako recept
v appke (nie nový editor, nie nový model) a **vyexportovať reálne video**, ktoré z toho receptu vznikne.

---

## 1. Odkiaľ sú dáta

| klip | trvanie | rozmer | fps | stiahnuté z |
|---|---|---|---|---|
| `aikt-DcdveR6u5Ow.mp4` | 25,19 s | 720×1280 | 30 | IG profil @ai_ktivista (205 000 videní) |
| `aikt-DcBO9PCumX_.mp4` | 18,13 s | 720×1280 | 24 | tamtiež |
| `aikt-Dbp0G8SSFLI.mp4` | 15,23 s | 1280×720 | 30 | tamtiež |
| `aikt-DdRcznCusBh.mp4` | 71,28 s | 720×1280 | 30 | tamtiež |
| `aikt-DctrKeoOO1G.mp4` | 21,92 s | 720×1280 | 30 | tamtiež |
| `aikt-Db6EKCpOpLo.mp4` | 42,95 s | 720×1280 | 30 | tamtiež |

Spolu **194,7 s** reálneho videa. Klipy sú v `/home/user/referencie/` — **mimo repozitára, na GitHub
nešli a nikdy nepôjdu** (cudzie médium).

Stiahnuté cez `i.instagram.com/api/v1/users/web_profile_info` (hlavička `x-ig-app-id: 936619743392459`),
ktorý vracia priame `video_url` na CDN. Iná cesta nefunguje.

---

## 2. Ako sa meralo (a čo to nevypovedá)

Nová meracia vrstva (nie nový editor, nie nový render):

- `tools/measure-reference-video.ts` — vezme celé video a zmeria ho z **pixelov**:
  - **strihy**: ffmpeg `select='gt(scene,0.3)'` + `metadata=print` → časy strihov;
    strihy bližšie než 0,25 s sa zlúčia (inak by dva zápisy jednej zmeny vytvorili falošný 0,02 s záber),
  - **vzorky**: 2 snímky za sekundu, rozmer sa **prispôsobí videu** (kratšia strana 270 px, **bez paddingu**),
  - na každej vzorke beží **tá istá funkcia, akú používa prehliadač** (`analyzeReferencePixels` z kroku 11),
  - **dynamika**: priemerná zmena jasu medzi susednými vzorkami (prepočítaná na sekundu),
  - **súhrn**: medián cez videá (jeden klip nesmie prebiť ostatné) + paleta s podielom, v koľkých videách sa farba vyskytla.
- `src/core/style/referenceVideoStats.ts` — čisté funkcie nad číslami (testovateľné bez prehliadača, bez ffmpeg, bez servera).

**Čo meranie NEvie (a appka to nikde netvrdí):**

- **podiel rečníka v obraze** — bez detektora tvárí sa to zmerať nedá. Pôvodná verzia to „odhadovala“
  z dĺžky záberov a pri 25 s AI zábere bez rečníka hlásila „100 % rečník“ — to bolo **nepoctivé meranie**
  a bolo vymenené za `longTakeRatio` (podiel času v dlhých záberoch), pomenovaný presne tak.
- **text titulkov** — meria sa len svetlosť spodného pásma (nie rozpoznávanie textu).
- **prechody** (dissolve/whip), **zvuk**, **zámer autora**.

---

## 3. Namerané čísla

Súhrn (medián cez 6 klipov): **0,14 rezu/s · 9,25 s na záber · jas 73,4 · kontrast 55,7 · sýtosť 22 % ·
hustota hrán 0,023 · dynamika 24,5/s · svetlý spodok 1/6 videí**.

| klip | tempo | záber | jas | kontrast | sýtosť | dynamika | svetlý spodok | akcent |
|---|---|---|---|---|---|---|---|---|
| DcdveR6u5Ow (drak) | 0,00/s | 25,19 s | 37,9 | 53,8 | 16 % | 13,8 | 0,00 | `#6F869D` |
| DcBO9PCumX_ | 0,06/s | 14,42 s | 52,8 | 47,0 | 24 % | 12,6 | 0,00 | `#815E43` |
| Dbp0G8SSFLI | 0,39/s | 1,56 s | 92,1 | 70,1 | 36 % | 83,0 | 0,23 | `#F8C998` |
| DdRcznCusBh (71 s) | 0,21/s | 3,90 s | 83,0 | 55,8 | 29 % | 35,2 | 0,12 | `#8B4A1B` |
| DctrKeoOO1G | 0,05/s | 21,23 s | 63,8 | **90,9** | 11 % | 11,7 | 0,16 | — |
| Db6EKCpOpLo (svetlý) | 0,26/s | 4,07 s | **162,0** | 55,7 | 20 % | 48,9 | **0,80** | `#FAC918` |

### Hlavné zistenie (a je nepríjemné, ale poctivé)

**Jeho klipy nezdieľajú paletu.** Ani jedna farba sa neobjavila vo väčšine videí; „občasná“ paleta je
`#020304 · #000000 · #E8E3DD · #020303 · #030304 · #010102`. To, čo naozaj zdieľajú, je **tempo a svetlo**:
dlhý záber, minimum strihov a pohyb **vnútri** záberu (kamera letí/kráča), nie strih.

Keby som z toho spravil „jeho paletu“, bol by to vymyslený farebný kód. Preto ju recept nepredpisuje.

---

## 4. Recept `AI_CINEMATIC_TAKE` (14. v appke)

`src/core/style/styleRecipes.ts` — rovnaký `StyleRecipe`, aký používa Director; **žiadny nový model**.

| pole | hodnota | odkiaľ |
|---|---|---|
| `camera` | `fastZoom: false`, `whipPan: "none"` | 0–0,39 rezu/s, žiadne rýchle zoomy v meraní |
| `transitionStyle` | `cut`, `accent: none` | strih je výnimka (namerané) |
| `motionPool` | `["subtle_zoom"]` | pohyb je v zábere (dynamika 11,7–83,0) |
| `captionStyle` | `MINIMAL` | svetlý spodok aspoň v polovici vzoriek len v **1 zo 6** klipov |
| `colorPalette` | `#0A070B · #4A3123 · #6F869D · #E8E3DD` | **namerané odtiene** z jeho klipov — nie „jeho paleta“ (viď zistenie vyššie) |
| `talkingHeadRatio` | 0,3 / 0,7 | z jeho **zverejneného workflow** (Flow/Omni), **nie z merania** — meranie to nezvládne |
| `requiresSk` | „video negeneruje“, „30/70 nie je z merania“, „detektor tvárí nemám“ | poctivosť priamo v UI |

Recept sa v appke objaví automaticky v ponuke receptov (Style Studio číta `STYLE_PRESET_IDS`).

---

## 5. Reálny výsledok (nie test, nie náhľad)

```
bun run tools/verify-canonical-export.ts /home/user/real-media/real_speech.mp4 \
  --plan /home/user/real-media/segments.json --recipe=AI_CINEMATIC_TAKE --animated-zoom \
  --out /home/user/export-krok12-aktivista.mp4
```

**VÝSLEDOK: REAL EXPORT Z CANONICAL OSI PASS** (`docs/real-export-krok12-output.txt`)

- súbor `/home/user/export-krok12-aktivista.mp4`, **410 897 B**, 1080×1920, 30 fps, 19 s,
- pomalé priblíženie **100 % → 145 % za 14,19 s** v canonical osi (cez CommandManager),
- 3 obrazové vrstvy, 6 titulkov z canonical osi,
- **zvuk bajtovo rovnaký** ako zdroj (`511feee27c325b3d` → `511feee27c325b3d`) — pôvodné audio zostalo master,
- merania: rozdiel v zoom okne 24,98 vs mimo 1,48; vrstva v okne 6,53 vs mimo 0,18.

Vstupné médium je **reálne** (`real_speech.mp4`, 20,27 s, reálny prepis 11 segmentov / 51 slov);
titulky pochádzajú z canonical časovej osi, nie z vymysleného textu.

---

## 6. Známe obmedzenia (priznané, nie skryté)

1. **Cesta recept → titulky je stratová.** Canonical vrstva pozná **5 predvolieb** (bold/kinetic/social/
   clean/minimal), appka **9 štýlov**. Recept `MINIMAL` → predvoľba „minimal“ → späť `PODCAST`.
   Plán exportu to **teraz sám píše do poznámok** (a stráži to test).
2. **Podiel rečníka sa nemeria** (bez detektora tvárí) — preto je v recepte priznaný ako prevzatý z workflow.
3. **Paleta nie je zdieľaná** — recept ju podáva ako rozsah nameraných odtienov, nie ako pravidlo.
4. **Prehliadač neoverený.** Meranie aj export bežali cez runner; cesta `createImageBitmap → canvas`
   v prehliadači overená nie je → *UI PRESENT — FUNCTIONALITY NOT VERIFIED*.
5. **AI video appka negeneruje** — recept potrebuje dlhé zábery vyrobené mimo appky.

---

## 7. Testy a reprodukcia

- `tests/referenceVideoStats.test.ts` — **32 testov**: strihy a zlučovanie, dĺžky záberov, podiely podľa
  času, dynamika, agregácia vzoriek, paleta (priemer cez všetky vzorky), poctivosť (rečník sa nemeria,
  text titulkov sa netvrdí), súhrn (medián, „stála vs. občasná“ podľa počtu videí), recept stojí na nameraných číslach.
- `tests/canonicalRender.test.ts` — plán exportu prizná stratu 9 → 5 predvolieb (a neprizná, keď sa nič nestratilo).
- `tests/styleRecipes.test.ts` + `tests/styleStudioView.test.ts` — 13 → **14** receptov.
- Celkovo **536 testov / 0 fail / 23 súborov**, `tsc --noEmit` čistý, build OK.

Meranie sa dá zopakovať jedným príkazom (a je deterministické — dva behy dali rovnaké čísla):

```
bun run tools/measure-reference-video.ts /home/user/referencie/aikt-*.mp4 \
  --out /home/user/referencie/analyza-videa.json
```

Log merania: `docs/reference-video-verify-output.txt` (139 riadkov).
Vizuálna ukážka: `/home/user/ukazka-krok12-aktivista.html`.
