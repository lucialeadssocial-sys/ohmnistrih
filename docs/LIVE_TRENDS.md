# ŽIVÉ SIGNÁLY — ako je OmniStrih napojený na platformy (F5)

Tento dokument vysvetľuje, **odkiaľ** appka berie trendy, **čo to naozaj znamená**
a **čo zámerne nepripájam**. Je krátky zámerne.

## 1. Zásady (rovnaké ako inde v appke)

1. **Nič sa nespúšťa samo.** Otvorenie appky ani prepnutie na Trend Radar
   neposiela ani jeden sieťový dotaz na platformy. Signály sa stiahnu **len po
   kliknutí** na „Obnoviť signály".
2. **Každé zlyhanie má dôvod.** Keď zdroj neodpovie, v paneli je napísané prečo
   (HTTP stav, timeout, chýbajúci kľúč). Nikdy prázdno bez vysvetlenia.
3. **Žiadne sľuby.** Signál je surovina na rozhodnutie, nie záruka zhliadnutí.
   Aj najsilnejší trend vyjde nazmar bez vlastného uhla pohľadu.
4. **Kľúč neopúšťa server.** Do prehliadača ide len informácia, že kľúč je
   nastavený (a jeho posledné 4 znaky).

## 2. Čo je napojené

### Google Trends (bez kľúča) — `trends.google.com/trending/rss?geo=SK`

- **Dáva:** čo ľudia práve teraz hľadajú v danej krajine, s približným záujmom
  (`500+`, `5000+`) a správou, ktorá to spustila.
- **Nedáva:** žiadnu informáciu o TikToku či Reels. Je to záujem o tému, nie
  dôkaz, že z toho bude virálne video.
- **Overené naživo:** 10 tém pre SK, 10 pre CZ, 10 pre US. Reálny výsledok
  (29. 9. 2026): „staškov" 20 000+, „prvázdniny" 5 000+, „peter may", „tomáš taraba".

### YouTube kanálové RSS (bez kľúča) — `youtube.com/feeds/videos.xml?channel_id=…`

- **Dáva:** čo práve zverejnili kanály, ktoré si sama pridáš (dátum, titulok, odkaz).
- **Nedáva:** počet zhliadnutí. Súčasný formát feedu ich neposiela — a v appke sa
  preto **nevymýšľajú**. Panel to sám prizná: „hovoria, čo vyšlo, nie čo funguje".
- Kanál pridáš odkazom (`youtube.com/@meno`) alebo ID. Appka si ID **overí** cez
  canonical odkaz **a spätne cez RSS** — aby omylom nesledovala iný kanál.

### YouTube rebríček (voliteľný kľúč) — Data API v3 `videos.list?chart=mostPopular`

- **Dáva:** oficiálny rebríček najpopulárnejších videí podľa krajiny, **aj
  s počtom zhliadnutí** a menom kanála. Toto je jediný zdroj, ktorý naozaj
  hovorí „čo funguje".
- **Cena:** 1 jednotka z 10 000 na deň (pri 2 krajinách = 2 jednotky na obnovenie).
  Search API (100 jednotiek) appka **nikdy** nepoužíva sama od seba.
- Bez kľúča appka napíše, čo chýba a ako to získať — tvári sa to ako zlyhanie
  s dôvodom, nie ako „nemám dáta".

**Ako získať kľúč (zdarma, ~2 minúty):**
1. `console.cloud.google.com` → vytvor projekt (môže byť hocijaký názov).
2. „APIs & Services" → „Library" → hľadaj **YouTube Data API v3** → **Enable**.
3. „APIs & Services" → „Credentials" → **Create credentials** → **API key**.
4. Skopíruj kľúč a vlož ho do `POST /api/trends/settings`
   (`{"youtubeApiKey":"AIza…"}`). Odporúčam kľúč obmedziť na YouTube Data API v3.

## 3. Čo zámerne NIE je napojené (a prečo)

| Platforma | Dôvod |
|---|---|
| **TikTok** | Nemá bezplatné verejné API na trendy. Existuje len akademické (Research API) a firemné (Display API). Neoficiálne čítanie stránok by bolo proti ich pravidlám a rozbilo by sa pri prvej zmene — nechcem do nástroja zabudovať niečo, čo o týždeň prestane fungovať. |
| **Instagram Reels** | Oficiálne API vydáva dáta len o **vlastnom** firemnom účte, nie o cudzích virálnych videách. Globálny prehľad trendov z neho získať nemožno. |
| **Reddit** | Verejné JSON rozhranie je bez kľúča, ale servery Redditu odmietajú požiadavky z tohto prostredia (HTTP 403). Nechávam vypnuté — radšej nič než tiché prázdno. |

Ak budeš raz chcieť TikTok/IG prehľad, najčastejšia cesta je **ručný vstup**
(oblepíš, čo vidíš na ich stránke s trendmi) — viem to dorobiť tak, aby sa
z toho stal normálny signál s dátumom a zdrojom.

## 4. Kde sú dáta uložené

| Súbor | Obsah |
|---|---|
| `.data/trend-sources.json` (600, gitignored) | nastavenia: krajiny, sledované kanály, voliteľný YouTube kľúč |
| `.data/trends-cache.json` (600, gitignored) | posledná dávka signálov + kedy bola stiahnutá |

Cache má **TTL 30 minút**: keď klikneš Obnoviť do pol hodiny, appka povie, že má
čerstvé dáta a nič nesťahuje (chráni to zdroje aj kvótu). Tlačidlo „Obnoviť aj tak"
TTL obíde.

## 5. Ako sa signály dostanú do plánu

1. V Trend Radare → **Živé signály** označíš tie, ktoré sa hodia k téme videa.
2. Panel ukáže **presne ten text**, ktorý pôjde AI (žiadne skryté správanie).
3. „Použiť pri ďalšom pláne" → text sa pripojí k promptu ako **fakty s dátumom
   a zdrojom**, s vetou: *„sú to reálne dáta, nie tvoj odhad"*.
4. Ak sa signály k obsahu nehodia, AI to má povedať a navrhnúť plán bez nich.

## 6. Hodnotenie signálov (skóre 0–100)

- **Google Trends:** logaritmicky podľa záujmu + prídavok za čerstvosť
  (do 6 h +12, do 24 h +6).
- **YouTube rebríček:** logaritmicky podľa zhliadnutí, kalibrované tak, aby sa
  **nezaseklo na 100** už pri 100 tis. zhliadnutiach:
  10 tis. → 50 · 100 tis. → 63 · 1 mil. → 75 · 10 mil. → 88 · 100 mil. → 100.
- **Kanálové príspevky:** bez počtu zhliadnutí majú nižšiu váhu (a je to vidieť).
- „Nevieme koľko zhliadnutí" ≠ „nula zhliadnutí" — rozlišujú sa.

## 7. Testy

`bun test tests/liveTrends.test.ts` — **29 testov** nad **reálnymi vzorkami dát**
(`tests/fixtures/google-trends-sk.xml`, `youtube-feed.xml` stiahnuté z reálnych
zdrojov; `youtube-chart.json` poskladaná podľa dokumentovanej schémy API).

Testy okrem iného strážia:
- parser nespadne pri prázdnom ani poškodenom vstupe (radšej menej signálov),
- diakritika a „el niño" prežijú,
- **skóre sa nezasekne** (toto bola reálna chyba odhalená testom),
- nulové a neznáme zhliadnutia nie sú to isté,
- zhrnutie neobsahuje marketingové slová,
- keď zdroj zlyhá, zhrnutie to prizná,
- platformy bez prístupu sú v kóde priznané s dôvodom.

## 8. Zvláštnosť, na ktorú sme narazili

YouTube kanálové RSS posiela v hlavičke `<yt:channelId>` **22-znakové id bez
predpony „UC"** (napr. `X6OQ3DkcsbYNE6H8uQQuVA`), kým v položkách má správne
`UCX6OQ…`. Kanonické id má 24 znakov a začína na „UC" — appka to normalizuje
a je na to test, aby sme na to nezabudli.
