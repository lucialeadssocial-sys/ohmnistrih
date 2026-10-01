# KROK 2 — CONTENT MAP NAPRIEČ MÉDIAMI

> Zadanie: pri **30+ surových videách** musí nástroj povedať, ktoré médium je na čo použiteľné
> a **prečo niektoré nie**. Výstup má vyzerať takto:
> `Použiteľné 7/30; hook video 04 00:08–00:14; 12 vyradených (opakovanie/slabá pointa); 11 nepoužitých.`
> Poradie podľa reportu D.4: 0 → 0b → 0c → 1 → **2** → 3 → 4 → 5.

---

## 1. Reality Gate pred kódom (audit)

| Čo už existovalo | Kde | Prečo sa to NEPREBUDOVALO |
|---|---|---|
| Skórovanie viet podľa cieľa (9 cieľov, markery, váhy hook/otázka/číslo/emócia/koniec) | `src/core/style/videoGoal.ts` (krok 26) | je to presne to, čo Content Map potrebuje na „Význam/Relevance“ |
| Sémantické porovnanie viet (prah 0,53 nameraný na SK) | `src/core/media/semanticSegments.ts` (krok 1) | dáva „prečo nie“ pri opakovaní |
| Prepis z tituliek projektu | `src/ai/wireLocalAI.ts` (krok 1) | jediný poctivý zdroj textu, ktorý používateľka naozaj má |

**Nezakladal som** nový Director, nový timeline ani druhý model projektu — Content Map je
**read-only pohľad** (`ContentMap`), ktorý z existujúcich vrstiev skladá jednu tabuľku.

---

## 2. Čo je implementované

| # | Súbor | Čo |
|---|---|---|
| 1 | `src/core/media/contentMap.ts` (nový) | `buildContentMap()` — stĺpce Source / Obsah / Význam (relevance) / Použitie (OPEN, BODY, PRODUCT, PROOF, END, OMIT) + `whySk` pri každej pasáži, `summarySk` v tvare zo zadania, `whyNotList()` |
| 2 | tamtiež | Markovanie produktu/dôkazu (`PRODUCT_MARKERS_SK`, `PROOF_MARKERS_SK`) je **obsahová** klasifikácia — oddelená od „markerov cieľa“, ktoré zostávajú v `videoGoal.ts` |
| 3 | tamtiež | Deterministické poradie pravidiel: opakovanie → slabá pointa → hook (jediný OPEN) → záver (jediný END) → produkt → dôkaz → telo |
| 4 | `MediaIntelligenceInspector.tsx` | Sekcia „Content Map naprieč médiami“: výber z 9 cieľov + tlačidlo **Vypočítať Content Map** (počíta sa len na klik — výkon), rolly farebne, pri každej pasáži dôvod |
| 5 | tamtiež | Médium bez tituliek dostane „NEMÁ DÁTA — …“, nikdy prázdny „význam“ |

**Prečo len na kliknutie:** beh embedding modelu na 30+ médií nie je niečo, čo sa má spúšťať pri
otvorení panela (krok 1 aj pravidlo „negenerovať všetko naraz“).

---

## 3. Dôkazy

| Čo | Úroveň | Výsledok |
|---|---|---|
| `bun test` | UNIT | **897 pass / 0 fail** (40 súborov; +10 v `tests/contentMap.test.ts`) |
| `tsc` / `build` | STATIC | 0 chýb / exit 0 |
| `tools/verify-content-map.ts` na reálnych dátach | **REAL DATA VERIFIED** | 13 médií (12 reálnych popisov tvorcu ai_ktivista + reálny word-level prepis), 109 pasáží, reálny model → `docs/proof-content-map.txt` |
| výstup mapy (reálne) | REAL DATA | `Použiteľné 12/13; hook video 03 (čas sa nedá určiť — pasáž nemá časovanie); 89 vyradených (50 opakovanie, 39 slabá pointa); 1 nepoužitých.` |
| „prečo nie“ (reálne) | REAL DATA | `veta s2 opakuje vetu s0 v tom istom videe (zhoda významu 63 %) — neprináša nový význam.` · `slabá pointa — relatívna relevance 0 % je pod prahom 25 %` |
| determinizmus | REAL DATA | druhý beh = rovnaká mapa |
| appka | **REAL RUNTIME** | `GET /` HTTP 200, Vite servuje `contentMap.ts` (HTTP 200) |
| obrazovka panela | — | **NIE JE OVERENÉ (BROWSER VERIFIED to nie je)** — musí otvoriť používateľka |

**Priznané v dôkaze:** texty v tomto behu sú **POPISY videí**, nie prepis reči — časovanie preto
chýba a hook to nahlas priznáva („čas sa nedá určiť“). Reálne dáta pre „30+ surových videí
s prepisom“ musí dodať používateľka; appka ich spočíta, keď ich nahrá.

---

## 4. Čo je poctivo pomenované (a nesmie sa tvrdiť inak)

1. **Relevance nie je kalibrovaná pravdepodobnosť.** Je to **relatívne poradie v rámci sady**
   (0–1) z `videoGoal` skórovania. V kóde aj v UI sa volá „relatívna relevance“.
2. **Prah 25 %** (pod ním = „slabá pointa“) je **prah výberu**, nie meranie kvality.
   Je konfigurovateľný (`weakRelevance`) a je to napísané pri ňom.
3. **Chýbajúce dáta sa nedopĺňajú** — médium bez textu je v mape s dôvodom a počíta sa
   medzi nepoužité.
4. **Bez lokálneho modelu sa opakovanie nemeria**; mapa funguje ďalej a v `semanticReasonSk`
   to povie.

---

## 5. Čo zostáva

1. **Časovanie z reálneho prepisu** — pri konkrétnom projekte závisí od dostupných tituliek/prepisu;
   Content Map nevytvára transcript a časy si nevymýšľa.
2. **Vizuálna zložka rozhodnutia** — mapa dnes vyhodnocuje text, nie obraz; vizuálne metriky má krok 30b
   (`frameMetrics`), no ich prepojenie s výberom pasáží ešte nie je hotové.
3. **Prenos návrhu do timeline** — Content Map je read-only. Nič tu nie je „aplikované“ a táto obrazovka
   zatiaľ nevytvára `EditDecision[]` ani nemení canonical timeline.

## 6. Krok 3 — prehľad Odporúčané / Nepoužité / WHY NOT

Krok 3 pridáva samostatnú kartu v existujúcom **Media Intelligence Inspector** (nie nový editor ani
nový timeline): `src/components/ContentMapReview.tsx`.

- Filtre: všetko, odporúčané pasáže, médiá bez použiteľných pasáží a WHY NOT.
- Ďalšie filtre: rola, zdroj/text/dôvod vyhľadávanie; WHY NOT možno zúžiť na opakovanie, slabú pointu
  alebo chýbajúci text.
- `whyNotList()` dodáva počet vyradených pasáží; médium bez tituliek sa zobrazuje oddelene ako
  **NEMÁ DÁTA / neposúdené**, nie ako obsahovo nevhodné.
- Zoznam sa dávkuje po 40 položkách, aby veľký projekt nevykreslil všetky pasáže naraz.
- Viditeľné upozornenie: ide o **návrh**, nie o stav canonical timeline. Žiadne Apply, CommandManager
  ani timeline mutácie sa v tomto kroku nepridávajú.
- Výber cieľa sám mapu nepočíta; nový cieľ sa použije až po kliknutí na výpočet. Chyba výpočtu sa
  zobrazí používateľovi a nevymaže predchádzajúcu mapu.

### Dôkazy kroku 3

- `tests/contentMapReview.test.tsx`: **9 pass / 0 fail, 32 assertions**; čisté testy filtrov a SSR
  vykreslenia pokrývajú chýbajúci prepis, WHY NOT typy, vyhľadávanie, roly, click-only stav a chybu.
- Full `bun test`: **893 pass / 13 skipped / 0 fail** (906 testov, 41 súborov, 4 237 assertions).
  13 end-to-end testov je označených skip v existujúcej sade; nie sú to browser testy tohto UI.
- `bun run lint`: TypeScript bez chýb. `bun run build`: exit 0; Vite vypísal upozornenia na `__dirname`
  v configu, veľkosť chunkov a ineffective dynamic import.
- Dev server: HTTP 200 na `/`; Vite servoval oba moduly (`MediaIntelligenceInspector.tsx`,
  `ContentMapReview.tsx`) s HTTP 200. Toto je **runtime serving**, nie kliknutie v prehliadači.
- **UI SSR VERIFIED; BROWSER VERIFIED — NOT VERIFIED.** Filter kliknutia v reálnom prehliadači,
  skutočné dáta používateľkinho 30-videového projektu a reálny export z tohto prehľadu sa netvrdia.
