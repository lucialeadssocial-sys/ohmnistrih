/**
 * KROK 20 — VÝUČBA PRIAMO VO FUNKCIÁCH, ZA BEHU (živý sprievodca).
 *
 * Rozdiel proti kroku 19: krok 19 vysvetľuje, ČO nástroj robí.
 * Tento modul hovorí, ČO MÁŠ SPRAVIŤ TERAZ — a odškrtáva kroky podľa toho,
 * čo sa v appke naozaj stalo.
 *
 * Zásadné pravidlo (binding): sprievodca NIKDY netvrdí, že je krok hotový,
 * keď sa nič nestalo. Preto:
 *   - `signal` = reálna udalosť, ktorú appka zapisuje v okamihu, keď sa stane
 *     (nahranie videa, dokončená analýza, použitý strih, export),
 *   - `derived` = stav, ktorý sa dá prečítať z canonical časovej osi
 *     (napr. počet titulkov na osi) — tiež reálny, nie vymyslený,
 *   - `manual` = krok, ktorý appka overiť NEVIE → prizná to priamo v texte
 *     a nikdy ho neodškrtne sama.
 */

export type LiveSignal =
  | "video_uploaded"
  | "analysis_done"
  | "cuts_applied"
  | "captions_on_timeline"
  | "captions_with_words"
  | "style_applied"
  | "rollback_used"
  | "export_finished";

/** Reálne vstupy: čo appka naozaj vie (nie odhad). */
export interface LiveInputs {
  /** udalosti, ktoré appka zapísala vo chvíli, keď sa stali */
  log: LiveSignal[];
  /** počet titulkov/textov na canonical časovej osi (živý stav) */
  canonicalCaptions: number;
  /** z toho koľko má časovanie po slovách (živý stav) */
  canonicalCaptionsWithWords: number;
}

export function computeSignals(inputs: LiveInputs): Record<LiveSignal, boolean> {
  const fromLog = (s: LiveSignal) => inputs.log.includes(s);
  return {
    video_uploaded: fromLog("video_uploaded"),
    analysis_done: fromLog("analysis_done"),
    cuts_applied: fromLog("cuts_applied"),
    // canonical os je pravda: titulky sú na osi ⇒ naozaj sú vo videu
    captions_on_timeline: fromLog("captions_on_timeline") || inputs.canonicalCaptions > 0,
    captions_with_words: fromLog("captions_with_words") || inputs.canonicalCaptionsWithWords > 0,
    style_applied: fromLog("style_applied"),
    rollback_used: fromLog("rollback_used"),
    export_finished: fromLog("export_finished"),
  };
}

export interface LiveStep {
  /** čo máš spraviť — krátko a konkrétne */
  label: string;
  /** kde to nájdeš (aby si to nemusela hľadať) */
  where?: string;
  /** reálna udalosť, ktorá krok odškrtne */
  signal?: LiveSignal;
  /** appka to nevie overiť → prizná to a neodškrtne sama */
  manual?: boolean;
}

/**
 * Živé kroky pre každý nástroj. Poradie = ako ich máš robiť.
 * Nástroje, ktoré appka nevie overiť (napr. čistenie zvuku bez spätnej väzby),
 * majú kroky označené `manual: true` — sprievodca ich nikdy neodškrtne.
 */
export const TOOL_LIVE_STEPS: Record<string, LiveStep[]> = {
  media_manager: [
    { label: "Nahraj alebo vyber video", where: "Knižnica médií → tlačidlo na nahratie / výber média", signal: "video_uploaded" },
    { label: "Nechaj video prečítať (analýza + prepis)", where: "ľavé menu → Médiá → Analýza surového videa", signal: "analysis_done" },
  ],
  raw: [
    { label: "Spusti analýzu surového videa", where: "panel tohto nástroja vľavo — tlačidlo na spustenie", signal: "analysis_done" },
    { label: "Prejdi si, čo appka našla", where: "výsledky v tomto paneli", manual: true },
  ],
  jump: [
    { label: "Nechaj appku nájsť ticho a zbytočné pauzy", where: "panel Smart Cut vľavo", manual: true },
    { label: "Potvrď strih (aplikuj do časovej osi)", where: "tlačidlo použiť/aplikovať v paneli", signal: "cuts_applied" },
  ],
  captions: [
    { label: "Spusti prepis reči (titulky s časovaním slov)", where: "panel Titulky vľavo", signal: "captions_with_words" },
    { label: "Vyber štýl titulkov a skontroluj zvýraznenie", where: "výber štýlu v paneli + náhľad videa", manual: true },
    { label: "Pridaj titulky na časovú os", where: "tlačidlo pridať titulky do projektu", signal: "captions_on_timeline" },
  ],
  style_studio: [
    { label: "Vyber štýl alebo nahraj referenciu", where: "horná časť Style Studia", manual: true },
    { label: "Skontroluj, čo appka z referencie odmerala", where: "prehľad nameraných hodnôt v paneli", manual: true },
    { label: "Použi štýl na svoju časovú os (Apply)", where: "tlačidlo použiť — vytvorí sa bod na vrátenie", signal: "style_applied" },
  ],
  pro_audio: [
    { label: "Spusti vyrovnanie hlasitosti", where: "panel Audio Master vľavo", manual: true },
    { label: "Prepočuj výsledok (pôvodné audio sa neprepíše)", where: "prehrávač vpravo", manual: true },
  ],
  workspace: [
    { label: "Pozri si výsledok v náhľade", where: "prehrávač vpravo", manual: true },
    { label: "Ak niečo nesedí, vráť sa na stav pred zmenou", where: "ľavé menu → História", signal: "rollback_used" },
  ],
  export: [
    { label: "Vyber formát pre platformu", where: "panel Export vľavo", manual: true },
    { label: "Spusti export a počkaj na koniec", where: "tlačidlo spustiť export", signal: "export_finished" },
  ],
  broll: [
    { label: "Vyber záber, ktorý chceš pridať", where: "panel B-roll vľavo", manual: true },
    { label: "Pridaj ho na časovú os", where: "tlačidlo pridať v paneli", manual: true },
  ],
  story: [
    { label: "Nechaj appku navrhnúť štruktúru príbehu", where: "panel Story Builder vľavo", manual: true },
    { label: "Skontroluj poradie záberov", where: "zoznam návrhu v paneli", manual: true },
  ],
  transitions: [
    { label: "Vyber typ prechodu a dĺžku", where: "panel Prechody vľavo", manual: true },
    { label: "Pozri si prechod v náhľade", where: "prehrávač vpravo", manual: true },
  ],
  eraser: [
    { label: "Označ v obraze, čo chceš vyčistiť", where: "panel nástroja vľavo", manual: true },
    { label: "Skontroluj výsledok v náhľade", where: "prehrávač vpravo", manual: true },
  ],
  pro_timeline: [
    { label: "Klikni na klip alebo titulok, ktorý chceš upraviť", where: "časová os", manual: true },
    { label: "Uprav čas alebo dĺžku", where: "ovládače na časovej osi", manual: true },
  ],
  cleanup: [
    { label: "Spusti kontrolu projektu", where: "panel Vyčistenie vľavo", manual: true },
    { label: "Vyber, čo odstrániť, a potvrď", where: "zoznam nálezov v paneli", manual: true },
  ],
  burned_subtitles: [
    { label: "Nájdi vypálené titulky v obraze", where: "panel nástroja vľavo", manual: true },
    { label: "Vyber spôsob potlačenia a skontroluj náhľad", where: "nastavenia v paneli", manual: true },
  ],
  bilingual: [
    { label: "Vyber cieľový jazyk", where: "panel Druhý jazyk vľavo", manual: true },
    { label: "Skontroluj preklad a vyber text alebo hlas", where: "výsledok v paneli", manual: true },
  ],
  audio: [
    { label: "Nastav potlačenie hluku", where: "panel Čistenie hlasu vľavo", manual: true },
    { label: "Prepočuj pred a po", where: "prehrávač vpravo", manual: true },
  ],
  ai_voice: [
    { label: "Vlož text, ktorý má byť prečítaný", where: "textové pole v paneli", manual: true },
    { label: "Vyber hlas a vlož ho do projektu", where: "tlačidlo vložiť v paneli", manual: true },
  ],
  canva: [
    { label: "Vyber hudbu na pozadí", where: "zoznam skladieb v paneli", manual: true },
    { label: "Nastav hlasitosť tak, aby bol hlas zrozumiteľný", where: "posuvník hlasitosti", manual: true },
  ],
  beat: [
    { label: "Nechaj appku nájsť doby v hudbe", where: "panel Strih do rytmu vľavo", manual: true },
    { label: "Potvrď strih do rytmu", where: "tlačidlo použiť v paneli", manual: true },
  ],
  finder: [
    { label: "Vyber pasáž, ku ktorej hľadáš záber", where: "zoznam v paneli", manual: true },
    { label: "Pridaj vybraný záber do projektu", where: "tlačidlo pridať v paneli", manual: true },
  ],
  attention: [
    { label: "Pozri si rizikové časti videa", where: "výsledok v paneli", manual: true },
  ],
  thumbnail: [
    { label: "Vyber záber pre miniatúru", where: "panel Miniatúra vľavo", manual: true },
    { label: "Uprav text a ulož miniatúru", where: "tlačidlo uložiť v paneli", manual: true },
  ],
  pro_autopilot: [
    { label: "Nahraj video (ak ešte nie je)", where: "ľavé menu → Médiá", signal: "video_uploaded" },
    { label: "Spusti autopilota a počkaj na návrh", where: "panel Autopilot vľavo", manual: true },
    { label: "Prejdi si návrh a rozhodni, čo použiť", where: "zoznam návrhov v paneli", manual: true },
  ],
  pipeline: [
    { label: "Nahraj video, ak ešte nie je", where: "ľavé menu → Médiá", signal: "video_uploaded" },
    { label: "Choď krok po kroku podľa sprievodcu", where: "panel Sprievodca vľavo", manual: true },
  ],
  edl_autopilot: [
    { label: "Prejdi si návrhy strihu", where: "zoznam rozhodnutí v paneli", manual: true },
    { label: "Pri návrhu klikni Prijať alebo Odmietnuť", where: "tlačidlá pri každom návrhu", manual: true },
  ],
  editor_brain: [
    { label: "Pozri si, čo si appka o tvojom štýle všimla", where: "panel Štýl strihu vľavo", manual: true },
    { label: "Uprav a ulož", where: "tlačidlo uložiť v paneli", manual: true },
  ],
  ai_visual_director: [
    { label: "Vyber, aký dojem má video vyvolať", where: "voľby v paneli", manual: true },
    { label: "Použi návrh alebo ho zavrhni", where: "tlačidlo použiť v paneli", manual: true },
  ],
  retention: [
    { label: "Pozri si rizikové sekundy", where: "graf v paneli", manual: true },
    { label: "Vráť sa k nim a skráť alebo spestrej záber", where: "strih na časovej osi", manual: true },
  ],
  opus: [
    { label: "Nechaj appku navrhnúť krátke videá", where: "panel Krátke videá vľavo", manual: true },
    { label: "Vyber návrh a doexportuj ho", where: "tlačidlo export v paneli", signal: "export_finished" },
  ],
  content_graph: [
    { label: "Pozri si témy, ktoré appka z videa vytiahla", where: "mapa v paneli", manual: true },
  ],
  ai_orchestrator: [
    { label: "Skontroluj stav (či je AI pripravená)", where: "indikátor v hornej lište / v paneli", manual: true },
  ],
  director_briefing: [
    { label: "Napíš, pre koho video je a čo má dosiahnuť", where: "polia v paneli", manual: true },
    { label: "Ulož zadanie a pokračuj ďalšími krokmi", where: "tlačidlo uložiť v paneli", manual: true },
  ],
  pro_toolbox: [
    { label: "Vyber nástroj, ktorý potrebuješ", where: "zoznam nástrojov v paneli", manual: true },
    { label: "Uprav nastavenia a skontroluj náhľad", where: "prehrávač vpravo", manual: true },
  ],
  qc_analytics: [
    { label: "Prejdi si, čo appka skontrolovala", where: "zoznam v paneli", manual: true },
  ],
  system_test: [
    { label: "Spusti kontrolu appky", where: "tlačidlo v paneli", manual: true },
    { label: "Ak niečo chýba, doplň to podľa pokynu", where: "text pri náleze", manual: true },
  ],
  os_hub: [
    { label: "Nájdi bod, do ktorého sa chceš vrátiť", where: "zoznam verzií v paneli", manual: true },
    { label: "Vráť projekt do toho stavu", where: "tlačidlo vrátiť", signal: "rollback_used" },
  ],
  pack: [
    { label: "Zaškrtni formáty, ktoré chceš", where: "zoznam v paneli", manual: true },
    { label: "Spusti a počkaj na hotové súbory", where: "tlačidlo spustiť", signal: "export_finished" },
  ],
  ab: [
    { label: "Nechaj vyrobiť druhú verziu", where: "tlačidlo v paneli", manual: true },
    { label: "Porovnaj verzie a použi lepšiu", where: "prehrávač + panel", manual: true },
  ],
};

/** živé kroky pre nástroj (prázdne pole = appka preň nemá čo odškrtávať) */
export function liveStepsFor(tabId: string): LiveStep[] {
  return TOOL_LIVE_STEPS[tabId] ?? [];
}

export type LiveStepStatus = "done" | "current" | "waiting" | "manual";

export interface LiveStepState extends LiveStep {
  /** done = hotové (appka to vidí) · manual = appka to nevie overiť · waiting = ešte na rade nebude */
  status: LiveStepStatus;
  /** true = toto je krok, ktorý máš spraviť TERAZ (prvý nehotový) */
  isNext: boolean;
}

/**
 * Vyhodnotí stav krokov.
 *  - `done`  = appka to naozaj vidí (signál je splnený),
 *  - `manual`= prvý nehotový krok, ktorý appka overiť nevie (prizná to),
 *  - `waiting`= ešte naň neprišlo.
 * `isNext` = presne jeden krok, ktorý má človek spraviť teraz.
 */
export function evaluateLiveSteps(
  steps: LiveStep[],
  signals: Record<LiveSignal, boolean>,
): LiveStepState[] {
  let nextTaken = false;
  return steps.map((step) => {
    const done = step.signal ? signals[step.signal] : false;
    if (done) return { ...step, status: "done" as LiveStepStatus, isNext: false };
    if (!nextTaken) {
      nextTaken = true;
      const isManual = Boolean(step.manual) && !step.signal;
      return { ...step, status: (isManual ? "manual" : "current") as LiveStepStatus, isNext: true };
    }
    return { ...step, status: "waiting" as LiveStepStatus, isNext: false };
  });
}

/** Koľko krokov appka vie overiť (aby sme neklamali „hotovo“ o ručných krokoch). */
export function verifiableCounts(states: LiveStepState[]) {
  const verifiable = states.filter((s) => Boolean(s.signal));
  return {
    verifiableTotal: verifiable.length,
    verifiableDone: verifiable.filter((s) => s.status === "done").length,
    manualTotal: states.filter((s) => !s.signal).length,
  };
}

/** Postup pre začiatočníka — každý krok má reálnu udalosť, ktorá ho odškrtne. */
export const FLOW_SIGNALS: Record<string, LiveSignal | undefined> = {
  media_manager: "video_uploaded",
  raw: "analysis_done",
  style_studio: "style_applied",
  workspace: "cuts_applied",
  export: "export_finished",
};

/** Koľko z 5 krokov je naozaj hotových (podľa reálnych udalostí). */
export function flowDoneCount(signals: Record<LiveSignal, boolean>): number {
  return Object.values(FLOW_SIGNALS).filter((s) => (s ? signals[s] : false)).length;
}

/** Ďalší krok, ktorý má zmysel urobiť po tomto nástroji (z 5-krokového postupu). */
export function nextFlowTool(currentTab: string): string | null {
  const order = Object.keys(FLOW_SIGNALS);
  const i = order.indexOf(currentTab);
  if (i === -1) return null;
  return order[i + 1] ?? null;
}


/**
 * Staré názvy (v kóde ešte existujú, ale dnes sa neotvárajú ako samostatné
 * obrazovky). Sprievodca namiesto krokov pošle človeka na dnešný nástroj —
 * nič nepredstiera a nič sa neruší.
 */
export const LEGACY_TARGET: Record<string, string> = {
  toggles: "pro_toolbox",
  zoomsfx: "pro_toolbox",
  omnistrih: "style_studio",
};

export function legacyTargetFor(tabId: string): string | null {
  return LEGACY_TARGET[tabId] ?? null;
}

/**
 * Aký nástroj má zmysel otvoriť po tomto. Je to NÁVRH (nie automatika):
 * appka len ponúkne tlačidlo, nič sama neprepne.
 */
export const SUGGESTED_NEXT: Record<string, string> = {
  media_manager: "raw",
  raw: "jump",
  jump: "captions",
  captions: "style_studio",
  style_studio: "workspace",
  workspace: "pro_audio",
  pro_audio: "export",
  broll: "export",
  opus: "export",
};

export function suggestedNextTool(tabId: string): string | null {
  return SUGGESTED_NEXT[tabId] ?? nextFlowTool(tabId) ?? null;
}
