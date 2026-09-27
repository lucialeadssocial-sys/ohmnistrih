// src/utils/historyManager.ts
import { Command, Suggestion } from "../types";

class HistoryManagerClass {
  private history: Command[] = [];
  private undoStack: Command[] = [];
  private suggestions: Suggestion[] = [];
  private suggestionListeners: ((suggestions: Suggestion[]) => void)[] = [];

  public execute(command: Command) {
    command.execute();
    this.history.push(command);
    this.undoStack = []; // Clear redo stack on new action
  }

  public undo() {
    const command = this.history.pop();
    if (command) {
      command.undo();
      this.undoStack.push(command);
    }
  }

  public redo() {
    const command = this.undoStack.pop();
    if (command) {
      command.execute();
      this.history.push(command);
    }
  }

  public addSuggestion(suggestion: Suggestion) {
    this.suggestions.push(suggestion);
    this.notifySuggestions();
  }

  public getSuggestions() {
    return [...this.suggestions];
  }

  public subscribeSuggestions(listener: (suggestions: Suggestion[]) => void): () => void {
    this.suggestionListeners.push(listener);
    listener([...this.suggestions]);
    return () => {
      this.suggestionListeners = this.suggestionListeners.filter((l) => l !== listener);
    };
  }

  private notifySuggestions() {
    const copy = [...this.suggestions];
    this.suggestionListeners.forEach((l) => {
      try {
        l(copy);
      } catch (err) {
        console.error("Suggestion listener error:", err);
      }
    });
  }
}

export const HistoryManager = new HistoryManagerClass();
