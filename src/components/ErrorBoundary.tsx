import React from "react";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** Shown to the user so they know which part of the studio failed. */
  label?: string;
  language?: "sk" | "en";
  /** Called on reset so the parent can also clear its own state. */
  onReset?: () => void;
}

interface ErrorBoundaryState {
  error: Error | null;
  errorInfo: string | null;
}

/**
 * Runtime boundary for React subtrees.
 *
 * The app had no error boundary at all: any exception thrown while rendering a lazy
 * studio (or any child) unmounted the whole React tree and left the user staring at a
 * black page. This boundary keeps the rest of the studio alive and shows what failed.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Keep the detail in the console for debugging without hiding it from the user.
    console.error(`[ErrorBoundary${this.props.label ? `: ${this.props.label}` : ""}]`, error, info?.componentStack);
    this.setState({ errorInfo: info?.componentStack || null });
  }

  private handleReset = () => {
    this.setState({ error: null, errorInfo: null });
    this.props.onReset?.();
  };

  render() {
    const { error, errorInfo } = this.state;
    if (!error) return this.props.children;

    const isSk = (this.props.language ?? "sk") === "sk";

    return (
      <div className="m-3 rounded-2xl border border-rose-500/40 bg-neutral-900 p-5 text-neutral-100 space-y-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-500/10 text-rose-400">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-rose-300">
              {isSk ? "Táto časť aplikácie spadla" : "This part of the app crashed"}
            </h3>
            <p className="text-xs text-neutral-400">
              {this.props.label
                ? (isSk ? `Modul: ${this.props.label}` : `Module: ${this.props.label}`)
                : (isSk ? "Neznámy modul" : "Unknown module")}
            </p>
          </div>
        </div>

        <p className="text-xs text-neutral-300 font-mono break-words">{error.message}</p>

        <p className="text-[11px] text-neutral-500">
          {isSk
            ? "Zvyšok štúdia funguje ďalej. Projekt nebol zmenený."
            : "The rest of the studio keeps running. Your project was not modified."}
        </p>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={this.handleReset}
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-xs font-semibold text-neutral-200 hover:bg-neutral-700"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {isSk ? "Skúsiť znova" : "Try again"}
          </button>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-xs font-semibold text-neutral-200 hover:bg-neutral-700"
          >
            <Home className="h-3.5 w-3.5" />
            {isSk ? "Obnoviť aplikáciu" : "Reload app"}
          </button>
        </div>

        {errorInfo && (
          <details className="text-[11px] text-neutral-500">
            <summary className="cursor-pointer">{isSk ? "Technické detaily" : "Technical details"}</summary>
            <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap">{errorInfo}</pre>
          </details>
        )}
      </div>
    );
  }
}
