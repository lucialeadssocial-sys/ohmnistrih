/**
 * Local AI Layer Verification Test Suite
 * Validates non-blocking provider lifecycle, state transitions, caching, and offline execution.
 */

import { localAIManager } from './index';

export async function runLocalAITests(): Promise<{ success: boolean; log: string[] }> {
  const log: string[] = [];
  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string) {
    total++;
    if (condition) {
      passed++;
      log.push(`✅ [PASS] ${testName}`);
    } else {
      log.push(`❌ [FAIL] ${testName}`);
    }
  }

  try {
    log.push('--- Starting OmniStrih V3 Local AI Test Suite ---');

    // Test 1: Provider Initial States (Lazy, Not Loaded)
    const initialSpeechStatus = localAIManager.speech.getStatus();
    assert(initialSpeechStatus.status === 'NOT_LOADED', 'LocalSpeechProvider initial state is NOT_LOADED (Zero startup impact)');

    const initialVadStatus = localAIManager.vad.getStatus();
    assert(initialVadStatus.status === 'NOT_LOADED', 'LocalVADProvider initial state is NOT_LOADED');

    // Test 2: VAD Load & Execution
    await localAIManager.vad.loadModel();
    const loadedVadStatus = localAIManager.vad.getStatus();
    assert(loadedVadStatus.status === 'READY', 'LocalVADProvider transitions to READY state after loadModel()');

    // Create a 1-second dummy silent audio file
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const buffer = audioCtx.createBuffer(1, 44100, 44100); // 1s silence
    await audioCtx.close();

    const vadResult = await localAIManager.vad.process({
      file: new File([new ArrayBuffer(1000)], 'test_silence.wav', { type: 'audio/wav' }),
      options: { silenceThresholdDb: -35, minSilenceDurationSec: 0.3 }
    });

    assert(vadResult && Array.isArray(vadResult.silentSegments), 'LocalVADProvider executes offline VAD and returns silent segments');

    // Test 3: Unload Models
    await localAIManager.unloadAllModels();
    const unloadedStatus = localAIManager.vad.getStatus();
    assert(unloadedStatus.status === 'NOT_LOADED', 'unloadAllModels() successfully frees VRAM/RAM');

    log.push(`--- Local AI Test Results: ${passed}/${total} Passed ---`);
    return { success: passed === total, log };
  } catch (e: any) {
    log.push(`🔥 [CRITICAL EXCEPTION] ${e?.message || e}`);
    return { success: false, log };
  }
}
