# MASTER ARCHITECTURAL BLUEPRINT & TECHNICAL SPECIFICATION: OMNISTRIH AI V2 (REV 3.0)

Tento dokument je **Source of Truth** pre produktovú, UX, dátovú a technickú architektúru **OmniStrih AI V2**. Slúži ako špecifikácia, podľa ktorej môže AI alebo vývojár implementovať jednotlivé moduly bez toho, aby menil existujúce kontrakty, dátový model alebo správanie ostatných modulov.

Tento architektúrny systém stavia na troch najdôležitejších pilieroch, ktoré menia OmniStrih z obyčajného "AI video makera" na inteligentný profesionálny editorový ekosystém:
1. 🥇 **Content Graph** (Sémantická štruktúra od RAW zdrojového videa cez Topics, Moments, Stories, Clips až po koncové platformové Variations).
2. 🥈 **Dependency + Change Impact System** (Graf závislostí a inteligentná invalidácia prepočtov pre minimálne API/token náklady).
3. 🥉 **Editor Intelligence Layer** (Učiaci sa model, ktorý sleduje preferencie editora a automaticky si prispôsobuje štýly strihu).

---

## 1. THE ARCHITECTURAL HIERARCHY

```
 [1. PRODUCT REQUIREMENTS] ──► [2. UX & CANVAS LAYOUT] ──► [3. CORE STATE ENGINE]
                                                                │
 [6. MODULES & PIPELINES]  ◄── [5. EDITOR ENGINE & TIMELINE] ◄──┼──► [4. AI CAPABILITY MATRIX]
          │                                                     │
          ▼                                                     ▼
 [7. RENDER ENGINE] ────────► [8. TESTING & QUALITY TESTS] ─────┴──► [9. CONTENT GRAPH]
```

---

## 2. THE ABSOLUTE "SOURCE OF TRUTH" (PROJECT STATE SCHEMA)

Every module inside OmniStrih AI V3.0 is entirely stateless. Modules are strictly prohibited from maintaining isolated, desynchronized versions of project metadata. All operations (editor timeline, active players, subtitle drawers, export compilers) read from and write to a single, unified, centralized `ProjectState` data tree.

```
                      ┌──────────────────────────────────────────┐
                      │          UNIFIED PROJECT STATE           │
                      └──────────────────────────────────────────┘
                            │                  │               │
         ┌──────────────────┴─┐         ┌──────┴──────┐        │
         │   sourceMedia      │         │ transcript  │        │
         └────────────────────┘         └─────────────┘        │
         │   analysis         │         │ storyPlan   │        │
         └────────────────────┘         └─────────────┘        ▼
         │   editDecisionList │         │  timeline   │  [7. VERSIONS & ROLLBACKS]
         └────────────────────┘         └─────────────┘  [8. CHRONOLOGICAL AUDIT LOG]
         │   captions         │         │   broll     │  [9. COST CONTROL CENTER]
         └────────────────────┘         └─────────────┘  [10. EDITOR INTELLIGENCE]
         │    audio           │         │  effects    │  [11. SEMANTIC CONTENT GRAPH]
         └────────────────────┘         └─────────────┘
```

### 2.1. THE STATE SCHEMAS (TypeScript)

```typescript
export interface WordTiming {
  word: string;
  start: number;
  end: number;
  confidence?: number;
  emphasis?: "KEYWORD" | "NUMBER" | "EMOTION" | "WARNING" | "NONE";
}

export interface CaptionSegment {
  id: string;
  start: number;
  end: number;
  text: string;
  emoji?: string;
  words: WordTiming[];
}

export interface AIJob {
  job_id: string;
  type: "TRANSCRIPTION" | "SEMANTIC_SPLIT" | "BROLL_GENERATION" | "AUDIO_CLARIFIER" | "VIDEO_ANALYSIS" | "RENDER_EXPORT";
  status: "WAITING" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
  progress: number; // 0 to 100
  project_id: string;
  input_version: number;
  output_version?: number;
  costInTokens?: number;
  error?: string;
  created_at: string;
}

export interface AIAuditEntry {
  id: string;
  timestamp: string; // e.g., "19:42:05"
  actionName: string; // e.g., "AI Jump Cut"
  outcomeSummary: string; // e.g., "Removed 12 silent segments, saved 8.4 sec"
  whyReasoning: string; // e.g., "Silence threshold set to 1.2s. Extracted gaps exceeding limit to ensure uninterrupted pacing."
}

export interface AIVersionedOutput<T> {
  id: string;
  version: number;
  createdAt: string;
  author: "AI" | "USER";
  payload: T;
  label: string; // e.g., "Whisper Draft", "Manual Spellcheck V3"
}

export interface ProjectState {
  id: string;
  name: string;
  version: number; // Incremented on every single state transaction
  lastModified: string;

  // 1. Source Media Metadata
  sourceMedia: {
    url: string;
    filename: string;
    duration: number;
    resolution: "1080p" | "4K" | "Custom";
    fps: number;
    aspectRatio: "16:9" | "9:16" | "1:1";
    fileSize: string;
  };

  // 2. Transcription Layer (Chronological Alignment)
  transcript: {
    language: "sk" | "en" | "sk/en";
    translatedLanguage?: "sk" | "en";
    segments: CaptionSegment[]; 
    versions: AIVersionedOutput<CaptionSegment[]>[]; // Track transcript revisions
  };

  // 3. AI Analysis Data (Metadata extracted from video/audio)
  analysis: {
    isAnalyzed: boolean;
    totalFillerWords: number;
    totalSilenceRemoved: number;
    estimatedEditedDuration: number;
    sceneChanges: number[]; // Timestamp list
    gazeVectorData?: any; // Eyeline coordinates for Auto-Reframe
  };

  // 4. Story Plan Guide
  storyPlan: {
    blocks: StoryBlock[]; // Narrative structure (Hook -> Promise -> Context -> CTA)
    versions: AIVersionedOutput<StoryBlock[]>[]; // Compare storyboards
  };

  // 5. Edit Decision List (EDL) (Cutting coordinates)
  editDecisionList: {
    cuts: { id: string; start: number; end: number; type: "speech" | "custom"; disabled: boolean }[];
    transitionPreset: "none" | "fade" | "zoom" | "whip";
  };

  // 6. Active Pro Timeline Lanes
  timeline: {
    zoomScale: number; // Viewport scaling multiplier
    playheadTime: number; // Current playback position
    isPlaying: boolean;
  };

  // 7. Subtitles Customizer Design
  captions: {
    style: "HORMOZI" | "MINIMAL" | "ROSE_BOLD" | "TACTILE";
    fontFamily: string;
    fontSize: number;
    color: string;
    outlineColor: string;
    outlineWidth: number;
    shadowEnabled: boolean;
    position: "top" | "center" | "bottom";
    wordsPerCaption: "auto" | number;
    maxCharacters: number;
    maxLines: number;
    minDuration: number;
    maxDuration: number;
    case: "uppercase" | "lowercase" | "normal";
    versions: AIVersionedOutput<any>[]; // Caption design versions
  };

  // 8. B-Roll Overlays Overlay List
  broll: {
    overlays: { id: string; start: number; end: number; url: string; title: string; transition: string }[];
  };

  // 9. Master Audio Balances
  audio: {
    bgMusicTrack: string;
    bgMusicVolume: number;
    voiceClarifierEnabled: boolean;
    studioNormalizeAudio: boolean;
    soundtrackSyncEnabled: boolean;
  };

  // 10. Dynamic Visual Effects
  effects: {
    autoZoomEnabled: boolean;
    zoomIntensity: number;
    sfxMarkers: { id: string; timestamp: number; type: "ding" | "whoosh" | "glitch"; volume: number }[];
    reframeMode: "auto" | "manual";
  };

  // 11. Hook Testing Versions
  versions: {
    activeVersionId: string;
    options: { id: string; name: string; hookTextSk: string; hookTextEn: string; status: "A" | "B" }[];
  };

  // 12. Export Progress
  export: {
    targetPlatform: "tiktok" | "reels" | "youtube_shorts" | "custom";
    status: "idle" | "rendering" | "completed" | "failed";
    progress: number;
  };

  // 13. AI Audit Ledger
  auditLog: AIAuditEntry[];

  // 14. Cost Control Pool
  costControl: {
    localProcessingRatio: number; // Percentage, e.g. 72%
    aiUsageRatio: number; // Percentage, e.g. 28%
    estimatedCosts: {
      transcription: number; // USD
      analysis: number; // USD
      brollGeneration: number; // USD
      voiceover: number; // USD
    };
    alertBeforeExpensiveAction: boolean;
  };

  // 15. Editor Intelligence Preferences
  editorIntelligence: {
    keepNaturalPauses: boolean;
    removeFillerWords: boolean;
    punchInIntensity: number; // e.g. 110%
    emphasisTrigger: "EMPHASIS" | "EMOTION" | "KEYWORD" | "NONE";
    learnedStyles: {
      preferredCaptionPreset: string;
      preferredTransition: string;
      voiceClarifierAutoTrigger: boolean;
    };
  };

  // 16. Semantic Content Graph Relationship
  contentGraph: {
    sourceVideoId: string;
    topics: { id: string; nameSk: string; nameEn: string; importance: number }[];
    moments: { id: string; start: number; end: number; description: string; score: number }[];
    stories: { id: string; title: string; narrativeArc: string; momentIds: string[] }[];
    clips: { id: string; storyId: string; title: string; duration: number }[];
    variations: { id: string; clipId: string; hookVersion: string; platform: "tiktok" | "reels" | "youtube" }[];
  };
}
```

---

## 3. THE CHANGE IMPACT SYSTEM

To optimize client-side resources and avoid redundant API billing, OmniStrih AI V3 operates under a strict **Dependency Propagation and Invalidation Tree**. A change to a higher-level state node invalidates only its downstream children, recalculating data ONLY where strictly necessary.

```
       [CHANGE STATE NODE]
               │
               ▼
      [DEPENDENCY CHECK]
               │
               ▼
  [INVALIDATE DOWNSTREAM ONLY]
               │
               ▼
    [RECALCULATE TARGET LAYER]
```

### INVALIDATION STATE MATRIX

| Trigger Event | Directly Affects | Invalidation Scope | Recalculation Action |
|---|---|---|---|
| **Change Caption Styling** (Font, outline, shadows, colors) | `captions` | None (Local design only) | Immediate re-render of canvas Overlay. **No API queries, no transcription, no cutting.** |
| **Modify Transcript Text** (Spelling corrections, casing) | `transcript` | `captions` | Recalculate subtitle text overlays only. Preserve existing timeline and cuts. |
| **Change Jump-Cut Silence Threshold** (Cutting db) | `editDecisionList` | `timeline` -> `captions` -> `broll` -> `effects` | Recalculate EDL cuts. Shift all caption timeframes, B-roll triggers, and SFX markers to match new speech-cut timings. |
| **Change Story Order** (Re-organizing video blocks) | `storyPlan` | `editDecisionList` -> `captions` -> `broll` -> `audio` | Recalculate timeline structure. Re-stitch captions, sound effects, and B-roll overlays to sync with new block positions. |
| **Change BG Soundtrack Volume** (Volume slider) | `audio` | None (Local slider only) | Update local WebAudio gain volume node instantly. **Zero token cost.** |
| **Add New Video Clip** (Media Object switch) | `sourceMedia` | **All Downstream Items Invalidated** | Complete rebuild: Transcript, Silence detection, Story Plan, Captions, and Timeline. |

---

## 4. NON-BLOCKING AI JOB QUEUE

All server-side or resource-intensive operations (Whisper transcription, Gemini semantic parsing, B-roll image generation) must run inside a **Non-Blocking Job Queue**. The UI remains fully responsive during execution, and users can cancel jobs at any point.

```
  ┌────────────────────────────────────────────────────────┐
  │                     AI JOB QUEUE                       │
  ├────────────────────────────────────────────────────────┤
  │  [JOB #001]  Transcription       ████████░░ 80%        │
  │  [JOB #002]  Video Analysis      WAITING               │
  │  [JOB #003]  B-roll Analysis     WAITING               │
  └────────────────────────────────────────────────────────┘
```

### JOB QUEUE ORCHESTRATION LAWS:
1. **Concurrency Limit Law:** Maximum of 1 running job. All subsequent tasks must reside in `WAITING` status until the preceding job is completed.
2. **The "Cancel Job" Directive:** Every active job must expose a cancellation token hook. Cancelling a job immediately terminates the execution thread, deletes the temp task state, and releases any held resource locks.
3. **Queue Interface Law:** The user interface must present a dedicated background task manager widget showing ongoing jobs, progress bars, estimated times, token metrics, and active cancellation controls.

---

## 5. RUNTIME AI CAPABILITY MATRIX

To prevent redundant API costs and excessive latency, follow this execution matrix strictly. Local operations must always run client-side without reaching out to server-side Gemini/external API models.

| Capability / Function | Local (Client-side) | AI / Server Model | External API / Cloud | Manual Fallback | Latency | Token Cost |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| **Trim, Blade & EDL Cuts** | ✅ **100%** | ❌ *No* | ❌ *No* | ✅ *Yes* | < 5ms | **Zero** |
| **Caption Design & Styling**| ✅ **100%** | ❌ *No* | ❌ *No* | ✅ *Yes* | < 2ms | **Zero** |
| **Timeline Panning & Zooms**| ✅ **100%** | ❌ *No* | ❌ *No* | ✅ *Yes* | < 1ms | **Zero** |
| **Manual Word Emphasis** | ✅ **100%** | ❌ *No* | ❌ *No* | ✅ *Yes* | < 1ms | **Zero** |
| **Autocut & Silence Detection**| ✅ **WebAudio FFT**| ❌ *No* | ❌ *No* | ✅ *Yes* | < 50ms | **Zero** |
| **Voiceover Audio Clarifier** | ✅ **100%** | ❌ *No* | ❌ *No* | ✅ *Yes* | < 15ms | **Zero** |
| **Voiceover Synthesis (Slovak)**| ❌ *No* | ✅ **AI TTS** | ⚠️ *Optional* | ✅ *Yes* | ~1.5s | **Low** |
| **Voice Recognition / Transcript**| ⚠️ *Offline engine*| ✅ **Whisper/Gemini** | ⚠️ *Optional* | ✅ *Yes* | ~3.0s | **Medium**|
| **Semantic Paragraph Split** | ⚠️ *RegEx Parser* | ✅ **Gemini AI** | ❌ *No* | ✅ *Yes* | ~800ms | **Low** |
| **Emotional Emphasis Parser** | ❌ *No* | ✅ **Gemini AI** | ❌ *No* | ✅ *Yes* | ~1.2s | **Medium**|
| **Stock B-Roll Recommendation**| ❌ *No* | ✅ **Gemini AI** | ✅ **Unsplash/Pexels**| ✅ *Yes* | ~1.8s | **Medium**|

---

## 6. RENDER ENGINE & TIMELINE LAWS
- **ResizeObserver Law:** Canvas viewport size calculations must never use hardcoded window offsets. Attach a `ResizeObserver` on the parent workspace container and recalculate standard crop vectors on modification.
- **Render Loop Law:** The canvas viewport must sync frame-by-frame using a requestAnimationFrame loop, updating bounding indicators and safe-zone lines based strictly on `currentTime` timestamps.
- **Zero Double-Draw Rule:** Do not duplicate drawing cycles on the canvas layer. Subtitle elements, zoom coordinates, and watermarks must be rendered in a single centralized render function inside `VideoPlayer`.

---

## 7. VERIFICATION & TEST CRITERIA
- **State Persistence Test:** Verify that reloading the page, or switching between edit screens, keeps the project configurations and current workspace tab in `localStorage` without resetting to the dashboard.
- **JSON Payload Integrity:** Check that any API transactions sending transcript data or prompt states validate the properties schema in Section 1 before calling endpoints.
