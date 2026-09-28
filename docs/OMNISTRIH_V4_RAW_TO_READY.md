# OmniStrih AI — V4: „RAW → READY" (produktová vízia a špecifikácia)

> Stav: **návrh na schválenie** (28. 9. 2026)
> Nadväzuje na `docs/OMNISTRIH_V3_BLUEPRINT.md`.
> Tento dokument je zámer, nie hotová implementácia — popisuje, čo chceme
> postaviť, v akom poradí a aké pravidlá pritom dodržať.

---

## 1. Cieľ produktu

**Nie** ďalší klon CapCutu a **nie** „AI, ktorá vyrobí video za 5 sekúnd“.

**Áno:** profesionálny AI-asistovaný editor, ktorý z akéhokoľvek RAW materiálu
pripraví návrh strihu na úrovni skúseného editora — a posledné slovo nechá na
človeka.

> **Pozicionovanie:** „Som editorka, ktorá vie z akéhokoľvek RAW materiálu rýchlo
> vytiahnuť profesionálny výsledok — Reel, reklamu, podcast, YouTube aj brand video.“
> OmniStrih je **náskok, nie náhrada** editorského oka.

**Merateľný prínos:** pri 30-minútovom RAW videu sa ručná práca skracuje
z ~1,5–3 hodín na ~15–30 minút kontroly. Hlavná úspora nie je renderovanie, ale
to, že človek nemusí pozerať celé RAW video a hľadať každú pauzu a dobrý moment.

---

## 2. Základný princíp: AI rozhoduje, stroj renderuje

```
RAW VIDEO
   ↓
🧠 ANALÝZA           (Silero VAD → faster-whisper, beží len na požiadanie)
   ↓
📋 DIRECTOR PLAN     (AI navrhne zásahy — nič neaplikuje)
   ↓
👁️  REVIEW           (človek vidí zoznam zmien a schvaľuje/zamieta)
   ↓
⚙️  EXECUTION        (Mediabunny vykoná schválené zásahy)
   ↓
✅ QUALITY CHECK     (AI ešte raz skontroluje výsledok)
   ↓
📤 EXPORT            (MP4 · 9:16 · DaVinci XML)
```

**AI nikdy nerenderuje video.** Iba rozhoduje: *toto vystrihnúť, toto zrýchliť
1,5×, tu titulok, tu punch-in.* Ťažkú prácu robí Mediabunny/FFmpeg.
Tým zostane aplikácia rýchla a lacná a export nezávisí od drahých API.

---

## 3. Štyri režimy (rovnaký RAW, rôzny výstup)

| Režim | Formát | Čo je prioritou |
|---|---|---|
| **RETENTION SHORT** | 9:16 / 1:1 / 4:5 | hook, jump cuts, dynamické titulky, punch-in/out, B-roll, SFX, beat-aware strih, auto-reframe |
| **UGC / ADS** | 9:16, 15–60 s | štruktúra hook → problem → solution → proof → CTA, viac hookov, viac CTA, A/B varianty |
| **PODCAST / TALKING HEAD** | 9:16 aj 16:9 | odstránenie ticha/fillerov/zakopnutí, transcript, punch-ins, captions, chapters, highlighty |
| **LONG-FORM PRO** | 16:9, 10–60+ min | kapitoly, dlhodobá kontinuita strihu, B-roll návrhy, audio cleanup, color consistency, intro/outro |

**Director Engine musí mať pre každý režim vlastný profil** (`SOCIAL`, `ADS`,
`STORY`, `YOUTUBE`, `PODCAST`, `CORPORATE`, `CUSTOM`).

---

## 4. Director Plan — jazyk zásahov

Inšpirácia logikou Auto-Editoru (labels/actions) — nemusí to byť len
„vystrihni ticho“:

| Detekcia | Akcia |
|---|---|
| ticho | `CUT` |
| krátka pauza | `KEEP` |
| dlhšia pauza | `SPEED 1.5x` |
| veľmi dlhá pauza | `SPEED 2x` |
| reč | `KEEP` |
| najlepší moment | `HOOK` |
| dôležitá veta | `PUNCH_IN 115 %` |
| kľúčové slovo | `CAPTION_EMPHASIS` |
| prekrytie | `BROLL` |
| pointa | `SFX subtle` |

Parametre `margin` (ochranná rezerva okolo rezu) a `smooth` (vyhladenie) sú
dôležité, aby výsledok nepôsobil usekane.

Príklad výstupu, ktorý používateľ vidí:

```
Hook:              00:03 – 00:08
B-roll:            00:08 – 00:11
Punch-in:          00:14
Remove:            00:18 – 00:19,4
Caption emphasis:  „NEPOTREBUJEŠ VIAC FOLLOWEROV“
SFX:               jemný whoosh
Music:             −24 dB
```

A pri každom zásahu možnosti: **[Použiť] [Upraviť] [Prečo?] [Navrhni lepšie]**

---

## 5. Learning mode — „AI ako osobný učiteľ“

AI nič nerobí potichu. Ku každému väčšiemu zásahu dáva trojicu:

> **✂️ Odporúčam jump cut tu**
> **Dôvod:** medzi vetami je 1,4 s pauza.
> **Prečo to funguje:** zrýchli to tempo a zmenší hluché miesto.
> **🎓 Čo sa učíš:** pacing / retention editing.

- **`LEARNING MODE`** — pri zapnutí AI vysvetľuje a ponúkne *„Skúsim sama“*
  (vypne automatiku a nechá rozhodnutie na človeku).
- **`WHY?`** tlačidlo pri hocijakom zásahu.
- **Edit Academy** — učenie priamo na vlastných videách, úrovne:
  1. Cutting · 2. Retention · 3. Captions · 4. Sound Design ·
  5. Color · 6. Storytelling · 7. Commercial · 8. Professional Workflow
- **Skill Score** — progres v zručnostiach (nie známka). Po projekte:
  „Dnes si sa naučila 3 nové techniky, 2 chyby už neopakuješ, 1 vec si zvládla sama.“

---

## 6. LONG → SHORTS engine

Z jedného dlhého videa automaticky vyrobiť sadu krátkych:

```
45 min LONG-FORM
      ↓ transcript + analýza
   ┌──┴──────────┬───────────┐
 Hook         Story       Insight
  ↓             ↓            ↓
 Reel 30 s    Reel 45 s   Reel 60 s
```

Zákazník pošle jedno hodinové video → dostane 1× YouTube video + 5–15 Shorts/Reels.

---

## 7. Architektúra (oddelenie analýzy od editora)

**Kritické pravidlo:** keď sa aplikácia otvorí, **Whisper ani veľké modely sa
nespúšťajú**. Analýza sa spustí až pri `RAW → READY`, ideálne v samostatnom
worker procese. Tým sa minimalizuje riziko „Frankenstein“ — pomalá aplikácia.

```
┌──────────────────────────────────────────────────┐
│ UI (Vite + React 19)  — existujúce rozhranie    │
└────────────┬─────────────────────────────────────┘
             │  /api/*
┌────────────▼─────────────────────────────────────┐
│ server.ts (Express)  — existuje                  │
└────────────┬─────────────────────────────────────┘
             │
   ┌─────────▼─────────┐        ┌──────────────────┐
   │ ANALYSIS WORKER   │        │ DIRECTOR ENGINE  │
   │ (sidecar proces)  │───────►│ (TS, existuje)   │
   │ VAD → Whisper     │        │ plán zásahov     │
   └───────────────────┘        └────────┬─────────┘
                                         │ Edit Plan
                                ┌────────▼─────────┐
                                │ MEDIABUNNY       │
                                │ execution (TS)   │
                                └────────┬─────────┘
                                         │
                              ┌──────────┴──────────┐
                              ▼                     ▼
                        MP4 / Reel            DaVinci XML
```

**Mediabunny zostáva jadrom** prehrávania a spracovania (TypeScript, MPL-2.0,
takmer nulové závislosti, WebCodecs s hardvérovou akceleráciou, lazy/pipelined).

---

## 8. Bezpečnostné pravidlo pre AI agenta (povinné)

Žiadny „import celého GitHub projektu“. Pred návrhom integrácie musí agent vždy:

1. **LICENSE audit**
2. **dependency audit**
3. **bundle-size audit**
4. **runtime/RAM audit**
5. **duplicita s Mediabunny audit**
6. až potom návrh integrácie

> **Ak existujúca funkcia OmniStrihu robí to isté dobre, cudzí kód sa NEPRIDÁ.**

Doplňujúce pravidlo: ak by prevzatie časti spôsobilo citeľné spomalenie importu,
timeline alebo preview, **nepoužijeme ju**, aj keby bola funkčne skvelá.

Podrobný audit (overené dáta): `docs/TECH_AUDIT_OPENSOURCE.md`.

---

## 9. Export

- **MP4 / Reel** — finálne video.
- **DaVinci Resolve XML / FCPXML** — *editovateľný* projekt, nie len hotové MP4.
  Strih zostane rozdelený na klipy a dá sa ďalej ručne upravovať. Toto je
  preferovaná cesta pre profesionálnu prácu.

---

## 10. Benchmark kvality

Referenčná technická úroveň (nie kopírovanie štýlu): profesionálny slovenský
video-marketing — retention editing, hooky, storytelling.

Ciele „Professional Portfolio Edit“:

- čistý dynamický strih bez zbytočných skokov
- silný hook bez lacných efektov
- B-roll a prekryvy tam, kde podporujú myšlienku
- jemné zoomy/reframing, nie neustále približovanie
- moderné titulky presne synchronizované s rečou
- vyrovnaný a čistý hlas, hudba s automatickým duckingom
- tempo podľa obsahu a emócie — **nie** mechanicky podľa každého ticha
  (napr. „strih každé 1,5–2 s“ nie je univerzálne pravidlo; pri rozhovore môže
  byť záber výrazne dlhší)
- konzistentný vizuálny štýl
- adaptácia na 9:16 bez zničenia kompozície
- efekty iba vtedy, keď majú editorský dôvod

**Dva režimy kvality:** `Fast AI Edit` vs `Professional Portfolio Edit`
(druhý robí **menej, ale kvalitnejších** zásahov).

---

## 11. Návrh fáz implementácie

| Fáza | Obsah | Výsledok |
|---|---|---|
| **F1** | Analysis worker (VAD + Whisper) + `RAW → READY` UI s review zoznamom | reálne fungujúci základ |
| **F2** | Director Engine profily (`SOCIAL`, `YOUTUBE`, `PODCAST`, `ADS`, `CORPORATE`) + Edit Plan aplikovaný cez Mediabunny | použiteľné na prácu |
| **F3** | Captions + 9:16 auto-reframe + audio cleanup | hotový short-form |
| **F4** | DaVinci XML export + práca s 16:9 long-form | profesionálny workflow |
| **F5** | Learning mode, `WHY?`, Edit Academy, Skill Score | rast editorky |
| **F6** | LONG → SHORTS engine | 1 long video → 5–15 shortov |
| **F7** | Quality Check AI + A/B varianty pre Ads | produkčná kvalita |

---

## 12. Otvorené otázky

- Ktorý režim chceš mať funkčný ako **prvý** (odporúčam `RETENTION SHORT` + `PODCAST`)?
- Analýza lokálne (Python sidecar) alebo najprv cez existujúce Gemini API?
  LOKÁLNE = zadarmo a bez limitov, ale treba rátať s inštaláciou modelov.
- Ktoré výstupy sú prioritné: MP4, alebo hneď DaVinci XML?

---

*Poznámka: toto je technický a produktový návrh, nie právne stanovisko.
Pri verejnom/komerčnom vydaní treba skontrolovať aj licencie modelov, fontov,
LUT a ďalších assetov, nielen `LICENSE` súbor repozitára.*
