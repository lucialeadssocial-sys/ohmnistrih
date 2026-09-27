export const TOOL_TO_ACADEMY_MAP: Record<string, string> = {
  // EDIT
  "trim": "PAUSE_TRIMMING",
  "split": "J_CUT",
  "smart_cut": "PAUSE_TRIMMING",
  "bad_take": "PAUSE_TRIMMING",
  "crop": "HOOK_PUNCHIN",
  
  // CLEANUP
  "object_removal": "BROLL_INSERTION",
  "background_removal": "COLOR_BALANCING",
  
  // VIDEO
  "punch_in": "HOOK_PUNCHIN",
  "transition": "TRANSITION_SELECTION",
  "speed_ramp": "INFORMATION_DENSITY",
  
  // SOCIAL
  "auto_reframe": "HOOK_PUNCHIN",
  "social_reframe": "INFORMATION_DENSITY",
  
  // CAPTIONS
  "captions": "CAPTIONS_EMPHASIS",
  "kinetic_text": "CAPTIONS_EMPHASIS",
  
  // AUDIO
  "noise_removal": "AUDIO_DUCKING",
  "voice_enhancement": "AUDIO_DUCKING",
  "music": "AUDIO_DUCKING",
  "ducking": "AUDIO_DUCKING",
  "j_cut": "J_CUT",
  "l_cut": "L_CUT",
  
  // B-ROLL
  "broll": "BROLL_INSERTION",
  "image": "BROLL_INSERTION"
};

export const getAcademyTopicForTool = (toolId: string): string | null => {
  return TOOL_TO_ACADEMY_MAP[toolId] || null;
};
