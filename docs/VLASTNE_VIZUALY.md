# Vlastné vizuály — štyri cesty (krok 27)

**Jednou vetou:** appka vizuály **negeneruje sama od seba** — vie ich načasovať.
Tu si ich vytvoríš alebo prinesieš: **✨ vygenerovaný v štýle videa**, **🌐 z voľnej
knižnice**, **📁 z disku / telefónu**, **🤖 AI obrázkom** (len ak provider naozaj
funguje).

---

## 1. Reality Gate — čo je pravda o AI obrázkoch (overené pred kódom, 30. 9. 2026)

Kľúč v `.env` **vidí** obrázkové modely (`gemini-3.1-flash-image`, `gemini-3-pro-image`,
`gemini-2.5-flash-image`…), ale **každý jeden odpovie na požiadavku takto**:

```
Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests,
limit: 0, model: gemini-3.1-flash-image
```

To znamená: na tomto kľúči je AI generovanie obrázkov **nedostupné** (free tier, limit 0).
**Preto appka nemá tlačidlo „AI vygeneruj obrázok“, ktoré by vždy spadlo.** Namiesto
toho má reálne cesty, ktoré fungujú bez providera — a AI cestu, ktorá **povie presnú
odpoveď**, keď ju niekto skúsi (nikdy nepredstiera úspech).

---

## 2. Štyri cesty

| Cesta | Ako funguje | Provider? | Overené |
|---|---|---|---|
| ✨ **Vytvoriť v štýle videa** | Lokálne (ffmpeg) nakreslí **kartu**: plocha, typografia, vzor — všetko z **palety a typografie zvoleného receptu**. Text je tvoj alebo **doslovne z videa**. | nie | ✅ REAL EXPORT |
| 🌐 **Voľná knižnica** | Openverse (openverse.org), API bez kľúča. Ponúka len licencie, ktoré dovoľujú komerčné použitie a úpravy (CC0, PDM, BY, BY-SA). Pri licencii BY vždy ukáže **text priznania autora**. | internet | ✅ REAL EXPORT |
| 📁 **Z disku / telefónu** | Tvoj obrázok alebo fotka z telefónu (`capture="environment"`). Ide do projektu **tou istou cestou ako nahraté video** (`importMediaFile` → asset → `AddClipCommand`). | nie | ✅ REAL EXPORT |
| 🤖 **AI obrázok** | Naozaj sa pokúsi o providera a **vráti presnú odpoveď** (vrátane „limit 0“). Keď obrázok vznikne, je označený ako AI a appka pripomenie označenie pri publikovaní. | áno (voliteľne) | ⏳ **NOT VERIFIED** — provider na kľúči nemôže |

### Druhy kariet (čo generátor vie)

| Druh | Na čo je |
|---|---|
| **Nadpis** | tvrdé tvrdenie alebo sľub |
| **Číslo / štatistika** | veľké číslo + podtitulok (napr. `70%` / `kratší strih`) |
| **Štítok** | krátka kategória alebo krok |
| **Citát** | veta, ktorá nesie myšlienku |
| **Vzor bez textu** | len plocha a halftone mriežka (na prekrytie alebo pauzu) |

---

## 3. Čo appka NIKDY nerobí

* **Nevymýšľa text vizuálu.** Prázdny text = jasná chyba („appka si text nevymýšľa —
  napíš vlastný alebo použi slová/číslo z prepisu“), nie tichý výmysel.
* **Nedomýšľa si vzor, farby ani typografiu.** Paleta je z receptu (pozadie najtmavšia,
  text najsvetlejšia, akcent najsýtejšia), typografia podľa receptu, vzor podľa textúry.
  Všetko je vidieť **pred** vytvorením.
* **Nestrhne obrázok bez licencie.** NC (nekomerčné), ND (bez odvodenín) a neznáme
  licencie vyraďuje — a povie, koľko vyradila.
* **Neskryje povinné priznanie autora.** Pri licencii `by`/`by-sa` appka pripomenie
  priznanie pri pridávaní aj v zozname a uloží ho do panela na skopírovanie.
* **Nepoužije náhodu.** Ten istý vstup = ten istý obrázok (test to stráži).
* **Neupravuje tvoje médium.** Súbor z disku ide do videa tak, ako je.
* **Nevrství cez seba naslepo.** Vizuál sa pridá ako obrazová vrstva (b-roll); ak by
  prekryl dôležitú mimiku, appka to prizná v poznámkach k rozhodnutiu.

---

## 4. Ako to ide do videa (rovnaká cesta ako všetko ostatné)

```
vizuál (PNG/JPG) → importMediaFile → MediaAsset + AddClipCommand
      → canonical timeline → náhľad → export (existujúci render engine)
```

Žiadna skratka, žiadny druhý render engine, žiadny nový model projektu.

---

## 5. Dôkazy (čo je zmerané a čo NIE)

Vstup: reálne médium `/home/user/real-media/real_speech.mp4` (345 651 B) + reálny
prepis (6 viet, 19,9 s). Text karty je **doslovne z videa** (`70%.`) — nič nedoplnené.

| Krok | Výsledok |
|---|---|
| 1) Generovaný vizuál | ✅ `karta-ai_card_demo-statistic-*.png` (39 139 B, 1080×1920), paleta `#111111 / #FFFFFF / #F08A24`, font DejaVu Sans (bold-condensed), vzor: recept je čistý → bez vzoru |
| 2) Voľná knižnica | ✅ 12 použiteľných z 240 výsledkov; vybraný „The New Study“ — KevinJump, licencia BY 2.0; stiahnuté 171 129 B; priznanie pripravené |
| 3) AI generovanie | ⛔ **NEDOSTUPNÉ** (limit 0 na obrázkových modeloch) — appka to napísala presne |
| 4) Súbor → projekt | ✅ 2 vizuály importované cez `importMediaFile`, každý dostal klip (`clip_…`) |
| 5) Apply (cieľ 🎓 Vzdelávanie) | ✅ 7 rozhodnutí prijatých, B-roll klipy 2 → 3 |
| 6) Plán exportu | ✅ `canExport = áno`, **2 obrazové vrstvy** v pláne (karta + fotka) |
| 7) **REAL EXPORT** | ✅ `vystup-s-vlastnym-vizualom.mp4` (**587 165 B**) — render cez skutočnú linku appky (`POST /api/export/burn-captions`), titulky v zadaní 6 |

**Snímky z hotového videa:** `/home/user/kontrola-vizual/snimka-s-vizualom.png`
(karta „70%. / KRATŠÍ STRIH“ v obraze) a `/home/user/kontrola-vizual/snimka-kniznica.png`
(fotka z knižnice v obraze). Prehľad pre človeka:
**`/home/user/porovnanie-vlastny-vizual.png`** (karta · karta vo videu · fotka vo videu).

Dáta: `/home/user/kontrola-vizual/vizual-dokaz.json` + `vizual-dokaz.txt`.

### Úrovne dôkazu (aby sa nezamieňalo)

| Úroveň | Stav |
|---|---|
| UNIT (generátor, licencie, determinizmus) | ✅ 17 testov — `tests/ownVisual.test.ts` |
| JSDOM / render (panel a jeho štyri cesty) | ✅ 7 testov — `tests/ownVisualPanel.render.test.tsx` |
| REAL MEDIA (karta + obrázok z knižnice na reálnom videe) | ✅ |
| REAL EXPORT (vizuál vo vyexportovanom videu) | ✅ 587 165 B + snímky |
| UI v prehliadači (klikanie, sťahovanie) | ⏳ **NOT VERIFIED** |
| AI generovanie obrázkov | ⏳ **PROVIDER UNAVAILABLE** (limit 0) — nie je to chyba appky, je to stav kľúča |

---

## 6. Kde to je v kóde

| Súbor | Čo obsahuje |
|---|---|
| `src/core/visual/styleCard.ts` | generátor karty: paleta z receptu, typografia, vzor, ASS obsah (nové) |
| `src/core/visual/freeLibrary.ts` | licenčná politika + mapovanie Openverse (nové) |
| `src/core/visual/ownVisualView.ts` | riadky a upozornenia pre rozhranie (nové) |
| `server.ts` | `POST /api/visual/card`, `POST /api/visual/ai-generate`, `GET /api/library/search`, `POST /api/library/fetch` |
| `src/components/OwnVisualPanel.tsx` | panel so štyrmi cestami (nové) |
| `src/App.tsx` | záložka **➕ Vlastný vizuál** + `handleAddOwnVisual` (cez `importMediaFile`) |
| `src/ui/liveCoach.ts` | nový reálny signál `visual_added` + 3 kroky nástroja |
| `src/ui/toolGuides.ts` | výučba nástroja + zaradenie do jednoduchého režimu |
| `tests/ownVisual.test.ts`, `tests/ownVisualPanel.render.test.tsx` | 24 testov |
| `tools/verify-own-visual.ts` | dôkaz: štyri cesty → canonical os → REAL EXPORT |

---

## 7. Otvorené (čo ešte nie je)

1. **AI obrázky** ostanú nedostupné, kým kľúč nemá kvótu na obrázkové modely (alebo
   kým nepribudne iný provider). Appka to hlási presne — nikdy nepredstiera.
2. **Klikanie v prehliadači** (výber súboru, sťahovanie z knižnice, vloženie do videa)
   je UI PRESENT, ale nie UI VERIFIED — v prostredí nie je prehliadač.
3. Zvážiť: vloženie vizuálu na konkrétny čas priamo z panela (dnes ide na koniec
   B-roll stopy a v Style Studiu ho potom načasuje cieľ), a viac druhov kariet
   (graf, zoznam krokov, citát s fotkou).
