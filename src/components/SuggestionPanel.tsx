// src/components/SuggestionPanel.tsx
import React from "react";
import { Suggestion } from "../types";

interface SuggestionPanelProps {
  suggestions: Suggestion[];
  onApply: (id: string) => void;
  onReject: (id: string) => void;
}

export const SuggestionPanel: React.FC<SuggestionPanelProps> = ({ suggestions, onApply, onReject }) => {
  if (suggestions.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 bg-white p-4 rounded-lg shadow-lg z-50 w-80">
      <h3 className="font-bold mb-2">AI Suggestions</h3>
      {suggestions.filter(s => s.status === 'pending').map(s => (
        <div key={s.id} className="mb-2 p-2 bg-gray-100 rounded">
          <p className="text-sm">{s.descriptionEn}</p>
          <div className="flex gap-2 mt-2">
            <button onClick={() => onApply(s.id)} className="text-xs bg-green-500 text-white px-2 py-1 rounded">Apply</button>
            <button onClick={() => onReject(s.id)} className="text-xs bg-red-500 text-white px-2 py-1 rounded">Reject</button>
          </div>
        </div>
      ))}
    </div>
  );
};
