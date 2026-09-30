# Kontrakt kvality — OmniStrih pre profesionálneho editora

> Toto je prepis predstavy zadávateľa do merateľnej podoby. Pri každej ďalšej zmene
> sa pýtam: **posúva to niektorú z týchto piatich vecí?** Ak nie, do produktu to nejde.

Zadanie znie: *„Chcem kvalitný a spoľahlivý nástroj, ktorý mi ušetrí hodiny práce.
Som video editor. Z RAW materiálu chcem vytvoriť profesionálny obsah pre sociálne
siete, reklamu aj YouTube — rýchlo, kreatívne a technicky čisto. Virálny obsah
a trendy. A popritom sa chcem učiť."*

---

## 1. Ušetrí hodiny práce (nie minúty)

| Kritériá | Ako to meriam | Stav |
|---|---|---|
| Plán strihu z 30-minútového RAW vznikne do 30 s | čas odpovede `/api/director/plan` | ✅ offline plán ~1 s, AI podľa modelu |
| Editor nerobí ručne to, čo vie stroj: hľadanie výplne, hluchých miest, pointy | koľko zásahov je „hotových na schválenie“ | ✅ 6–9 zásahov na 5-min video |
| Každý zásah je **konkrétny**, nie „niekde v strede videa“ | nesie čas + citovanú vetu | ✅ od F1.6 (kotvenie na prepis) |
| Aplikovanie plánu = 1 klik, nie ručné prepisovanie | počet klikov od plánu k strihu | ✅ „Použiť vybrané“ → timeline |
| Nikdy nečakám na niečo, čo som si nepýtal | analýza neštartuje pri otvorení appky | ✅ lazy load + explicitné tlačidlo |

**Kde už nestrácam čas:** plán aj strih sa kotvia na **skutočné časovanie slov**
z automatických tituliek (krok A, 29. 9. 2026) — strihy sedia na hranice slov
a do páuz, takže divák strih nepočuje. Presnosť je vidieť v paneli („Časy sú presné
na slová"), aj s počtom a veľkosťou posunov.

**Kde ešte strácam čas:** klip treba po strihu ešte ručne otitulkovať v inej appke.
→ **Krok B (30. 9. 2026): titulky zapečené do obrazu sú hotové** — strih + vypálenie
v jednom prekódovaní, priamo z appky.

## 2. Profesionálny obsah pre sociálne siete, reklamu aj YouTube

| Režim | Čo musí plán rešpektovať | Stav |
|---|---|---|
| RETENTION SHORT (Reels/TikTok/Shorts) | hook do 3 s, agresívnejšie tempo, formát 9:16 | ✅ režim + hook + crop |
| UGC / REKLAMA | hook → problém → riešenie → CTA, dôveryhodnosť | ⚠️ plán vie, CTA a štruktúra prídu vo F3 |
| PODCAST / talking head | nič nerozbíjať, zachovať kontext a pointu | ✅ konzervatívnejší strih (max 3 zásahy) |
| YOUTUBE long-form | kapitoly, kontinuita, menej efektov | ⚠️ F2/F3 — kapitoly + kontinuita |
| FIREMNÉ / BRAND | čistota a konzistencia pred efektom | ⚠️ šablóny prídu vo F3 |
| VLASTNÝ štýl | riadi sa mojimi poznámkami | ✅ pole „Poznámky pre AI“ |

**Profesionálne znamená aj:** žiadny efekt len preto, aby tam bol. Preto má plán režim
**PORTFÓLIO** (menej, ale kvalitnejších zásahov) a každý zásah musí obhájiť svoj dôvod.

### 2.1 Titulky zapečené do obrazu (krok B) — hotové

Klip pre TikTok/Reels/Shorts sa pozerá **bez zvuku** — bez titulkov v obraze je aj
najlepší strih stratený. Preto appka vie klip vyrenderovať **s titulkami zapečenými
do obrazu** (RAW → READY → krok 3 → panel „Titulky zapečené do obrazu"):

- **strih a vypálenie v jednom prechode ffmpeg** — jedno prekódovanie, nie dve,
- štýly: `VIRAL_BOLD` (Submagic/CapCut štýl, aktuálne slovo žlté), `CLEAN`, `MINIMAL`,
- zvýrazňovanie slov funguje len s word-level časmi; keď nie sú, **vypne sa a povie to**,
- pri strihu sa titulky **prepočítajú na čas klipu** (slová z vystrihnutých častí
  vypadnú, preseknuté sa orežú — a appka to napíše),
- server si **overí rozmery a fps zo súboru** (nepotichu nemení rám videa ani
  nevyhadzuje snímky),
- poctivo priznané: vypálené titulky sa nedajú vypnúť, táto cesta prekóduje,
  preto je pred spustením vedomé potvrdenie a skutočné percentá z ffmpeg,
- **AI stále nerenderuje** — render je ffmpeg na serveri, spúšťaný používateľom.

Dokumentácia a overené čísla: `docs/BURNED_CAPTIONS.md`.

## 3. Kreatívne — ale nie náhodne

- AI navrhuje **techniky, nie efekty**: front-loading, tight opening, speed ramp,
  SFX masking, framing + timing, keyword emphasis.
- Každý zásah má `lesson` — čo z neho platí aj nabudúce, bez ohľadu na tento klip.
- Kreativita sa nesmie vymknúť realite videa: plán sa validuje (časy orežeme do
  dĺžky klipu, prekrývajúce sa strihy sa zlúčia, max 20 zásahov).

## 4. Technicky čisto

| Požiadavka | Stav |
|---|---|
| AI **nikdy** nerenderuje video — iba rozhoduje | ✅ AI vracia JSON plán, render robí Mediabunny/FFmpeg |
| AI nič nerobí potichu — vždy povie, čo a prečo | ✅ `reason` + report „Zapísané do strihu“ + „Prečo?“ |
| Nič sa nezmení, kým to neschválim | ✅ `status: proposed` → akcia Použiť/Zrušiť |
| Keď niečo zlyhá, viem prečo | ✅ `fallbackReason`, `rawError`, čestné `basis` |
| Vypálené titulky = jediné prekódovanie, a to výslovne na požiadanie | ✅ žiadne tiché prekódovanie; čistý strih kopíruje packety |
| Pri strihu sa nič „potichu" nemení (fps, rám, čas titulkov) | ✅ fps zo sondy, rám bez cropu, titulky prepočítané na čas klipu |
| Bez plateného API na export | ✅ export zostáva lokálny |
| Žiadne ťažké modely pri otvorení appky | ✅ Whisper/analýza len na vyžiadanie |

## 5. Virálny obsah a trendy

**Stav: Trend Radar v1 je hotový** (krok 3 → prepínač „🔥 Trend Radar"):

- **Kontrola virality** — deterministická (0 tokenov), hodnotí hotový plán pre zvolenú
  platformu: hook do 3 s, prvá sekunda, titulky, tempo (strihy/min), framing, zvukový
  akcent, dĺžka, podiel vystrihnutého materiálu, uzáver, samostatný klip. Každý nález má
  **detail, opravu aj dôvod** — nikdy len číslo.
- **Knižnica**: 12 princípov, 12 hook vzorcov, 10 formátov, 8 červených vlajok pre
  5 platforiem a 10 oblastí (klientov). Pri každej položke je mechanizmus, riziko a
  **kedy to nepoužiť**.
- **Poctivosť**: knižnica má dátum overenia (28. 9. 2026). Princípy platia roky, formáty
  sa menia — nástroj to hovorí priamo. Žiadne „garantované zhliadnutia“; testy to
  kontrolujú (ochrana proti marketingovému klamstvu).
- Testy: `bun test tests/trendLibrary.test.ts` (12 testov, 203 kontrol).

Ešte chýba:

- **Trend Radar**: knižnica formátov a hook vzorcov podľa platformy a niche
  (TikTok / Reels / Shorts / reklama), s vysvetlením, prečo formát funguje.
- **Kontrola virality**: čo videu chýba (hook do 3 s? prvá sekunda bez reči? CTA?),
  nie „skóre z ničoho“ — vždy s konkrétnym dôvodom.
- **Učí sa z mojich videí**: ktoré zásahy som prijal / zamietol (data pre Edit DNA).
- Pozor na čestnosť: žiadne „garantované zhliadnutia“. Trendy sa menia, nástroj
  musí vedieť povedať „toto je princíp“ vs. „toto je dnešný trend“.

### 5.1 Živé signály z platforiem (F5) — hotové

Knižnica (vyššie) je **naučené princípy**. Vedľa toho appka od 29. 9. 2026 ťahá
**reálne dáta z platforiem** (Trend Radar → záložka „📡 Živé signály"):

- **Google Trends** (bez kľúča): čo ľudia práve hľadajú v SK/CZ/US — aj s približným
  záujmom a správou, ktorá to spustila.
- **YouTube kanálové RSS** (bez kľúča): čerstvé príspevky kanálov, ktoré si pridáš.
  Počet zhliadnutí feed neposiela — appka to **prizná**, nevymýšľa.
- **YouTube rebríček** (voliteľný bezplatný kľúč): oficiálny rebríček s počtami
  zhliadnutí — jediný zdroj, ktorý hovorí „čo naozaj funguje".

Mantinely, ktoré platia (a sú otestované):

1. **Nič sa nespúšťa samo** — otvorenie appky ani panelu neposiela na platformy ani
   jeden dotaz. Signály sa stiahnu len po kliknutí; cache má TTL 30 min.
2. **Každé zlyhanie má dôvod** — aj „nemám kľúč" je vysvetlené s návodom, nie ticho.
3. **Žiadne sľuby** — signál je surovina, nie záruka zhliadnutí. Zhrnutie to hovorí samo.
4. **Signály do plánu idú len cez výber človeka** a panel ukazuje **presne ten text**,
   ktorý ide AI (aby nič nešlo potichu).
5. **TikTok a Instagram Reels nie sú napojené** — nemajú bezplatné verejné API na
   trendy a neobchádzam to čítaním stránok. Dôvod je napísaný priamo v appke.

Dokumentácia: `docs/LIVE_TRENDS.md`.

## 6. Popritom sa učím

**Stav: Learning mode + Edit DNA v1 hotové.**

- **Learning mode**: „Prečo?“ pri každom zásahu → technika + kedy ju použiť. ✅
- **Edit DNA** (0 tokenov, lokálne v prehliadači) ✅
  - pamätá si, ktoré zásahy prijímaš a ktoré zamietaš, osobitne pre každý typ zásahu
    aj pre každý režim strihu (iný strih na Reels, iný v podcaste),
  - nabudúce upraví **istotu** zásahov podľa tvojich rozhodnutí (max ±0,15) a **vždy
    napíše prečo** — nikdy neúčinkuje potichu,
  - **nemení štruktúru plánu**: neodstraňuje, nepridáva ani neprehadzuje zásahy,
  - pri menej než 5 rozhodnutiach o danom type **nerobí nič** a povie to — žiadne
    hádanie z dvoch klikov,
  - učí sa len v momente, keď klikneš „Použiť vybrané“ (nie z rozklikávania),
  - dá sa vypnúť prepínačom a úplne vymazať („Vymazať naučené“),
  - záložka **🧠 Môj štýl** ukazuje prehľad: prijaté/zamietnuté a podiel prijatia.
  - Testy: `bun test tests/` (31 testov celkom, z toho 19 pre Edit DNA).

Ešte chýba:
- **Edit Academy**: po každom projekte krátke zhrnutie, čo si aplikoval a prečo.
- **Skill Score**: čo už vieš sám, kde ti AI stále pomáha — bez hodnotenia, len mapa.
- AI má učiť techniku, nie vytvárať závislosť. Cieľ: po čase vieš AI návrh obhájiť
  alebo zamietnuť sám.

---

## Pravidlá, ktoré sa nesmú porušiť (tvrdé mantinely)

1. AI nikdy nerenderuje — iba navrhuje.
2. Render zostáva na Mediabunny/FFmpeg, appka sa nestavia na OpenCut.
3. Cudzí kód sa neimportuje bez licenčnej, závislostnej, veľkostnej a RAM auditórie;
   ak to už OmniStrih vie, cudzí kód sa nepridáva.
4. Žiadne platené API na export.
5. Analýza nikdy neštartuje sama pri otvorení appky.
6. Každá zmena ide do súborov na GitHube (vetva + PR).
7. Ak niečo neviem, poviem to — nie „fake AI“, ktorá predstiera výkon.

## Ako si overíš, že kontrakt platí (5 minút)

1. Otvor appku → všimni si, že sa **nič** nespúšťa samo. *(bod 1)*
2. RAW → READY → krok 3 → vlož prepis → *Spustiť RAW → READY*. *(body 1, 3)*
3. Skontroluj, že pri každom zásahu vidíš **konkrétnu vetu** a odznak „z prepisu“.
   *(bod 1)*
4. Klikni na *Prečo?* — musíš dostať techniku, nie omáčku. *(body 3, 6)*
5. Vymaž prepis → spusti znova → plán sa musí **sám priznať**, že je to odhad. *(bod 4)*
