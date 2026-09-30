# Titulky zapečené do obrazu (krok B)

> Stav: **hotové a overené na živom renderi** (30. 9. 2026).
> Kód: `src/core/export/subtitleRender.ts`, `src/core/export/burnJob.ts`,
> `src/core/export/ffmpegEnv.ts`, `src/components/BurnCaptionsPanel.tsx`,
> endpointy v `server.ts`.
> Testy: `bun test tests/subtitleRender.test.ts tests/burnPipeline.test.ts` (59 testov).

## Prečo to existuje

Klip bez titulkov stratí väčšinu divákov — sociálne siete sa pozerajú **bez zvuku**.
Krok A (presné časovanie slov) dal strihu presnosť; krok B dáva klipu to, čo
platformy odmeňujú: **titulky zapečené v obraze**.

Toto je jediná vec v appke, ktorá **musí prekódovať obraz** (nedá sa kopírovať
packety). Preto je oddelená, pomenovaná a appka ju nikdy nespustí sama.

## Ako to funguje (tri kroky, aby sa dal hlásiť poctivý priebeh)

```
prehliadač                        server (.data/)                       ffmpeg
──────────                        ───────────────                       ──────
1) POST /api/export/upload   →    uploads/<id>__<meno>.mp4
2) POST /api/export/burn-captions → probe videa (rozmery, fps)      →   strih + vypálenie
     ↳ vráti jobId hneď (render beží na pozadí)                          v jednom prechode
3) GET  /api/export/burn-captions/status?id=…  → percentá z ffmpeg
   GET  /api/export/file/<meno>                → stiahnutie / prehratie
```

- **Jeden prechod ffmpeg** = strih (trim + concat) **a** vypálenie titulkov naraz.
  Nič sa neprekóduje dvakrát.
- **Rozmery a snímkovú frekvenciu si server overí sám** (`ffmpeg -i`), neverí
  prehliadaču. Ak sa líšia, appka to napíše (napr. „prehliadač hlásil 720×1280,
  v súbore je 1080×1920").
- **Rám videa sa nemení** — žiadny crop, žiadne zoomovanie. Titulky sa kreslia do
  pôvodných rozmerov.
- Proces pozná `/api/export/ffmpeg` — keď ffmpeg na serveri nie je, panel to povie
  **pred** kliknutím a tlačidlo ostane vypnuté (`FFMPEG_MISSING_SK`).

## Štýly

| Štýl | Vzhľad | Kedy |
|---|---|---|
| `VIRAL_BOLD` (predvolený) | veľké tučné písmo (78 ‰ výšky), 2–3 slová naraz, aktuálne slovo **žlté**, čierny obrys | TikTok / Reels / Shorts |
| `CLEAN` | celá veta naraz, bez zvýrazňovania | rozhovory, podcast, B2B |
| `MINIMAL` | malé decentné písmo | firemné a dokumentárne video |

Zvýrazňovanie aktuálneho slova funguje **len vtedy**, keď sú k dispozícii
word-level časy. Keď nie sú, zvýrazňovanie sa **vypne** a appka to napíše —
žiadne náhodné blikanie.

## Čo sa deje pri strihu (najdôležitejšia časť)

Keď klip vznikne vystrihnutím častí videa, titulky **nesmú zostať v pôvodných
časoch**. `remapSegmentsToOutput()` prekladá titulky (aj jednotlivé slová) z času
zdroja do času hotového klipu:

- slová, ktoré padli do vystrihnutej časti, **vypadnú spolu s ňou**,
- slovo preseknuté strihom sa **oreže** na hranicu strihu a appka to napočíta,
- titulok rozdelený strihom na dva sa **rozdelí** aj v titulkoch,
- titulok bez časovania slov sa priradí k úseku, kam väčšinou patrí
  (aby divák nečítal tú istú vetu dvakrát).

Každá z týchto vecí sa objaví v poznámkach výsledku („1 titulkov ležalo celé vo
vystrihnutých častiach — vo výsledku nie sú.").

## Tichá chyba, ktorú sme našli a opravili (a prečo je tu zapísaná)

Pri strihu (`trim` + `concat`) ffmpeg **stratil snímkovú frekvenciu zdroja**:
30 fps zdroj → 25 fps výstup, 93 snímok → 78. Klip by potichu stratil plynulosť.
Oprava: sonda zistí fps zo súboru a ide do filtra (`fps=30` pred `concat`).
Test to kontroluje naozaj (`tests/burnPipeline.test.ts`: 93 snímok na výstupe).
**Pravidlo do budúcna: čokoľvek sa v reťaze renderu ticho zmení, je chyba.**

## Poctivé mantinely (zobrazujú sa v appke)

1. Vypálené titulky sa **nedajú vypnúť ani upraviť** — sú súčasťou obrazu.
   Preto si najprv prehraj náhľad (EDL náhľad funguje bez renderovania).
2. Táto cesta **prekódováva** video (CRF 20, `veryfast`). Kvalita zostáva vysoká,
   ale nie je to už bit-po-bite originál — na rozdiel od čistého strihu (F2b),
   ktorý kopíruje packety.
3. Rám videa sa nemení, nič sa neorezáva.
4. Pred spustením je potrebné **vedomé potvrdenie** (zaškrtnutie), nie len klik.

## Režijné limity (aby nič nespadlo bez vysvetlenia)

- video na vypálenie: max **512 MB** (väčšie = poctivé odmietnutie s návodom na kratší klip),
- max **5 000** titulkových segmentov, max **500** strihov v jednom prekódovaní,
- `.data/exports` drží najnovších **25** klipov, `.data/uploads` **10** videí —
  staršie sa upratujú (`pruneDir`),
- render sa dá **zastaviť**; rozpracovaný súbor sa zahodí, zdrojové video zostáva nedotknuté.

## Ako si to vyskúšať

1. Otvor appku → **RAW → READY** → krok 3 (Director Plan).
2. Nechaj vygenerovať **automatické titulky** (záložka Titulky) — bez nich sa páliať nedá.
3. V „⚡ RETENTION SHORT" postav strih a klikni **„Prehrať náhľad klipu"** (skontroluj, čo vypadne).
4. Dole v paneli **„Titulky zapečené do obrazu"**: vyber štýl → zaškrtni potvrdenie →
   **„Vypáliť titulky do videa"**. Uvidíš skutočné percentá z ffmpeg.
5. Po dokončení: **Stiahnuť klip** alebo **Prehrať v novej karte** (klip ostáva na serveri).

### Keď je ffmpeg potrebný (lokálne spustenie)

```bash
pip install imageio-ffmpeg     # alebo systémový ffmpeg / FFMPEG_PATH
```

Bez ffmpeg appka funguje ďalej — len vypálenie titulkov odmietne s vysvetlením.

## Overené naživo (30. 9. 2026)

- vstup: 6 s, 1080×1920, **30 fps**, titulky „Dnes si ukážeme" / „tajný postup" /
  „ako som to spravil" (word-level), strih na úseky 0–1,6 s a 3,0–4,5 s,
- prehliadač zámerne poslal nesprávne rozmery 720×1280 → server ich **opravil** na
  1080×1920 a napísal to,
- výstup: **3,10 s, 93 snímok, 30 fps, 1080×1920, H.264 + AAC** (0 snímok stratených),
- titulok „DNES SI UKÁŽEME" v obraze (aktívne slovo `SI` žlté), v čase 1,5 s
  (medzera medzi titulkami) je obraz čistý, v čase 2,0 s je **prepočítaný** titulok
  „AKO SOM TO SPRAVIL",
- diakritika (Ž, Á, Ô, Ň, Ľ) kreslená správne — písmo DejaVu Sans Bold.

Ukážky: `/home/user/ukazka-vypaleny-klip.mp4`, `/home/user/ukazka-vypalene-titulky.png`.

## Čo ešte nie je hotové (poctivo)

- **Žiadne ďalšie efekty** (zoom, trasenie, progresívne odkrývanie textu) — krok B
  rieši len titulky. Zoom je samostatný krok.
- **Bez automatického výberu štýlu podľa klienta** — štýl sa vyberá ručne (pripravené
  je na napojenie na „VLASTNÝ štýl" z Trend Radaru).
- **Bez emoji/SFX v titulkoch** a bez karaoke animácií (Submagic ich má; my zatiaľ
  len zvýrazňujeme aktuálne slovo).
- **Bez sledovania priebehu cez WebSocket** — klient sa pýta každých 0,8 s (pre
  render na serveri to stačí a je to jednoduchšie na údržbu).
- **Jeden render naraz na klipe** — appka nezakazuje spustiť dva, ale `.data`
  upratuje podľa veku, takže pri dvoch veľkých render naraz môže prvý zmiznúť
  (upratovanie drží 25 najnovších klipov).
