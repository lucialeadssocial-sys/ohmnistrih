# Cieľ videa (ČO) a referencia tvorcu (AKO) — krok 26

**Jednou vetou:** referencia hovorí, **ako** má video vyzerať; cieľ hovorí, **čo** má
video spraviť. Obe vstupujú do **existujúceho** rozhodovania (`StylePlan` →
`EditDecision`), nie do nového systému.

---

## 1. Prečo to existuje (problém, ktorý to rieši)

Do kroku 25 vedel nástroj odpovedať na otázku „**ako** to má vyzerať?“ (recepty
z referencií). Nevedel odpovedať na „**čo** to má spraviť?“ — takže to isté video
s Denisovým štýlom vyzeralo rovnako, či má predávať, alebo zbierať odber.

Cieľ preto nie je ďalší štýl. Je to **stratégia**, ktorá prehodnotí existujúce
rozhodnutia:

```
CONTENT  +  VIDEO GOAL (ČO)  +  CREATOR REFERENCE (AKO)
                    ↓
             buildStylePlan()            ← existujúci engine (krok 6)
                    ↓
             EditDecision[]              ← existujúci model
                    ↓
   Review (prijať / upraviť / zamietnuť)
                    ↓
     Apply → snapshot → CommandManager → canonical timeline
```

**Zákazy dodržané:** žiadny nový editor, žiadny nový timeline model, žiadny nový
project model, žiadny druhý AI Director, žiadny paralelný render engine, žiadny
druhý CommandManager. Cieľ je **vstup** do existujúceho `buildStylePlan` a zapisuje
sa do existujúceho `EditDecision` (`style.goalId`, `style.goalFit`, `style.goalFitSk`).

---

## 2. Deväť cieľov (jeden projekt = jeden hlavný cieľ)

| Cieľ | Čo má spraviť | Ako sa prejaví v edite |
|---|---|---|
| 🛒 Predaj | pochopiť ponuku a kúpiť | čísla/výsledky do textu, CTA na konci, menej ozdôb |
| 👤 Odber | vedieť, kto to je, a chcieť ďalšie | hook bez prekrytia, osobnosť a emócia do dôrazu, CTA na sledovanie |
| 👀 Pozornosť / dosah | prežiť prvé sekundy | priblíženie na hook, viac striedania obrazu, švih na nové myšlienky |
| 💬 Komentáre | mať na čo reagovať | otázky a názorové vety do dôrazu, CTA na komentár |
| 🔗 Klik / návšteva | kliknúť na odkaz | sľub hneď na začiatku, kontaktné miesta do textu, pokojnejší rytmus |
| 🎓 Vzdelávanie | pochopiť a zapamätať si | minimum pohybu, postup a čísla do textu, prázdne pauzy zostávajú |
| ❤️ Značka / dôvera | pôsobiť dôveryhodne | pokojný rytmus, konzistentná typografia, dôkazové vety do dôrazu |
| 📩 Lead / kontakt | zanechať kontakt | problém → riešenie čitateľné, čísla do dôrazu, CTA na kontakt |
| 🎬 Príbeh | prežiť príbeh do pointy | emócia a pointa do dôrazu, pauzy zostávajú, pohyb len na obratoch |

Každý cieľ má v kóde (`src/core/style/videoGoal.ts`):

* `strategySk` — čo mení (po ľudsky, zobrazuje sa v UI),
* `intentMarkersSk` — slová, ktoré ten cieľ vo vete nesú,
* `actionMarkersSk` — slová výzvy na akciu (CTA),
* `weights` — čím je veta pre cieľ dôležitejšia (hook, otázka, číslo, emócia…),
* `caps` — koľko priestoru dostať pohybu / textu / podporným vizuálom,
* `requiresSk` — čo cieľ od videa vyžaduje,
* `neverDoesSk` — čo cieľ **nikdy** nerobí (poctivá hranica).

### Päť pák cieľa (a nič viac)

1. **goalFit** — každé existujúce rozhodnutie dostane, ako veľmi jeho veta slúži
   cieľu (0 a viac) + konkrétne dôvody. Zapisuje sa do rozhodnutia (`style.goalFit`),
   takže je dohľadateľné v Review aj v pláne.
2. **Dôraz na výzvu (CTA)** — ak veta obsahuje výzvu, zvýraznenie sa **posilní**
   (`typographyRole: emphasis`) a text je **doslovný úsek vety**.
3. **Viac / menej textu** — cieľ, ktorý chce viac textu, dá text najsilnejšej vete,
   ktorá ešte text nemá (slová cieľa). Cieľ, ktorý chce pokoj, **utlmí** najslabšie
   texty (a povie to).
4. **Utlmenie pohybu** — cieľ, ktorý chce jasnosť (vzdelávanie, značka, príbeh),
   zníži počet pohybových rozhodnutí; vypadnú tie s **najnižším goalFit**.
5. **Hook a striedanie obrazu** — cieľ, ktorý stojí na pozornosti, dá úvodnej vete
   priblíženie (ak tam žiadne nie je) a pridá podporný vizuál na nové myšlienky —
   **najviac toľko, koľko máš nahraných médií.**

Každé vypadnuté rozhodnutie ide do sekcie **„čo som zvážil a nevybral“** s dôvodom.

---

## 3. Referencia tvorcu (AKO) — a pravidlo „nie každý tvorca je preset“

Dva rôzne druhy zdrojov (v UI sú farebne rozlíšené):

| Druh | Čo z neho je | Príklad |
|---|---|---|
| **vizuálny zdroj** (`MEASURED`) | máme **namerané** hodnoty z jeho videí → vzniká recept | AI_KTIVISTA, Denis Vencel, Custom Reference |
| **pracovný zdroj** (`DOCUMENTED_PRINCIPLES`) | berieme **postup** (delenie práce človek/AI, prompting, postprodukcia) — **recept NEMÁME a appka to povie** | Kamil Aujeský, Marek Liška, Marek Bartoš, Runway, DaVinci, YouTube Create |

Zdroj `CUSTOM` (`USER_SUPPLIED`) je **tvoja** referencia: zdrojom je tvoje médium,
ktoré appka zmeria — preto z neho recept existuje.

**Pravidlo, ktoré stráži test:** z tvorcu bez nameraných videí sa **nikdy** nevyrobí
recept; keď klikneš na pracovný zdroj, appka ukáže princípy a napíše, že vizuálny
preset z neho nemá. Recept, ktorý k zdroju nepatrí, sa neprijme (napr.
`AI_CINEMATIC_TAKE` od Kamila Aujeského → odmietnuté s vysvetlením).

---

## 4. Dôkazy (čo je zmerané, čo overené a čo NIE)

Vstup: reálne médium `/home/user/real-media/real_speech.mp4` (345 651 B) + reálny
prepis `/home/user/real-media/segments-krok18.json` (6 viet, 19,9 s). Recept je pre
všetky behy **rovnaký** (`EDITORIAL_COLLAGE`), takže každý rozdiel pochádza **len z cieľa**.

### 4.1 Plán (REAL MEDIA — dáta): to isté video × 9 cieľov

| Cieľ | rozhodnutí | rozdiel proti plánu bez cieľa |
|---|---|---|
| bez cieľa | 21 | — |
| 🛒 Predaj | 19 | motion 6 → 4 |
| 👤 Odber | 20 | motion 6 → 5 |
| 🎓 Vzdelávanie | 17 | motion 6 → 2 |
| ❤️ Značka | 17 | motion 6 → 3, typography 6 → 5, zmenená sila textu |
| 🎬 Príbeh | 19 | motion 6 → 5, text ustúpil |
| 👀 Pozornosť / dosah | 21 | **bez zmeny — a appka presne napíše prečo** |

Platné merania + dôvod pri „bez zmeny“:
`docs/proof-ciel-merania-na-realnom-prepise.json`, výpis `/home/user/kontrola-ciel/merania-plan.txt`.

**Poctivo:** 👀 Pozornosť / dosah na **tomto konkrétnom** videe nemenil nič, lebo
video nemá výzvu na akciu ani jeho slová a hook už priblíženie má (podporné vizuály
sú vyčerpané: 3 z 3 médií). Nástroj to napísal používateľovi aj do plánu — nemlčal
a nič nepredstieral. To je horšie pre marketing a lepšie pre pravdu.

### 4.2 Canonical os (REAL MEDIA + reálny Apply): cieľ sa naozaj zapíše

Cez existujúci `applyStylePlan` (snapshot → CommandManager → canonical timeline),
po každom behu presný rollback:

| Beh | rozhodnutí | aplikované | canonical zmenený | rollback | goalFit |
|---|---|---|---|---|---|
| bez cieľa | 21 | 16 | ÁNO | presný | 0 |
| 🛒 Predaj | 19 | 14 | ÁNO | presný | 19 |
| 👤 Odber | 20 | 15 | ÁNO | presný | 20 |
| 🎓 Vzdelávanie | 17 | 12 | ÁNO | presný | 17 |

**Každá dvojica cieľov má iný canonical stav** (rovnaké video, rovnaký recept):
`null ≠ PREDAJ ≠ ODBER ≠ VZDELAVANIE`.
Dáta: `docs/proof-ciel-canonical-os.json`, výpis `/home/user/kontrola-ciel/merania-canonical.txt`.

### 4.3 Úrovne dôkazu (aby sa nezamieňalo)

| Úroveň | Stav |
|---|---|
| UNIT (logika cieľa, skórovanie, hranice) | ✅ 19 testov — `tests/videoGoal.test.ts` |
| JSDOM / render (obrazovka, tlačidlá cieľov a zdrojov) | ✅ `tests/styleStudioPanel.render.test.tsx` (+4) |
| REAL MEDIA — plán na reálnom prepise | ✅ 9 cieľov, merania uložené |
| CANONICAL (Apply → os → rollback) | ✅ 4 behy, rollback presný |
| UI PRESENT — tlačidlá a texty v markup-e | ✅ |
| UI VERIFIED v prehliadači (klikanie) | ⏳ **neoverené** v tomto kroku |
| REAL EXPORT (vyrenderované video pre cieľ) | ⏳ **neoverené** v tomto kroku (render sa nespúšťal) |

---

## 5. Čo cieľ NIKDY nerobí (a čo appka poctivo povie)

* **Nedopisuje CTA ani slová do textu** — keď výzva v nahrávke nie je, appka napíše
  „nedopisujem ju, doplň ju ty“ a CTA rozhodnutie nevznikne.
* **Nevymýšľa ceny, benefity, čísla, pointu ani otázku.**
* **Negeneruje video ani obrázky** — podporné vizuály len z tvojich médií, najviac
  koľko ich máš; pri vyčerpanom počte to napíše.
* **Nepridáva efekty len preto, že ich referencia používa.**
* **Nemeniť originálne audio** — zvuk zostáva master (`ORIGINAL_VO_MASTER`), cieľ sa
  zvuku nedotýka.
* **Nemeniť štýl:** cieľ nevyberá recept, neprepisuje farby, svetlo ani typografiu —
  to je referencia (AKO). Cieľ rozhoduje, **kde je dôraz a čo sa utlmí**.

Bez zadaného cieľa je plán **presne taký ako predtým** (test B1/B2/B3 to stráži).

---

## 6. Kde to je v kóde

| Súbor | Čo obsahuje |
|---|---|
| `src/core/style/videoGoal.ts` | 9 cieľov, skórovanie viet, poctivé vyúčtovanie (nové) |
| `src/core/style/creatorReference.ts` | zdroje tvorcov + pravidlo „vizuálny vs pracovný zdroj“ (nové) |
| `src/core/style/styleIntelligence.ts` | `applyGoalToPlan()` — päť pák cieľa nad `EditDecision` |
| `src/core/style/styleDecisionTypes.ts` | `goalId`, `goalFit`, `goalFitSk` v `StyleDecisionDetail` |
| `src/components/StyleStudioPanel.tsx` | sekcia **1. Čo má video dosiahnuť?** a **2. Podľa koho?** |
| `tests/videoGoal.test.ts` | 19 testov (cieľ, hranice, referencia) |
| `tools/verify-video-goal.ts` | meranie plánu na reálnom prepise (9 cieľov) |
| `tools/verify-goal-to-timeline.ts` | Apply → canonical os → rollback (4 behy) |

**Poznámka k číslovaniu v UI:** sekcia „Recept“ sa posunula na **3.**, ovládače na
**4.**, plán na **5.**, aplikovanie na **6.** — čísla teraz sledujú poradie rozhodovania
(ČO → AKO → recept → ovládače → plán → apply).
