import React, { useState, useEffect } from 'react';
import { Bug, X, Trash2, Copy, AlertTriangle, CheckCircle2, ChevronUp, ChevronDown } from 'lucide-react';

export interface AppErrorLog {
  id: string;
  timestamp: string;
  message: string;
  source?: string;
  stack?: string;
}

export const ErrorDebuggerOverlay: React.FC = () => {
  const [errors, setErrors] = useState<AppErrorLog[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      const msg = event.message || '';
      if (msg.toLowerCase().includes('websocket') || msg.toLowerCase().includes('vite')) {
        return; // Filter out benign Vite HMR connection notices
      }

      const newErr: AppErrorLog = {
        id: 'err_' + Date.now() + Math.random().toString(36).substr(2, 4),
        timestamp: new Date().toLocaleTimeString(),
        message: msg || 'Unknown runtime error',
        source: `${event.filename || 'app'}:${event.lineno || 0}`,
        stack: event.error?.stack || ''
      };
      setErrors(prev => [newErr, ...prev.slice(0, 20)]);
      setIsOpen(true);
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const msg = reason?.message || String(reason) || '';
      if (msg.toLowerCase().includes('websocket') || msg.toLowerCase().includes('vite')) {
        return; // Filter out benign Vite HMR connection notices
      }

      const newErr: AppErrorLog = {
        id: 'rej_' + Date.now() + Math.random().toString(36).substr(2, 4),
        timestamp: new Date().toLocaleTimeString(),
        message: msg || 'Unhandled Promise Rejection',
        source: 'Promise Rejection',
        stack: reason?.stack || ''
      };
      setErrors(prev => [newErr, ...prev.slice(0, 20)]);
      setIsOpen(true);
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  const clearErrors = () => setErrors([]);

  const copyErrors = () => {
    const text = errors.map(e => `[${e.timestamp}] ${e.message} (${e.source})\n${e.stack}`).join('\n\n');
    navigator.clipboard.writeText(text);
    alert("Error logs copied to clipboard!");
  };

  if (errors.length === 0 && !isOpen) {
    return (
      <div className="fixed bottom-3 right-3 z-[9999]">
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-neutral-900/90 border border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-700 text-[11px] font-mono shadow-xl transition-all backdrop-blur-md"
          title="Open Debugger & Error Catcher"
        >
          <Bug className="w-3.5 h-3.5 text-emerald-400" />
          <span>Debugger (0 errors)</span>
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-3 right-3 z-[9999] w-full max-w-lg bg-neutral-900 border border-neutral-700 rounded-2xl shadow-2xl overflow-hidden text-neutral-100 flex flex-col font-mono text-xs animate-in slide-in-from-bottom-4 duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-neutral-950 border-b border-neutral-800">
        <div className="flex items-center gap-2">
          <Bug className={`w-4 h-4 ${errors.length > 0 ? 'text-rose-400 animate-bounce' : 'text-emerald-400'}`} />
          <span className="font-bold uppercase tracking-wider text-xs">
            OmniStrih Debugger ({errors.length} {errors.length === 1 ? 'error' : 'errors'})
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {errors.length > 0 && (
            <>
              <button
                onClick={copyErrors}
                className="p-1 hover:bg-neutral-800 rounded text-neutral-400 hover:text-white"
                title="Copy Error Logs"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={clearErrors}
                className="p-1 hover:bg-neutral-800 rounded text-neutral-400 hover:text-white"
                title="Clear Errors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
          <button
            onClick={() => setMinimized(!minimized)}
            className="p-1 hover:bg-neutral-800 rounded text-neutral-400 hover:text-white"
          >
            {minimized ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1 hover:bg-neutral-800 rounded text-neutral-400 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Body / Error List */}
      {!minimized && (
        <div className="max-h-60 overflow-y-auto p-3 space-y-2 bg-neutral-900/95 custom-scrollbar text-[11px]">
          {errors.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-neutral-500 gap-1">
              <CheckCircle2 className="w-6 h-6 text-emerald-500" />
              <span>No runtime errors detected. System is running smoothly.</span>
            </div>
          ) : (
            errors.map((err) => (
              <div key={err.id} className="p-2.5 rounded-xl bg-neutral-950 border border-rose-500/30 text-rose-300 space-y-1">
                <div className="flex items-center justify-between font-bold text-rose-400">
                  <div className="flex items-center gap-1.5 truncate">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{err.message}</span>
                  </div>
                  <span className="text-[10px] text-neutral-500 shrink-0">{err.timestamp}</span>
                </div>
                {err.source && <div className="text-[10px] text-neutral-400">Source: {err.source}</div>}
                {err.stack && (
                  <pre className="text-[9px] text-neutral-400 overflow-x-auto whitespace-pre-wrap max-h-24 bg-neutral-900 p-1.5 rounded">
                    {err.stack}
                  </pre>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
