# KROK 24 — SVETLO Z ICH VIDEÍ IDE NAOZAJ DO VÝSLEDKU

**Zadanie (tvoje slová, 30. 9.):** „Musi to byt vstko co maji oni vo bideach … napodobnit totožné to isté.“

Tento krok zatvára jednu konkrétnu medzeru, ktorú sme našli poctivým auditom:

> Recepty z ich videí (denis_vencel, ai_ktivista) mali **nameraný jas a kontrast**
> ich videí — ale render ich **nepoužíval**. V dokumente z kroku 16 to bolo
> priznané ako `MEASURED STYLE PARAMETER — NOT WIRED TO RENDER`.

Po tomto kroku to už platí takto: **NAMERANÉ → VYPOČÍTANÉ → V NÁHĽADE → V EXPORTE**, s dôkazom na reálnych videách.

---

## 1. Čo je nové v nástroji

| Súbor | Čo robí |
|---|---|
| `src/core/export/lightMatch.ts` (nový) | Výpočet korekcie svetla + **meranie** jasu/kontrastu z pixelov (`lightStatsFromGrayFrames`) + preklad do ffmpeg (`eq`) a do CSS pre náhľad |
| `server.ts` | Nový koncový bod `POST /api/media/light-stats` — zmeria **tvoje** video a hneď vypočíta korekciu na **jeho** video (z receptu štýlu). Korekcia sa už aj **predáva do renderu** (predtým sa len overila a zahodila — to bola chyba, pozri sekciu 4) |
| `src/core/export/burnJob.ts` | Zadanie renderu prijíma a kontroluje korekciu svetla |
| `src/core/export/subtitleRender.ts` | Korekcia sa vloží do ffmpeg linky na základné video (`eq=brightness:contrast`) |
| `src/core/render/renderEngine.ts` | Náhľad kreslí **tými istými číslami** (`lightCorrectionCss`) — náhľad a export sa nemôžu rozísť |
| `src/components/CanonicalExportPanel.tsx` | Tlačidlo „Zmerať svetlo môjho videa a zosúladiť s jeho videom“ + viditeľné čísla (tvoje vs. jeho) a výsledná korekcia. Nič sa nerobí potichu |
| `src/components/StyleStudioPanel.tsx` | Do exportu/náhľadu posiela namerané svetlo **vybraného štýlu** |
| `tools/verify-light-match.ts` (nový) | Dôkazový nástroj: meria → počíta → exportuje **dvakrát** (s korekciou a bez) → meria výsledok |

**Ako sa počíta korekcia** (deterministicky, len z nameraných čísel, žiadny odhad):

- **jas** sa neráta ako „rozdiel“, ale tak, aby sedela stredná hodnota snímky. ffmpeg `eq` totiž ráta `výstup = (vstup − 0,5) × kontrast + 0,5 + jas`, takže pri kontraste ≠ 1 by jednoduchý rozdiel minul cieľ.
- **kontrast** = pomer ich a tvojho kontrastu.
- **limity (bezpečnosť):** jas −0,35 … +0,35, kontrast 0,75 … 1,35. Mimo nich by „napodobnenie“ obrazu uškodilo.
- keď jas narazí na limit, appka v rámci limitov **deterministicky nájde najbližší dosiahnuteľný výsledok** a v poznámke to prizná.
- keď sa merať nedá alebo je rozdiel pod hranicou šumu → **žiadna korekcia** (radšej nič, než vymyslená korekcia).

---

## 2. DÔKAZ NA REÁLNOM VIDEÍ (dva behy, to isté zadanie)

Beh A = bez korekcie (kontrola) · Beh B = s korekciou. Titulky, strih a canonical os sú v oboch **totožné**, takže rozdiel v číslach je prácou svetla — nič iné sa nemenilo.

### A) Jeho video ako zdroj → jeho iné video ako referencia (REÁLNE, obe metriky)

| Meranie | jas | kontrast |
|---|---|---|
| jeho video (referencia) | 142,27 | 57,60 |
| tvoje video (pred) | 93,71 | 70,31 |
| kontrolný beh (bez svetla) | 93,83 (odchýlka −48,44) | 69,78 (odchýlka +12,18) |
| **výsledok (so svetlom)** | **146,75 (odchýlka +4,48)** | **55,07 (odchýlka −2,53)** |

→ **jas aj kontrast sa posunuli k jeho videu.** Log: `docs/proof-svetlo-na-jeho-videe.txt`.

### B) Tmavý testovací klip (krajný prípad)

| Meranie | jas | kontrast |
|---|---|---|
| jeho video (referencia) | 142,27 | 57,60 |
| tvoje video (pred) | 22,03 | 0,23 |
| kontrolný beh (bez svetla) | 23,58 | 15,35 |
| výsledok (so svetlom) | 148,86 (odchýlka +6,59) | 6,90 |

→ jas sa trafil, **kontrast NIE** — a to sa nedá: klip je takmer jednofarebný (jeho vlastná štruktúra, 0,23), takže žiadna bezpečná korekcia z neho detail nevyrobí. Priznávam to, nepredstieram. Log: `docs/proof-svetlo-tmavy-testovaci-klip.txt`.

Čísla z oboch behov (aj s korekciami a identifikátormi renderov): `docs/proof-svetlo-merania.json`.
Vizuálne porovnanie (jeho video | pred | po): `/home/user/porovnanie-svetlo-jeho-video.png`.

---

## 3. Ako to je overené (a čo overené NIE je)

| Oblasť | Status | Dôkaz |
|---|---|---|
| Meranie jasu/kontrastu z reálnych videí | **REAL MEDIA VERIFIED** | dva behy vyššie, `docs/proof-svetlo-merania.json` |
| Korekcia svetla v exporte (ffmpeg `eq`) | **REAL EXPORT VERIFIED** | kontrolný beh vs. beh s korekciou — rozdiel 52,92 (jas) a −14,71 (kontrast) pri totožnom zadaní |
| Koncový bod `POST /api/media/light-stats` | **VERIFIED (HTTP)** | volanie na bežiacej appke: tvoje video 22,03/0,23 vs. jeho 114,04/55,80 → korekcia jas +0,348, kontrast ×0,970 (pri inom recepte ×1,225, jas +0,350) |
| Výpočet korekcie | **UNIT VERIFIED** | `tests/lightMatch.test.ts` — 23 testov (limity, determinizmus, šum, parita čísel) |
| Náhľad kreslí tie isté čísla | **IMPLEMENTED + UNIT VERIFIED** (`composeCanvasFilters`) — **v prehliadači NOT VERIFIED** (v tomto prostredí nie je DOM) |
| Tlačidlo „Zmerať svetlo…“ v panely | **IMPLEMENTED — UI PRESENT; FUNCTIONALITY NOT VERIFIED** (klikanie sa v tomto prostredí overiť nedá) |

---

## 4. Chyba, ktorú som našiel a priznávam

Pri prvom behu som hlásil, že svetlo funguje — **bolo to falošné**. Server korekciu overil, ale **nepredal ju do renderu** (chýbalo jedno prepojenie v `server.ts`). Čísla sa vtedy pohli len preto, lebo kontrast zdvihli vypálené titulky, nie svetlo.

Oprava: korekcia sa teraz predáva do renderu a dôkaz **zámerne obsahuje kontrolný beh bez korekcie** — bez neho by sa rozdiel nedal pripísať svetlu. Toto je presne tá trieda chyby, na ktorú máme pravidlo „nehlás PASS len preto, že test prešel“.

---

## 5. Čo z ich videí EŠTE napodobniť nevieme (poctivo)

- **Generovanie vizuálov** (ich AI klipy, animované prvky) — appka video negeneruje, používa tvoje médiá.
- **Ich konkrétne zábery** — to sú ich nahrávky.
- **Kontrast pri takmer jednofarebnom klipе** — bezpečné limity to nedovolia (viď beh B).
- **Náhľad v prehliadači** — kód je napojený, kliknutie sa v tomto prostredí overiť nedá; treba to skúsiť v appke.

Ďalšie medzery z auditu (rady na poradie): zvuková stránka (hlasitosť/hudba pod hlasom), prechody na hraniciach myšlienok, pohyb kamery (punch-in) pri ich dynamike, dĺžka záberov pri konkrétnych štýloch.
