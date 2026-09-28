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

**Kde ešte strácam čas:** plán sa zatiaľ kotví na odhad z textu (nemáme časovanie slov).
→ F2: skutočné word-level časovanie z prepisu = strihy na presnú sekundu.

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
| Bez plateného API na export | ✅ export zostáva lokálny |
| Žiadne ťažké modely pri otvorení appky | ✅ Whisper/analýza len na vyžiadanie |

## 5. Virálny obsah a trendy

Zatiaľ čiastočne: plán pozná princípy (hook, tempo, front-loading, SFX masking),
ale **nemá živú znalosť trendov**. To je samostatná fáza:

- **Trend Radar**: knižnica formátov a hook vzorcov podľa platformy a niche
  (TikTok / Reels / Shorts / reklama), s vysvetlením, prečo formát funguje.
- **Kontrola virality**: čo videu chýba (hook do 3 s? prvá sekunda bez reči? CTA?),
  nie „skóre z ničoho“ — vždy s konkrétnym dôvodom.
- **Učí sa z mojich videí**: ktoré zásahy som prijal / zamietol (data pre Edit DNA).
- Pozor na čestnosť: žiadne „garantované zhliadnutia“. Trendy sa menia, nástroj
  musí vedieť povedať „toto je princíp“ vs. „toto je dnešný trend“.

## 6. Popritom sa učím

- **Learning mode**: „Prečo?“ pri každom zásahu → technika + kedy ju použiť.
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
