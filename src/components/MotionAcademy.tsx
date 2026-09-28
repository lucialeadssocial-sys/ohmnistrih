import React, { useState, useEffect } from 'react';
import { BookOpen, Zap, Layers, Play, GraduationCap, CheckCircle2, AlertCircle } from 'lucide-react';
import { coreEngine } from '../core';
import { AddClipCommand, UpdateKeyframeCommand, UpdateClipPropsCommand } from '../core/command/commandSystem';

export const MotionAcademy: React.FC = () => {
  const [activePracticeId, setActivePracticeId] = useState<string | null>(null);
  // Progress counts lessons whose practice the user actually started in this session.
  const [startedLessons, setStartedLessons] = useState<number[]>([]);
  const [comparisonResult, setComparisonResult] = useState<{ score: number; message: string } | null>(null);

  useEffect(() => {
    (window as any).showMotionAcademy = () => {
      // In a real app, this would open a modal or navigate to the Academy tab
      console.log("Motion Academy Triggered");
      const element = document.getElementById('motion-academy-panel');
      if (element) element.scrollIntoView({ behavior: 'smooth' });
    };
    return () => { (window as any).showMotionAcademy = null; };
  }, []);

  const lessons = [
    { id: 1, title: "Visual Hierarchy", desc: "Guide viewer attention", level: "Pro" },
    { id: 2, title: "Timing & Easing", desc: "Professional motion curves", level: "Expert" },
    { id: 3, title: "Kinetic Typography", desc: "Emphasis through movement", level: "Pro" },
    { id: 4, title: "Motion Restraint", desc: "Less is more", level: "Beginner" }
  ];

  const startPractice = (lessonId: number) => {
    const project = coreEngine.commandManager.getProject();
    const track = project.tracks.find(t => t.type === 'video') || project.tracks[0];
    
    // Create a practice text clip
    const clipId = `practice_${crypto.randomUUID().slice(0, 8)}`;
    setActivePracticeId(clipId);
    setComparisonResult(null);
    setStartedLessons(prev => (prev.includes(lessonId) ? prev : [...prev, lessonId]));

    const addCmd = new AddClipCommand(
      `Start Practice: ${lessons.find(l => l.id === lessonId)?.title}`,
      track.id,
      {
        id: clipId,
        trackId: track.id,
        name: "PRACTICE: User Layer",
        type: 'text',
        timelineStart: project.playheadTime,
        duration: 3,
        scale: 100,
        textConfig: {
          content: "REPLICATE THIS",
          fontFamily: "Inter",
          fontSize: 60,
          color: "#rose-500",
          textAlign: "center",
          fontWeight: "800"
        }
      }
    );

    if (coreEngine.commandManager.executeCommand(addCmd)) {
      // Hidden reference clip (Pro version)
      const proClipId = `pro_ref_${clipId}`;
      coreEngine.commandManager.executeCommand(new AddClipCommand(
        "PRO Reference (Hidden)",
        track.id,
        {
          id: proClipId,
          trackId: track.id,
          name: "PRO REFERENCE",
          type: 'text',
          timelineStart: project.playheadTime,
          duration: 3,
          opacity: 0, // Hidden
          keyframes: [
            { id: 'p1', timeOffset: 0, parameter: 'scale', value: 0, easing: 'easeOut' },
            { id: 'p2', timeOffset: 0.3, parameter: 'scale', value: 110, easing: 'easeOut' },
            { id: 'p3', timeOffset: 0.5, parameter: 'scale', value: 100, easing: 'easeIn' }
          ]
        }
      ));
    }
  };

  const compareMyMotion = () => {
    if (!activePracticeId) return;
    const project = coreEngine.getProject();
    const userClip = project.tracks.flatMap(t => t.clips).find(c => c.id === activePracticeId);
    const proClip = project.tracks.flatMap(t => t.clips).find(c => c.id === `pro_ref_${activePracticeId}`);

    if (!userClip || !proClip) return;

    // Logic for comparison: check keyframe density and values
    const userKf = userClip.keyframes.filter(k => k.parameter === 'scale');
    const proKf = proClip.keyframes;

    let score = 0;
    if (userKf.length > 0) score += 40;
    if (userKf.length === proKf.length) score += 30;
    
    const peakUser = userKf.find(k => k.timeOffset > 0.1 && k.timeOffset < 0.5);
    if (peakUser && peakUser.value >= 105 && peakUser.value <= 115) score += 30;

    setComparisonResult({
      score,
      message: score > 80 ? "EXCELLENT! You nailed the professional pop timing." : 
               score > 50 ? "GOOD effort. Try to refine the peak scale value (110% is pro standard)." :
               "KEEP PRACTICING. Focus on adding keyframes at 0.3s for the initial impact."
    });

    // Update Editing Brain with this learning activity
    coreEngine.commandManager.executeCommand(new UpdateClipPropsCommand('Log Learning Action', activePracticeId, {
      learningMeta: {
        what: 'Motion Practice: Scale Pop',
        why: 'User engaged in timing & easing exercise.',
        how: `Score: ${score}%`,
        when: 'Now',
        category: 'MOTION'
      }
    } as any));
  };

  return (
    <div id="motion-academy-panel" className="p-4 bg-neutral-900 border border-neutral-800 rounded text-xs text-white">
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-black flex items-center gap-2"><BookOpen className="w-4 h-4 text-rose-500" /> MOTION ACADEMY</h2>
        <div className="px-2 py-0.5 bg-rose-950/50 text-rose-500 rounded-full text-[8px] font-bold border border-rose-900/50 flex items-center gap-1">
          <GraduationCap className="w-2 h-2" /> {startedLessons.length}/{lessons.length} LEKCIÍ SPUSTENÝCH
        </div>
      </div>

      <div className="space-y-2">
        {lessons.map(l => (
          <div key={l.id} className="p-3 bg-neutral-950 rounded border border-neutral-800 flex justify-between items-center group hover:border-rose-900/50 transition-colors">
            <div>
              <div className="flex items-center gap-2">
                <p className="font-bold">{l.title}</p>
                <span className="text-[8px] px-1 bg-neutral-800 rounded text-neutral-500">{l.level}</span>
              </div>
              <p className="text-[10px] text-neutral-400">{l.desc}</p>
            </div>
            <button 
              onClick={() => startPractice(l.id)}
              className="p-2 bg-neutral-900 border border-neutral-800 rounded group-hover:bg-rose-600 group-hover:border-rose-500 transition-all"
            >
              <Play className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>

      {activePracticeId && (
        <div className="mt-4 p-4 bg-zinc-950 border border-rose-900/30 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-rose-500 font-bold uppercase text-[9px]">Live Practice Session</h4>
            <span className="text-[8px] text-zinc-500 font-mono">ID: {activePracticeId}</span>
          </div>
          <p className="text-[10px] text-zinc-300">
            A practice clip has been added to your timeline. Adjust its keyframes in the Motion Inspector to match the professional reference.
          </p>
          <button 
            onClick={compareMyMotion}
            className="w-full py-2 bg-rose-600 hover:bg-rose-500 text-white font-black text-[10px] rounded transition-all flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="w-3 h-3" /> COMPARE MY MOTION
          </button>

          {comparisonResult && (
            <div className={`p-3 rounded border text-[10px] ${comparisonResult.score > 70 ? 'bg-emerald-950/30 border-emerald-900/50 text-emerald-400' : 'bg-amber-950/30 border-amber-900/50 text-amber-400'}`}>
              <div className="flex items-center justify-between mb-1 font-black">
                <span>RESULT: {comparisonResult.score}% MATCH</span>
                {comparisonResult.score > 70 ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
              </div>
              <p className="leading-tight">{comparisonResult.message}</p>
            </div>
          )}
        </div>
      )}

      <div className="mt-4 p-2 bg-neutral-950/50 rounded border border-dashed border-neutral-800 text-[9px] text-neutral-500 text-center">
        Academy exercises help the Personal Editing Brain learn your preferred animation styles.
      </div>
    </div>
  );
};
