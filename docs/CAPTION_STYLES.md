# Možnosti výberu tituliek (krok B+)

> Stav: **hotové a overené na živom renderi** (30. 9. 2026).
> Kód: `src/core/export/subtitleRender.ts` (katalóg štýlov), `captionAdvisor.ts`
> (odporúčanie), `captionPreview.ts` + `src/components/CaptionStylePreview.tsx` (náhľad),
> `BurnCaptionsPanel.tsx` (UI).
> Testy: `bun test tests/captionStyles.test.ts` (38 testov).

## 1. Prečo to existuje

Výber štýlu tituliek je presne to miesto, kde editor stratí najviac času:
pri každej zakázke sa rozhoduje odznova, a zvyčajne to zistí až po vyrenderovaní
videa. Preto má appka:

1. **9 štýlov** (zmes princípov najlepších nástrojov, nie jeden kompromis),
2. **odporúčanie s dôvodmi** — ktorý štýl sedí na tento klip a prečo,
3. **náhľad bez renderovania** — hneď vidno, ako to bude vyzerať, a to s
   **vlastnými slovami z videa**.

## 2. Deväť štýlov

### 🔥 Virálne (krátke formáty, pozerané bez zvuku)

| Štýl | Vzhľad | Najlepšie na | Princíp z |
|---|---|---|---|
| **Virálny (Submagic štýl)** | 3 slová naraz, veľké, aktuálne slovo žlté | TikTok, Reels, Shorts — rýchly hovorený obsah | Submagic / CapCut |
| **Hormozi (1–2 slová, obrovské)** | 1–2 slová cez pol obrazu, aktívne slovo sa zväčší | hook a prvé 3 sekundy, reklama, veľmi rýchle tempo | Hormozi / MrBeast klipy |
| **Karaoke (celá veta po slovách)** | vidno celú vetu, zvýrazňuje sa hovorené slovo | vysvetľovanie, vzdelávanie | karaoke mód v Submagicu |
| **Placka (text na farebnom pruhu)** | biely text na fialovej placce | svetlé a rušivé zábery, beauty, cestovanie, produkt | estetické Reels a UGC reklamy |
| **Zdôraznené čísla a silné slová** | celá veta, ale čísla (`50 %`, `3 000 €`) a silné slová sú oranžové | predaj, výsledky, ponuky | princíp „keyword emphasis“ z kontraktu §3 |

### 🎬 Čisté (rozprávanie, YouTube, B2B)

| Štýl | Vzhľad | Najlepšie na |
|---|---|---|
| **Čistý (celá veta)** | pokojné biele písmo, bez zvýrazňovania | rozhovory, YouTube, keď má video zvuk |
| **Podcast (pokojne, mäkký obrys)** | menšie písmo, rozostup, nič nezakrýva tvár | podcast, talking head, interview |
| **Minimálny** | malé decentné písmo | dokument, firemné video |

### 🏢 Brand

| Štýl | Vzhľad | Najlepšie na |
|---|---|---|
| **Brand (firemné, vyššie v obraze)** | decentný text, rozostup, väčší odstup od okraja | firemné video, portfólio, klientske zadania |

**Poctivo:** pri každom štýle je napísané, **odkiaľ princíp je** („princíp bežný
v Submagic / CapCut"). Nie je to kópia cudzieho kódu a appka nesľubuje, že výsledok
vyzerá 1:1 ako v inom nástroji — je to rovnaký *princíp* (veľkosť, počet slov,
zvýrazňovanie), ktorý je vo videu vidieť.

## 3. Inteligentné zvýrazňovanie (pravidlo, nie AI)

Appka vie zvýrazniť **čísla a silné slová** aj vtedy, keď nemá časovanie slov:

- **čísla a meny**: `3`, `3 000`, `50 %`, `€`, `2x`,
- **veľké skratky**: `VIP`, `B2B` (autor ich sám zdôraznil),
- **krátky zoznam silných slov**: *zadarmo, zdarma, trik, tajný, chyba, nikdy,
  vždy, prvý, posledný, najlepší, rýchlo, ušetrí, výsledok, dôkaz, tajomstvo…*
  (porovnáva sa aj bez diakritiky, takže „tajny“ aj „tajný“).

Je to **čitateľný zoznam a pravidlo** (`isStrongCaptionWord`) — dá sa otvoriť,
skontrolovať a otestovať. Preto sa dá aj obhájiť, prečo je slovo zdôraznené.
Zdôrazňovanie sa dá vypnúť jednoducho: výberom štýlu bez zvýrazňovania (Čistý,
Podcast, Minimálny, Brand). Appka to napíše v poznámkach výsledku.

## 4. Poradca: „Odporúčam pre tento klip“ (0 tokenov)

Poradca je **deterministické pravidlo**, nie AI — rovnaký klip vždy dostane rovnaké
odporúčanie. Vstupom je to, čo o klipe vieme:

| Vstup | Odkiaľ | Čo ovplyvní |
|---|---|---|
| platforma | vybraný formát v RETENTION SHORT | virálne vs. čisté vs. brand štýly |
| rozmery | sonda servera (`ffmpeg -i`) | veľké písmo na výšku, celá veta na šírku |
| tempo strihu | počet úsekov / dĺžka klipu | pri 25+ strihoch/min veľmi krátke bloky |
| rýchlosť reči | slová / dĺžka klipu | rýchla reč → menej slov na obrazovke |
| časovanie slov | automatické titulky | karaoke a zvýrazňovanie hovoreného slova |
| podiel silných slov | text tituliek | štýl so zdôraznením čísel |
| oblasť / klient | knižnica trendov | B2B vs. fitness vs. e-shop |

**Ako sa to zobrazuje:** odporúčaný štýl + 3–4 dôvody („tempo 20 strihov/min —
2–3 slová na obrazovke sedia"), 2 alternatívy s jednou vetou a **upozornenia**
(„Tempo strihu nepoznám — do odporúčania nevstúpilo. Postav strih a odporúčanie
sa spresní."). Nikdy neúčinkuje potichu a **nikdy nesľubuje virálnosť** — testy
to kontrolujú (žiadne „garantované“, „zaručene“, „virálne to bude“).

**Rozhodnutie zostáva na človeku:** odporúčanie je ponuka s tlačidlom „Použiť
odporúčaný", štýl sa dá kedykoľvek zmeniť — pred vypálením.

## 5. Náhľad bez renderovania

Každá možnosť v zozname má **živý náhľad** (rovnaké rozmery ako video, pomer
zachovaný), a to:

- s **tvojimi slovami z videa** (nie s ukážkovým textom),
- s ukážkou zvýraznenia (aktívne slovo / zdôraznené čísla),
- s náznakom „tváre“, aby bolo vidieť, čo titulok zakrýva,
- s poznámkou, čo náhľad ukazuje.

**Poctivo:** prehliadač kreslí písmo trochu inak než libass (render), takže náhľad
je **vizuálna aproximácia**. Je na rýchle „áno/nie, toto je ono“; presné rozhodnutie
o veľkosti je až render. UI to hovorí priamo.

## 6. Chyba, ktorú odhalil živý test (a prečo zostáva v teste)

Pri úprave štýlov sa stalo, že v ASS riadku **chýbalo pole `OutlineColour`**:

```
Style: Default,DejaVu Sans,115,&H00FFFFFF,&H00FFFFFF,,&H00B43CC8,…
```

libass prázdne pole prečíta ako **čiernu** — takže fialová placka sa vykreslila
**čierna**. V testoch to nepadlo (ASS bol „platný“), odhalil to až render
(`ffmpeg`) a kontrola vyrenderovaného snímku.

Opravené dvakrát: farba je späť a v stavbe ASS je **poistka** (prázdne pole sa
nikdy nezapíše). Pribudol test, ktorý pre **každý štýl** kontroluje, že v štýlovom
riadku nie je prázdne pole a že sa použité farby naozaj objavia v ASS.
Pravidlo do budúcna: **čo sa nedá overiť na snímke, nie je hotové.**

## 7. Ako si to vyskúšať

1. RAW → READY → krok 3 → vygeneruj **automatické titulky** (kvôli časovaniu slov).
2. RETENTION SHORT → **Postaviť strih** → „Prehrať náhľad klipu“.
3. V paneli **„Titulky zapečené do obrazu“**:
   - hore je **odporúčanie** (klikni „prečo?“ a uvidíš dôvody),
   - nižšie **Možnosti výberu tituliek** — 9 štýlov s náhľadmi tvojich slov,
   - vyber štýl → zaškrtni potvrdenie → **Vypáliť titulky do videa**.

## 8. Čo ešte nie je hotové (poctivo)

- **Vlastné farby a font** (logo klienta, brandové farby) — dnes sa vyberá z 9
  pripravených štýlov.
- **Animované efekty** (pop-in, typewriter, progresívne odkrývanie) — appka vie
  zväčšenie aktívneho slova (bounce), nič viac.
- **Viac riadkov s pevným počtom znakov na riadok podľa fontu** — dnes je zalomenie
  podľa odhadu šírky znaku (0,55 × veľkosť fontu), čo je overené, ale nie presné
  meranie fontu.
- **Uloženie „môj štýl“ pre klienta** — poradca odporúča, ale voľba sa zatiaľ
  nepamätá medzi sedeniami (napojenie na Edit DNA je najbližší krok).
- **Automatické čítanie štýlu z minulých videí** — Edit DNA vie, ktoré zásahy
  prijímaš; štýl titulkov sa zatiaľ nepamätá.
