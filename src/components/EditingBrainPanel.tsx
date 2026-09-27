import React from 'react';
import { ProjectModel } from '../core/types/project';
import { editingBrain } from '../core/ai/editingBrain';

export const EditingBrainPanel: React.FC<{ project: ProjectModel }> = ({ project }) => {
  return (
    <div className="p-4 bg-neutral-900 text-white rounded-lg border border-neutral-800">
      <h2 className="text-xs font-black mb-4">PERSONAL EDITING BRAIN</h2>
      <div className="space-y-2">
        {project.editingPreferences?.map(pref => (
          <div key={pref.id} className="p-2 bg-neutral-950 rounded text-[10px] border border-neutral-800">
            <div className="flex justify-between">
              <span className="font-bold">{pref.category}</span>
              <span>{Math.round(pref.confidence * 100)}% Conf</span>
            </div>
            <p className="text-neutral-400">Context: {pref.context} | Evidence: {pref.evidenceCount}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
