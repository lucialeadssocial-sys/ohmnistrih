import React, { useState } from "react";
import { 
  Brain, 
  ShieldAlert, 
  Clock, 
  Lock, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  RefreshCcw, 
  Layers, 
  Sliders, 
  Eye, 
  Play, 
  Check, 
  HelpCircle,
  Database,
  Cpu,
  Zap,
  Activity
} from "lucide-react";
import { 
  EditDNAModel, 
  EditingMemoryRule, 
  ReviewDecisionItem, 
  LockZone, 
  TimeMachineVersion, 
  ContentUniverseItem 
} from "../types";
import { motion, AnimatePresence } from "motion/react";

interface OmniStrihOSHubProps {
  editDNA: EditDNAModel;
  onUpdateDNA: (dna: EditDNAModel) => void;
  memoryRules: EditingMemoryRule[];
  onToggleRule: (id: string) => void;
  reviewItems: ReviewDecisionItem[];
  onReviewItem: (id: string, status: "ACCEPTED" | "REJECTED") => void;
  lockZones: LockZone[];
  onToggleLock: (id: string) => void;
  timeMachine: TimeMachineVersion[];
  onRestoreVersion: (id: string) => void;
  contentUniverse: ContentUniverseItem[];
  language: "sk" | "en";
  showToast: (msg: string) => void;
}

export const OmniStrihOSHub: React.FC<OmniStrihOSHubProps> = ({
  editDNA,
  onUpdateDNA,
  memoryRules,
  onToggleRule,
  reviewItems,
  onReviewItem,
  lockZones,
  onToggleLock,
  timeMachine,
  onRestoreVersion,
  contentUniverse,
  language,
  showToast
}) => {
  const isSk = language === "sk";
  const [activeTab, setActiveTab] = useState<"brain" | "review" | "dna" | "locks" | "universe" | "timemachine">("review");

  const pendingSafe = reviewItems.filter(i => i.riskLevel === "SAFE" && i.status === "PENDING").length;
  const pendingModerate = reviewItems.filter(i => i.riskLevel === "MODERATE" && i.status === "PENDING").length;
  const pendingCritical = reviewItems.filter(i => i.riskLevel === "CRITICAL" && i.status === "PENDING").length;

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full pb-16">
      {/* OS Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-6 rounded-3xl bg-neutral-900 border border-neutral-800 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex items-center gap-4 relative z-10">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white shadow-xl shadow-indigo-600/30">
            <Brain className="h-7 w-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-400 font-black text-[9px] uppercase tracking-widest border border-indigo-500/30">AI Operating System</span>
              <span className="text-[9px] font-bold text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                Shadow Editor Active
              </span>
            </div>
            <h2 className="text-xl font-black text-white uppercase tracking-tight mt-1">OMNISTRIH EDITOR BRAIN & OS</h2>
            <p className="text-xs text-neutral-400">
              {isSk ? "Systém sa učí z vašich rozhodnutí, riadi Edit DNA a chráni kľúčové zóny." : "System learns from your edits, manages Edit DNA & protects key zones."}
            </p>
          </div>
        </div>

        {/* Quick Stats Header */}
        <div className="flex items-center gap-3 relative z-10">
          <div className="px-4 py-2.5 rounded-2xl bg-neutral-950 border border-neutral-800 text-center">
            <p className="text-[9px] font-black text-neutral-500 uppercase">Memory Rules</p>
            <p className="text-sm font-black text-white">{memoryRules.filter(r => r.isActive).length} Active</p>
          </div>
          <div className="px-4 py-2.5 rounded-2xl bg-neutral-950 border border-neutral-800 text-center">
            <p className="text-[9px] font-black text-neutral-500 uppercase">Review Queue</p>
            <p className="text-sm font-black text-amber-400">{pendingModerate + pendingCritical} Items</p>
          </div>
          <div className="px-4 py-2.5 rounded-2xl bg-neutral-950 border border-neutral-800 text-center">
            <p className="text-[9px] font-black text-neutral-500 uppercase">Time Saved</p>
            <p className="text-sm font-black text-emerald-400">42m 15s</p>
          </div>
        </div>
      </div>

      {/* OS Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto py-1 border-b border-neutral-800">
        {[
          { id: "review", label: isSk ? "Show Me Only What Matters" : "Review Queue", icon: ShieldAlert, badge: pendingModerate + pendingCritical },
          { id: "brain", label: isSk ? "Editor Brain & Memory" : "Editor Brain", icon: Brain },
          { id: "dna", label: isSk ? "Edit DNA Profile" : "Edit DNA", icon: Sliders },
          { id: "locks", label: isSk ? "AI Lock Zones" : "Lock Zones", icon: Lock },
          { id: "universe", label: isSk ? "Content Universe" : "Content Universe", icon: Layers },
          { id: "timemachine", label: isSk ? "Time Machine" : "Time Machine", icon: Clock },
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all whitespace-nowrap relative ${
                isActive 
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20" 
                  : "bg-neutral-900/60 text-neutral-400 hover:text-white hover:bg-neutral-800"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-black text-[9px] font-black">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab 1: Review Queue ("Show Me Only What Matters") */}
      {activeTab === "review" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-wider">
                  {isSk ? "Inteligentný prehľad rozhodnutí" : "Smart Review Queue"}
                </h3>
                <p className="text-xs text-neutral-400">
                  {isSk ? "AI roztriedila úpravy. Nemusíte kontrolovať 100% video, iba dôležité body." : "AI categorized edits. Review only what matters instead of the whole video."}
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs font-bold">
                <span className="flex items-center gap-1 text-emerald-400"><span className="w-2 h-2 rounded-full bg-emerald-500" /> {pendingSafe} Safe</span>
                <span className="flex items-center gap-1 text-amber-400"><span className="w-2 h-2 rounded-full bg-amber-500" /> {pendingModerate} Review</span>
                <span className="flex items-center gap-1 text-rose-500"><span className="w-2 h-2 rounded-full bg-rose-500" /> {pendingCritical} Critical</span>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {reviewItems.map(item => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-5 rounded-2xl border transition-all flex flex-col gap-3 ${
                    item.status === "ACCEPTED" ? "bg-emerald-950/20 border-emerald-500/30 opacity-70" :
                    item.status === "REJECTED" ? "bg-rose-950/20 border-rose-500/30 opacity-70" :
                    item.riskLevel === "CRITICAL" ? "bg-neutral-900 border-rose-500/50 shadow-lg shadow-rose-500/10" :
                    item.riskLevel === "MODERATE" ? "bg-neutral-900 border-amber-500/40" :
                    "bg-neutral-900/60 border-neutral-800"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${
                        item.riskLevel === "CRITICAL" ? "bg-rose-500/20 text-rose-400 border border-rose-500/30" :
                        item.riskLevel === "MODERATE" ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" :
                        "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      }`}>
                        {item.riskLevel}
                      </span>
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">{item.category}</span>
                      <span className="text-[10px] font-black text-indigo-400">Pattern Match: {item.patternMatch}%</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {item.status === "PENDING" ? (
                        <>
                          <button
                            onClick={() => {
                              onReviewItem(item.id, "REJECTED");
                              showToast(isSk ? "Zmena zamietnutá a uložená do pamäte." : "Change rejected & saved to memory.");
                            }}
                            className="px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-rose-400 text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            <span>{isSk ? "Zamietnuť" : "Reject"}</span>
                          </button>
                          <button
                            onClick={() => {
                              onReviewItem(item.id, "ACCEPTED");
                              showToast(isSk ? "Zmena schválená." : "Change accepted.");
                            }}
                            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1 shadow-lg shadow-emerald-600/20"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>{isSk ? "Schváliť" : "Accept"}</span>
                          </button>
                        </>
                      ) : (
                        <span className={`text-xs font-black uppercase ${item.status === "ACCEPTED" ? "text-emerald-400" : "text-rose-400"}`}>
                          {item.status}
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-black text-white uppercase tracking-tight">
                      {isSk ? item.titleSk : item.titleEn}
                    </h4>
                  </div>

                  {/* Why did you change this? */}
                  <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 flex items-start gap-2.5">
                    <HelpCircle className="h-4 w-4 text-indigo-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[10px] font-black text-indigo-300 uppercase tracking-wider">Why did you change this?</p>
                      <p className="text-xs text-neutral-300 italic mt-0.5">
                        {isSk ? item.whySk : item.whyEn}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-4 flex flex-col gap-6">
            <div className="p-6 rounded-3xl bg-neutral-900 border border-neutral-800 space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-600/20 text-indigo-400">
                  <Activity className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-white uppercase tracking-wider">AI Shadow Editor</h4>
                  <p className="text-[10px] text-neutral-400">Observing your workflow</p>
                </div>
              </div>
              <p className="text-xs text-neutral-300 leading-relaxed">
                {isSk
                  ? "Shadow Editor v pozadí sleduje vaše manuálne úpravy (posuny strihov, ponechané pauzy, zmeny zoomu) a buduje Decision Patterns pre budúce projekty."
                  : "Shadow Editor silently observes your manual adjustments (cut shifts, kept pauses, zoom changes) and builds Decision Patterns for future projects."}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Editor Brain & Memory */}
      {activeTab === "brain" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 flex flex-col gap-4">
            <h3 className="text-sm font-black text-white uppercase tracking-wider">
              {isSk ? "Editing Memory & Rules" : "Editing Memory Rules"}
            </h3>
            <p className="text-xs text-neutral-400">
              {isSk ? "Pravidlá, ktoré sa systém naučil z vašich predošlých manuálnych opráv." : "Rules learned by the system from your past manual overrides."}
            </p>

            <div className="flex flex-col gap-3">
              {memoryRules.map(rule => (
                <div key={rule.id} className="p-5 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="p-2.5 rounded-xl bg-indigo-600/20 text-indigo-400">
                      <Brain className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs font-black text-white">{isSk ? rule.ruleSk : rule.ruleEn}</p>
                      <p className="text-[10px] text-neutral-500 font-bold uppercase mt-1">
                        Occurrences: {rule.occurrences}x • Confidence: {(rule.confidence * 100).toFixed(0)}%
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      onToggleRule(rule.id);
                      showToast(isSk ? "Pravidlo upravené." : "Rule updated.");
                    }}
                    className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                      rule.isActive ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20" : "bg-neutral-800 text-neutral-500"
                    }`}
                  >
                    {rule.isActive ? (isSk ? "AKTÍVNE" : "ACTIVE") : (isSk ? "VYPNUTÉ" : "OFF")}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-5 flex flex-col gap-6">
            <div className="p-6 rounded-3xl bg-neutral-900 border border-neutral-800 space-y-4">
              <h4 className="text-xs font-black text-white uppercase tracking-wider">Remember This Decision?</h4>
              <p className="text-xs text-neutral-400 leading-relaxed">
                {isSk
                  ? "Keď manuálne vrátite späť alebo upravíte AI rozhodnutie, systém sa spýta, či si má tento vzorec zapamätať do budúcna."
                  : "When you manually override an AI decision, the system asks whether to remember this pattern for future edits."}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Edit DNA */}
      {activeTab === "dna" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-wider">
                  {isSk ? "Edit DNA Profile" : "Edit DNA Profile"}
                </h3>
                <p className="text-xs text-neutral-400">
                  {isSk ? "Každý projekt má vlastnú genetickú štruktúru strihu, tempa a štýlu." : "Every project has its own genetic structure of pacing, cuts, and style."}
                </p>
              </div>

              <button
                onClick={() => showToast(isSk ? "Edit DNA uložená ako predvoľba!" : "Edit DNA saved as preset!")}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-indigo-600/20"
              >
                {isSk ? "Uložiť ako Edit DNA" : "Save as Edit DNA"}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-5 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-3">
                <label className="text-xs font-black text-white uppercase tracking-wider">Profile Name</label>
                <input
                  type="text"
                  value={editDNA.profileName}
                  onChange={(e) => onUpdateDNA({ ...editDNA, profileName: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-white text-xs font-bold"
                />
              </div>

              <div className="p-5 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-3">
                <label className="text-xs font-black text-white uppercase tracking-wider">Pacing</label>
                <select
                  value={editDNA.pacing}
                  onChange={(e) => onUpdateDNA({ ...editDNA, pacing: e.target.value as any })}
                  className="w-full px-4 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-white text-xs font-bold"
                >
                  <option value="FAST">Fast (TikTok / Shorts)</option>
                  <option value="BALANCED">Balanced</option>
                  <option value="CINEMATIC">Cinematic / Slow</option>
                </select>
              </div>

              <div className="p-5 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-3">
                <label className="text-xs font-black text-white uppercase tracking-wider">Pause Tolerance ({editDNA.pauseTolerance}s)</label>
                <input
                  type="range"
                  min="0.2"
                  max="1.5"
                  step="0.1"
                  value={editDNA.pauseTolerance}
                  onChange={(e) => onUpdateDNA({ ...editDNA, pauseTolerance: parseFloat(e.target.value) })}
                  className="w-full accent-indigo-500"
                />
              </div>

              <div className="p-5 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-3">
                <label className="text-xs font-black text-white uppercase tracking-wider">Hook Intensity</label>
                <select
                  value={editDNA.hookIntensity}
                  onChange={(e) => onUpdateDNA({ ...editDNA, hookIntensity: e.target.value as any })}
                  className="w-full px-4 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-white text-xs font-bold"
                >
                  <option value="HIGH">High (Aggressive punch-ins & SFX)</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="SUBTLE">Subtle</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: AI Lock Zones */}
      {activeTab === "locks" && (
        <div className="flex flex-col gap-4 max-w-4xl">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider">
                {isSk ? "AI 'Do Not Touch' Zóny (🔒 Lock)" : "AI 'Do Not Touch' Zones"}
              </h3>
              <p className="text-xs text-neutral-400">
                {isSk ? "Označte prvky, ktoré AI nesmie meniť ani preštiepiť." : "Lock elements that AI is strictly forbidden from altering or cutting."}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {lockZones.map(zone => (
              <div key={zone.id} className="p-5 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl ${zone.isLocked ? "bg-rose-600/20 text-rose-400" : "bg-neutral-800 text-neutral-500"}`}>
                    <Lock className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-black text-white uppercase">{isSk ? zone.labelSk : zone.labelEn}</p>
                    <p className="text-[10px] text-neutral-500 font-bold uppercase mt-0.5">Type: {zone.type} {zone.timeRange ? `• ${zone.timeRange}` : ""}</p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    onToggleLock(zone.id);
                    showToast(isSk ? "Stav zámku zmenený." : "Lock status updated.");
                  }}
                  className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                    zone.isLocked ? "bg-rose-600 text-white shadow-lg shadow-rose-600/20" : "bg-neutral-800 text-neutral-400"
                  }`}
                >
                  <Lock className="h-3.5 w-3.5" />
                  <span>{zone.isLocked ? (isSk ? "ZAMKNUTÉ" : "LOCKED") : (isSk ? "DOMYSLENÉ" : "UNLOCKED")}</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 5: Content Universe */}
      {activeTab === "universe" && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider">
                {isSk ? "One Source → Entire Content Universe" : "Content Universe Graph"}
              </h3>
              <p className="text-xs text-neutral-400">
                {isSk ? "Z jedného RAW projektu vytvoril systém celý balík multi-platformových výstupov." : "System generated an entire universe of multi-platform outputs from one RAW source."}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {contentUniverse.map(item => (
              <div key={item.id} className="p-5 rounded-2xl bg-neutral-900 border border-neutral-800 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded bg-indigo-500/20 text-indigo-400 font-black text-[9px] uppercase tracking-wider border border-indigo-500/30">
                    {item.type}
                  </span>
                  <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {item.status}
                  </span>
                </div>

                <h4 className="text-sm font-black text-white uppercase">{isSk ? item.titleSk : item.titleEn}</h4>
                {item.duration && <p className="text-[10px] text-neutral-500 font-bold">Duration: {item.duration}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 6: Time Machine */}
      {activeTab === "timemachine" && (
        <div className="flex flex-col gap-4 max-w-3xl">
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-wider">
              {isSk ? "Time Machine (Edit Timeline History)" : "Time Machine"}
            </h3>
            <p className="text-xs text-neutral-400">
              {isSk ? "Obnovte presný stav úprav z ľubovoľného momentu v čase." : "Restore exact editing state from any point in time."}
            </p>
          </div>

          <div className="flex flex-col gap-3">
            {timeMachine.map(ver => (
              <div key={ver.id} className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-neutral-800 text-neutral-300">
                    <Clock className="h-4 w-4 text-indigo-400" />
                  </div>
                  <div>
                    <p className="text-xs font-black text-white">{isSk ? ver.actionSk : ver.actionEn}</p>
                    <p className="text-[10px] text-neutral-500 font-bold uppercase">{ver.timestamp} • Author: {ver.author}</p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    onRestoreVersion(ver.id);
                    showToast(isSk ? "Verzia bola úspešne obnovená." : "Version successfully restored.");
                  }}
                  className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5"
                >
                  <RefreshCcw className="h-3.5 w-3.5" />
                  <span>{isSk ? "Obnoviť" : "Restore"}</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
