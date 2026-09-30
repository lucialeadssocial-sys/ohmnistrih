/**
 * KROK 19 — VÝUČBA POPRI PRÁCI (jednoduchšie rozhranie).
 *
 * Jeden zdroj pravdy: pre KAŽDÝ nástroj v appke je tu krátke vysvetlenie
 *  - `what`  = čo to robí (ľudsky, bez žargónu)
 *  - `when`  = kedy sa to hodí / čo to spraví s videom
 *  - `need`  = čo musí byť hotové predtým, než to zapneš
 *  - `steps` = 2–4 konkrétne kroky, ako na to
 *
 * Pravidlá (binding, rovnaké ako zvyšok appky):
 *  - nič nesľubovať, čo appka naozaj nerobí (žiadne „AI vyrenderuje video“),
 *  - žiadne tvrdenie o „aplikované“, keď sa nič nezmení,
 *  - texty sú len výučba — nemenia správanie appky ani nerušia žiadnu funkciu.
 *
 * Test `tests/toolGuides.test.ts` kontroluje, že naozaj KAŽDÝ nástroj z App.tsx
 * má svoje vysvetlenie (kedysi pribudne nástroj bez textu, test spadne).
 */

export type ToolCategory = "media" | "strih" | "titulky" | "audio" | "vizual" | "ai" | "toolbox" | "export" | "system";

export interface ToolGuide {
  /** rovnaké id, aké používa App.tsx v `activeTab` */
  id: string;
  /** ľudský názov (čo uvidíš v appke) */
  title: string;
  category: ToolCategory;
  /** čo to robí — 1–2 vety jednoducho */
  what: string;
  /** kedy to použiť / čo to spraví s videom */
  when: string;
  /** čo musí byť hotové predtým */
  need: string[];
  /** ako na to, krok za krokom */
  steps: string[];
  /** patrí medzi pokročilé nástroje (v jednoduchom režime ho netreba) */
  expert?: boolean;
  /** starý názov ostal v kóde — dnes sa neotvára ako samostatná obrazovka */
  legacy?: boolean;
}

export const CATEGORY_LABELS: Record<ToolCategory, string> = {
  media: "Médiá a vstup",
  strih: "Strih a časová os",
  titulky: "Titulky",
  audio: "Audio a hlas",
  vizual: "Vizuál a obrázky",
  ai: "AI pomocníci",
  toolbox: "Toolbox a štýl",
  export: "Export",
  system: "História a systém",
};

export const TOOL_GUIDES: ToolGuide[] = [
  /* ── Médiá a vstup ───────────────────────────────────────────────── */
  {
    id: "media_manager",
    title: "Knižnica médií",
    category: "media",
    what: "Jedno miesto, kde vidíš všetky videá, obrázky a zvuky, ktoré máš v projekte nahraté.",
    when: "Použi ju, keď chceš pridať ďalšie médium (napr. B-roll alebo obrázok) alebo si vybrať, s ktorým videom práve pracuješ.",
    need: ["otvorený projekt (aspoň jeden projekt v appke)"],
    steps: [
      "Otvor Knižnicu médií v ľavom menu (kategória Médiá).",
      "Klikni na „Nahrať“ a vyber súbor z počítača, telefónu, cloudu alebo vlož odkaz.",
      "Kliknutím na médium ho nastavíš ako aktívne — všetky ďalšie nástroje potom pracujú s ním.",
    ],
  },
  {
    id: "raw",
    title: "Analýza surového videa (RAW)",
    category: "media",
    what: "Prejde tvoje surové video a zistí, čo v ňom je: reč, scény, ticho, kvalitu obrazu a zvuku.",
    when: "Hneď po nahratí videa — je to základ, z ktorého potom žijú strih, titulky aj AI pomocníci.",
    need: ["nahraté video"],
    steps: [
      "Nahraj video a otvor Analýzu surového videa.",
      "Spusti analýzu a počkaj, kým dobehne (appka ti povie, čo našla).",
      "Výsledok si prejdi — appka nič nemení na tvojom videu, len ho číta.",
    ],
  },

  /* ── Strih a časová os ───────────────────────────────────────────── */
  {
    id: "jump",
    title: "Smart Cut — vystrihni ticho",
    category: "strih",
    what: "Nájde v nahrávke miesta, kde sa nič nehovorí (ticho, zbytočné pauzy) a ponúkne ich vystrihnúť.",
    when: "Keď chceš kratšie a svižnejšie video bez rušivého „hmm“ a ticha — typicky na začiatku strihania.",
    need: ["nahraté video", "spustená analýza surového videa"],
    steps: [
      "Otvor Smart Cut.",
      "Spusti hľadanie a pozri si, čo appka navrhuje vystrihnúť.",
      "Skontroluj návrh a potvrď — zmena sa zapíše do časovej osi (predtým sa uloží bod, na ktorý sa vieš vrátiť).",
    ],
  },
  {
    id: "story",
    title: "Story Builder — poskladaj príbeh",
    category: "strih",
    what: "Pomôže poskladať video do príbehu, ktorý diváka udrží: silný začiatok, jadro a jasný záver.",
    when: "Keď máš vystrihané zábery, ale nevieš, v akom poradí ich dať, aby to dávalo zmysel.",
    need: ["nahraté video", "aspoň približný výber záberov"],
    steps: [
      "Otvor Story Builder.",
      "Nechaj si navrhnúť štruktúru (čo dať na začiatok, čo do stredu, čo na koniec).",
      "Návrh prijmi alebo si ho uprav — nič sa nezmení, kým to nepotvrdíš.",
    ],
  },
  {
    id: "transitions",
    title: "Prechody medzi zábermi",
    category: "strih",
    what: "Pridáva prechody (napr. plynulé prelínanie alebo rýchly strih) medzi jednotlivé zábery.",
    when: "Keď chceš, aby strih nevyzeral „skákavo“, ale plynulo a moderne.",
    need: ["vystrihané zábery na časovej osi"],
    steps: [
      "Otvor Prechody.",
      "Vyber typ prechodu a jeho dĺžku.",
      "Prejdi si náhľad — prechod uvidíš hneď, bez čakania na export.",
    ],
    expert: true,
  },
  {
    id: "eraser",
    title: "Odstránenie objektu z obrazu",
    category: "strih",
    what: "Pomôže skryť alebo vyčistiť nechcený prvok v obraze (napr. rušivý predmet či logo).",
    when: "Keď ti v zábere prekáža niečo, čo tam nepatrí, a nechceš preto celý záber vyhodiť.",
    need: ["nahraté video"],
    steps: [
      "Otvor nástroj a označ miesto v obraze, ktoré chceš vyčistiť.",
      "Prejdi si náhľad — appka ti ukáže, ako to vyzerá výsledne.",
      "Keď si spokojná, potvrď zmenu (inak sa video nemení).",
    ],
    expert: true,
  },
  {
    id: "pro_timeline",
    title: "Pro časová os",
    category: "strih",
    what: "Detailná časová os, kde vidíš klipy, vrstvy a titulky presne v čase.",
    when: "Keď potrebuješ presne zasiahnuť: posunúť klip, orezať koniec, pridať vrstvu.",
    need: ["nahraté video"],
    steps: [
      "Otvor Pro časovú os.",
      "Klikni na klip alebo titulok, ktorý chceš upraviť.",
      "Uprav čas alebo dĺžku; zmena sa hneď prejaví v náhľade.",
    ],
    expert: true,
  },
  {
    id: "cleanup",
    title: "Vyčistenie projektu",
    category: "strih",
    what: "Posbierne po projekte — nájde duplicitné alebo nepoužité veci a pomôže projekt upratať.",
    when: "Keď je projekt dlhý a chceš, aby v ňom zostalo len to, čo naozaj používaš.",
    need: ["existujúci projekt s médiami"],
    steps: [
      "Otvor Vyčistenie projektu.",
      "Spusti kontrolu a pozri si, čo appka našla.",
      "Vyber, čo chceš odstrániť, a potvrď.",
    ],
    expert: true,
  },
  {
    id: "workspace",
    title: "Pracovná plocha",
    category: "strih",
    what: "Prehľadná plocha, kde máš vedľa seba video, zoznam zmien a nástroje.",
    when: "Keď chceš mať všetko dôležité na jednej obrazovke a nerobiť medzi tým desať klikov.",
    need: ["otvorený projekt"],
    steps: [
      "Otvor Pracovnú plochu.",
      "Vľavo pracuješ so zmenami, vpravo vidíš, ako to vyzerá.",
      "Každú zmenu vieš vrátiť — v projekte sa ukladá stav pred zmenou.",
    ],
  },

  /* ── Titulky ─────────────────────────────────────────────────────── */
  {
    id: "captions",
    title: "Titulky (kinetické)",
    category: "titulky",
    what: "Spraví z reči titulky a zvýrazňuje práve hovorené slovo, aby divák nestratil pozornosť.",
    when: "Keď chceš video, ktoré funguje aj bez zvuku — titulky sú najsilnejší nástroj na udržanie diváka.",
    need: ["nahraté video so zvukom"],
    steps: [
      "Otvor Titulky a spusti prepis (appka prepojí text s konkrétnymi slovami v čase).",
      "Vyber štýl a skontroluj, či zvýrazňovanie sedí na hovorené slovo.",
      "Pridaj titulky na časovú os — až potom sa objavia vo videu aj v exporte.",
    ],
  },
  {
    id: "burned_subtitles",
    title: "Odstrániť vypálené titulky",
    category: "titulky",
    what: "Rieši prípad, keď má zdrojové video titulky už „vypálené“ v obraze a ty chceš dať svoje.",
    when: "Keď nahráš video, ktoré má vlastné titulky priamo v obrazových bodoch.",
    need: ["nahraté video s vypálenými titulkami"],
    steps: [
      "Nahraj video a otvor tento nástroj.",
      "Nechaj appku nájsť miesto, kde titulky v obraze sú.",
      "Vyber spôsob, akým ich potlačí alebo zakryje, a skontroluj výsledok v náhľade.",
    ],
    expert: true,
  },
  {
    id: "bilingual",
    title: "Druhý jazyk (dabing/titulky)",
    category: "titulky",
    what: "Dá videu druhý jazyk — buď titulky, alebo hlas, aby video fungovalo aj pre iné publikum.",
    when: "Keď má video ísť aj na iný trh alebo k divákom, ktorí nehovoria tvojím jazykom.",
    need: ["video s hotovými titulkami (prepisom)"],
    steps: [
      "Otvor Druhý jazyk a vyber cieľový jazyk.",
      "Skontroluj preklad, prípadne si ho uprav po svojom.",
      "Vyber, či to má byť text na obrazovke alebo hlas, a potvrď.",
    ],
    expert: true,
  },

  /* ── Audio a hlas ────────────────────────────────────────────────── */
  {
    id: "pro_audio",
    title: "Audio Master",
    category: "audio",
    what: "Zjednotí hlasitosť a vyčistí zvuk tak, aby video znelo profesionálne a nie potichu/hlasno raz tam, raz tam.",
    when: "Keď je zvuk nerovnomerný alebo pripomienka „na sociálnych sieťach je ticho“.",
    need: ["video so zaznamenaným zvukom"],
    steps: [
      "Otvor Audio Master.",
      "Nechaj appku vyrovnať hlasitosť na úroveň vhodnú pre sociálne siete.",
      "Prepočuj výsledok; pôvodné audio sa neprepíše, kým to potvrdíš.",
    ],
  },
  {
    id: "audio",
    title: "Čistenie hlasu",
    category: "audio",
    what: "Zlepšuje zrozumiteľnosť reči a stlmí hudbu/hluk v pozadí, aby bolo dobre rozumieť.",
    when: "Keď sa nahrávalo v hlučnom prostredí alebo je hudba príliš hlasná pod hlasom.",
    need: ["video so zvukom"],
    steps: [
      "Otvor Čistenie hlasu.",
      "Nastav, koľko chceš hluk potlačiť (môžeš začať jemne).",
      "Prepočuj pred a po — pôvodné audio ostáva zachované.",
    ],
  },
  {
    id: "ai_voice",
    title: "AI hlas (predčítanie)",
    category: "audio",
    what: "Prečíta text prirodzeným hlasom — hodí sa na komentár alebo opravu nezrozumiteľnej pasáže.",
    when: "Keď potrebuješ hlas, ktorý v nahrávke nie je (napr. komentár alebo iný jazyk).",
    need: ["text, ktorý má byť prečítaný"],
    steps: [
      "Otvor AI hlas a vlož alebo napíš text.",
      "Vyber hlas a vypočuj si ukážku.",
      "Vlož hlas do projektu — tvoje pôvodné audio sa tým nemaže.",
    ],
    expert: true,
  },
  {
    id: "canva",
    title: "Hudba na pozadí",
    category: "audio",
    what: "Ponúka hudbu, ktorú vieš dať pod video, aby bolo živšie.",
    when: "Keď má video pôsobiť energicky a hudba mu chýba.",
    need: ["video so zvukom (hudba ide pod hlas, nie namiesto neho)"],
    steps: [
      "Otvor Hudbu na pozadí.",
      "Vypočuj si ukážky a vyber tú, ktorá sedí k videu.",
      "Nastav hlasitosť tak, aby hlas zostal zrozumiteľný.",
    ],
    expert: true,
  },
  {
    id: "beat",
    title: "Strih do rytmu",
    category: "audio",
    what: "Nájde doby v hudbe a pomôže strihať presne do rytmu — výsledok pôsobí dynamicky.",
    when: "Keď chceš rytmický strih (typický pre krátke videá na sociálne siete).",
    need: ["hudba v projekte alebo video s rytmom"],
    steps: [
      "Otvor Strih do rytmu.",
      "Nechaj appku nájsť doby v hudbe.",
      "Prejdi si návrh strihu a potvrď, čo chceš použiť.",
    ],
    expert: true,
  },

  /* ── Vizuál a obrázky ────────────────────────────────────────────── */
  {
    id: "broll",
    title: "B-roll (doplnkové zábery)",
    category: "vizual",
    what: "Pridáva do videa doplnkové zábery a obrázky, aby nebola celý čas len hovoriaca hlava.",
    when: "Keď je video nudné na pohľad, hoci obsah je dobrý — ukáž, o čom hovoríš.",
    need: ["nahraté video", "dostupné médiá v projekte (vlastné alebo pridané)"],
    steps: [
      "Otvor B-roll a pozri si, čo appka ku tvojim slovám navrhuje.",
      "Vyber zábery, ktoré chceš pridať, a miesto v čase.",
      "Potvrď — zábery sa pridajú do časovej osi a uvidíš ich v náhľade.",
    ],
  },
  {
    id: "finder",
    title: "Hľadanie B-rollu",
    category: "vizual",
    what: "Pomôže nájsť vhodný doplnkový záber k tomu, o čom práve hovoríš.",
    when: "Keď vieš, že chceš niečo ukázať, ale nevieš presne čo.",
    need: ["transkript videa alebo text, ktorý hovoríš"],
    steps: [
      "Otvor Hľadanie B-rollu.",
      "Vyber si pasáž, ku ktorej hľadáš záber.",
      "Prejdi si návrhy a vybrané pridaj do projektu.",
    ],
    expert: true,
  },
  {
    id: "attention",
    title: "Vizuálna pozornosť",
    category: "vizual",
    what: "Odhaduje, kde v videu divák stráca pozornosť a čo mu ju pomáha udržať.",
    when: "Keď video funguje, ale ľudia odchádzajú skôr, než dobehne.",
    need: ["nahraté video (a ideálne titulky)"],
    steps: [
      "Otvor Vizuálnu pozornosť.",
      "Pozri si, ktoré časti sú označené ako slabšie.",
      "Vráť sa k nim a zosilni obraz alebo strih.",
    ],
    expert: true,
  },
  {
    id: "thumbnail",
    title: "Miniatúra videa",
    category: "vizual",
    what: "Pomôže vyrobiť miniatúru (obrázok, ktorý ľudia vidia pred prehraním videa).",
    when: "Keď chceš, aby si video ľudia vôbec otvorili — miniatúra často rozhoduje.",
    need: ["video s obrazom (najlepšie už vystrihané)"],
    steps: [
      "Otvor Miniatúru a vyber záber, ktorý má potenciál.",
      "Uprav text a výrez tak, aby bolo jasné, o čom video je.",
      "Ulož miniatúru — ide bokom, video samotné nemení.",
    ],
    expert: true,
  },

  /* ── AI pomocníci ────────────────────────────────────────────────── */
  {
    id: "pro_autopilot",
    title: "Autopilot (spraví to za teba)",
    category: "ai",
    what: "Spojí viac krokov naraz: prejde video, navrhne strih a pripraví podklady na titulky a export.",
    when: "Keď máš málo času a chceš, aby ti appka pripravila návrh, ktorý len skontroluješ.",
    need: ["nahraté video s rečou"],
    steps: [
      "Nahraj video a otvor Autopilota.",
      "Spusti ho a počkaj na návrh (appka ti ukáže, čo našla a čo navrhuje).",
      "Prejdi si návrh a rozhodni, čo použiť — nič sa nemení bez tvojho potvrdenia.",
    ],
  },
  {
    id: "pipeline",
    title: "Sprievodca krok za krokom",
    category: "ai",
    what: "Prevedie ťa celým procesom od začiatku do konca: nahratie, titulky, štýl, export.",
    when: "Keď s appkou začínaš alebo chceš istotu, že si nič dôležité nevynechala.",
    need: ["nahraté video"],
    steps: [
      "Otvor Sprievodcu.",
      "Choď krok po kroku — vždy uvidíš, čo sa práve deje a čo máš spraviť.",
      "Na konci ti ostane hotové video pripravené na export.",
    ],
  },
  {
    id: "edl_autopilot",
    title: "Rozhodnutia strihu (Decision Studio)",
    category: "ai",
    what: "Ukáže každé rozhodnutie strihu aj s dôvodom, prečo ho appka navrhla a prečo ho nevybrala inak.",
    when: "Keď chceš mať kontrolu nad tým, čo AI navrhuje — a nie len tlačidlo „hotovo“.",
    need: ["nahraté video", "aspoň jedna analýza alebo návrh strihu"],
    steps: [
      "Otvor Rozhodnutia strihu.",
      "Prejdi si návrhy: pri každom vidíš, čo sa stane a prečo.",
      "Pri návrhu klikni na Prijať alebo Odmietnuť — čo odmietneš, to sa v time losi nič nestane.",
    ],
    expert: true,
  },
  {
    id: "editor_brain",
    title: "Štýl strihu (Editor Brain)",
    category: "ai",
    what: "Učí sa, aký štýl strihu ti sedí, a potom ho používa pri svojich návrhoch.",
    when: "Keď už máš pár videí za sebou a chceš, aby appka robila veci po tvojom.",
    need: ["aspoň jeden hotový alebo upravený projekt"],
    steps: [
      "Otvor Štýl strihu.",
      "Pozri si, čo si appka o tvojom štýle všimla.",
      "Uprav, čo nesedí, a ulož.",
    ],
    expert: true,
  },
  {
    id: "ai_visual_director",
    title: "Kreatívny riaditeľ",
    category: "ai",
    what: "Navrhne vizuálnu podobu videa (štýl, tempo, náladu) podľa toho, čo má video vyjadriť.",
    when: "Keď chceš zmenu vzhľadu celého videa, nielen jedného detailu.",
    need: ["nahraté video"],
    steps: [
      "Otvor Kreatívneho riaditeľa.",
      "Vyber, aký dojem má video vyvolať.",
      "Prejdi si návrh a použi ho (alebo zavrhni) — sám nič nemení.",
    ],
    expert: true,
  },
  {
    id: "retention",
    title: "Udržanie diváka",
    category: "ai",
    what: "Odhaduje, v ktorých sekundách ľudia prestanú pozerať a prečo.",
    when: "Keď chceš znížiť to, že ľudia video zavrú v polovici.",
    need: ["nahraté video", "ideálne hotový strih"],
    steps: [
      "Otvor Udržanie diváka.",
      "Pozri si rizikové sekundy.",
      "Vráť sa k nim a skráť alebo spestrej záber.",
    ],
    expert: true,
  },
  {
    id: "opus",
    title: "Krátke videá (Shorts)",
    category: "ai",
    what: "Vyrába z dlhšieho videa krátke samostatné videá pre sociálne siete.",
    when: "Keď z jedného videa chceš viac príspevkov, napr. 3 krátke videá z jedného rozhovoru.",
    need: ["dlhšie video s rečou", "transkript alebo analýza videa"],
    steps: [
      "Otvor Krátke videá.",
      "Nechaj appku navrhnúť, ktoré časti stoja za samostatné video.",
      "Vyber, ktorý návrh použiť, a doexportuj ten.",
    ],
    expert: true,
  },
  {
    id: "content_graph",
    title: "Mapa obsahu",
    category: "ai",
    what: "Ukáže, ktoré témy a myšlienky sa vo videu prelínajú — dobré pri plánovaní ďalších videí.",
    when: "Keď plánuješ sériu a chceš vidieť, čo už máš pokryté.",
    need: ["video s rečou alebo transkript"],
    steps: [
      "Otvor Mapu obsahu.",
      "Pozri si témy, ktoré z videa appka vytiahla.",
      "Použi to ako podklad pre ďalšie video, nič sa v projekte nemení.",
    ],
    expert: true,
  },
  {
    id: "ai_orchestrator",
    title: "Do hľad nad AI",
    category: "ai",
    what: "Ukazuje, čo appka práve robí (ktorý AI krok beží), či je pripravená a či máš nastavený AI kľúč.",
    when: "Keď niečo dlho trvá alebo chceš vedieť, s čím appka práve pracuje.",
    need: ["appka s nastaveným AI kľúčom (ak chceš AI kroky)"],
    steps: [
      "Otvor Do hľad nad AI.",
      "Skontroluj si stav (pripravená / čaká / chýba kľúč).",
      "Ak niečo chýba, appka ti napíše, čo doplniť.",
    ],
    expert: true,
  },
  {
    id: "director_briefing",
    title: "Zadanie pre strih (briefing)",
    category: "ai",
    what: "Zapíšeš, čo má video spraviť (pre koho je, čo má povedať, aký tón), a appka podľa toho pracuje.",
    when: "Na úplnom začiatku — čím jasnejšie zadanie, tým lepší výsledok.",
    need: ["nápad alebo video, ktoré chceš spracovať"],
    steps: [
      "Otvor Zadanie pre strih.",
      "Napíš, pre koho video je a čo má dosiahnuť.",
      "Ulož a pokračuj ďalšími krokmi — zadanie sa použije pri návrhoch.",
    ],
    expert: true,
  },

  /* ── Toolbox a štýl ──────────────────────────────────────────────── */
  {
    id: "style_studio",
    title: "Style Studio (štýl a vzhľad)",
    category: "toolbox",
    what: "Zmeria štýl z referencie (napr. z videa, ktoré sa ti páči) a povie, ako presne vyzerá: titulky, tempo, farby, priblíženie.",
    when: "Keď chceš, aby tvoje video vyzeralo ako video, ktoré sa ti páči — bez kopírovania jeden po druhom.",
    need: ["referencia (obrázok/video) alebo vlastný výber štýlu", "nahraté video, na ktoré sa má štýl použiť"],
    steps: [
      "Otvor Style Studio.",
      "Vyber štýl alebo nahraj referenciu; appka ti ukáže, čo z nej odmerala.",
      "Skontroluj náhľad a potvrď — až potom sa zmení tvoja časová os.",
    ],
  },
  {
    id: "pro_toolbox",
    title: "Toolbox (veľa nástrojov v jednom)",
    category: "toolbox",
    what: "Zbierka drobných strihových nástrojov na jednom mieste (napr. priblíženie, efekty, drobné úpravy).",
    when: "Keď potrebuješ rýchlu úpravu, ale nechceš hľadať, v ktorej kategórii je.",
    need: ["nahraté video"],
    steps: [
      "Otvor Toolbox.",
      "Vyber nástroj, ktorý potrebuješ.",
      "Uprav nastavenia a skontroluj náhľad.",
    ],
    expert: true,
  },
  {
    id: "zoomsfx",
    title: "Priblíženie a efekty (starý názov)",
    category: "toolbox",
    what: "Historický názov pre nástroje priblíženia a efektov. Dnes sa tieto nájdu v Toolboxe a v Style Studiu.",
    when: "Nepoužívaj — ak hľadá a priblíženie, otvor Toolbox alebo Style Studio.",
    need: [],
    steps: [
      "Otvor Toolbox alebo Style Studio.",
      "Tam nájdeš priblíženie aj efekty s náhľadom.",
    ],
    legacy: true,
  },
  {
    id: "toggles",
    title: "Prepnú a de (starý názov)",
    category: "toolbox",
    what: "Historický názov pre rýchle prepnú a. Dnes sú tieto voľby súčasťou Toolboxu.",
    when: "Nepoužívaj — otvor Toolbox.",
    need: [],
    steps: ["Otvor Toolbox a nájdi príslušný nástroj."],
    legacy: true,
  },
  {
    id: "omnistrih",
    title: "OmniStrih (starý názov)",
    category: "toolbox",
    what: "Starý názov projektu, ktorý sa používal v začiatkoch appky. Dnes ho nahradili konkrétne nástroje.",
    when: "Nepoužívaj — vyber si konkrétny nástroj podľa toho, čo chceš spraviť.",
    need: [],
    steps: ["Použi ľavé menu alebo tohto Sprievodcu a vyber konkrétny nástroj."],
    legacy: true,
  },

  /* ── Export ──────────────────────────────────────────────────────── */
  {
    id: "export",
    title: "Export videa",
    category: "export",
    what: "Vypáli hotové video zo všetkým, čo si nastavila (titulky, strih, zvuk), do hotového súboru.",
    when: "Na konci, keď je video podľa teba hotové.",
    need: ["video so všetkými úpravami, ktoré chceš mať vo výsledku"],
    steps: [
      "Otvor Export a vyber formát pre platformu (napr. zvislé video pre telefón).",
      "Spusti export a počkaj — appka ti ukáže, kedy je hotový.",
      "Hotový súbor stiahni alebo nájdeš tam, kam appka ukladá výstupy.",
    ],
  },
  {
    id: "pack",
    title: "Balík výstupov",
    category: "export",
    what: "Vytvorí naraz viac verzií pre rôzne platformy alebo formáty.",
    when: "Keď chceš jeden projekt použiť na viacerých miestach (napr. zvislé aj štvorcové).",
    need: ["hotový strih"],
    steps: [
      "Otvor Balík výstupov.",
      "Zaškrtni formáty, ktoré chceš.",
      "Spusti a počkaj na hotové súbory.",
    ],
    expert: true,
  },
  {
    id: "ab",
    title: "Dve verzie na porovnanie (A/B)",
    category: "export",
    what: "Vyrobí dve verzie toho istého videa (napr. s rôznym tempom), aby si zistila, ktorá funguje lepšie.",
    when: "Keď nevieš, ktorá verzia je lepšia, a chceš to otestovať na ľuďoch.",
    need: ["hotový strih"],
    steps: [
      "Otvor Dve verzie.",
      "Nechaj vyrobiť druhú verziu.",
      "Porovnaj ich a použi tú, ktorá funguje lepšie.",
    ],
    expert: true,
  },

  /* ── História a systém ───────────────────────────────────────────── */
  {
    id: "os_hub",
    title: "História a návrat vzad (Time Machine)",
    category: "system",
    what: "Ukladá si verzie projektu, takže sa vieš vrátiť presne do stavu pred akoukoľvek väčšou zmenou.",
    when: "Keď sa ti niečo nezdá alebo si niečo rozbila — tu to vrátiš späť.",
    need: ["projekt, v ktorom už prebehla aspoň jedna zmena"],
    steps: [
      "Otvor Históriu.",
      "Nájdi bod, do ktorého sa chceš vrátiť (vidíš, čo sa vtedy zmenilo).",
      "Klikni na návrat — projekt sa obnoví presne do toho stavu.",
    ],
  },
  {
    id: "qc_analytics",
    title: "Kontrola a úspora času",
    category: "system",
    what: "Skontroluje, či je video v poriadku (rozmery, zvuk, titulky) a ukáže, koľko času ti appka ušetrila.",
    when: "Pred exportom, aby si nezistila problém až po nahratí na sociálnu sieť.",
    need: ["hotový strih"],
    steps: [
      "Otvor Kontrolu.",
      "Prejdi si body, ktoré appka skontrolovala.",
      "Ak niečo nesedí, appka ti napíše, kde to opraviť.",
    ],
    expert: true,
  },
  {
    id: "system_test",
    title: "Diagnostika appky",
    category: "system",
    what: "Overí, či appka funguje správne (či je pripravená, či jej niečo nechýba).",
    when: "Keď sa niečo správa divne a chceš vedieť, kde je problém.",
    need: [],
    steps: [
      "Otvor Diagnostiku.",
      "Spusti kontrolu.",
      "Ak niečo chýba, appka napíše, čo doplniť.",
    ],
    expert: true,
  },
];

/** rýchle hľadanie podľa id (rovnaké id, aké má `activeTab` v App.tsx) */
export const GUIDE_BY_ID: Record<string, ToolGuide> = Object.fromEntries(
  TOOL_GUIDES.map((g) => [g.id, g]),
);

export function guideFor(id: string): ToolGuide | undefined {
  return GUIDE_BY_ID[id];
}

/** Nástroje, ktoré stačia na bežné video (jednoduchý režim). Ostatné ostávajú dostupné — nič sa neruší. */
export const SIMPLE_MODE_TABS: string[] = [
  "media_manager",
  "raw",
  "jump",
  "captions",
  "style_studio",
  "pro_audio",
  "broll",
  "workspace",
  "export",
];

/**
 * Jednoduchý postup pre úplný začiatok: 5 krokov.
 * Každý krok ukazuje na nástroj, ktorý naozaj existuje (`tabId` = id nástroja).
 */
export interface FlowStep {
  n: number;
  title: string;
  what: string;
  need: string;
  tabId: string;
}

export const FLOW_STEPS: FlowStep[] = [
  {
    n: 1,
    title: "Nahraj video",
    what: "Vlož video zo súboru, telefónu, cloudu alebo z odkazu. Appka ho načíta a pripraví.",
    need: "video, ktoré chceš spracovať",
    tabId: "media_manager",
  },
  {
    n: 2,
    title: "Nechaj ho prečítať (analýza + titulky)",
    what: "Appka zistí, čo je vo videu (reč, scény) a spraví prepis s časovaním slov — z toho potom žijú titulky.",
    need: "nahraté video",
    tabId: "raw",
  },
  {
    n: 3,
    title: "Daj mu štýl",
    what: "Vyber štýl titulkov a vzhľadu, alebo nahraj referenciu. Appka ti najprv ukáže náhľad.",
    need: "prepis (krok 2)",
    tabId: "style_studio",
  },
  {
    n: 4,
    title: "Skontroluj a uprav",
    what: "Pozri si výsledok v náhľade. Ak sa ti niečo nezdá, uprav to alebo sa vráť do stavu pred zmenou.",
    need: "hotový návrh z krokov 2–3",
    tabId: "workspace",
  },
  {
    n: 5,
    title: "Exportuj hotové video",
    what: "Appka vypáli výsledok do súboru presne tak, ako ho vidíš v náhľade.",
    need: "video, s ktorým si spokojná",
    tabId: "export",
  },
];

/** Jednoduchý režim je informatívny — tieto texty sa zobrazujú nad nástrojmi. */
export const SIMPLE_MODE_HINT =
  "Jednoduchý režim ti ukazuje kroky a vysvetlenia. Expert režim otvorí všetky nástroje — nič sa tým nemaže, len sa to zobrazí.";
