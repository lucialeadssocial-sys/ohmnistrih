// src/utils/authManager.ts
import { AIProvider } from "../types";

class AuthManagerClass {
  private userKey: string | null = null;
  private devKey: string | null = process.env.GEMINI_API_KEY || null;

  public setKey(key: string) {
    this.userKey = key;
  }

  public getKey(provider: AIProvider): string | null {
    // V production móde preferujeme userKey, v dev móde fallbackujeme na devKey
    return this.userKey || this.devKey;
  }

  public hasValidKey(): boolean {
    return !!(this.userKey || this.devKey);
  }
}

export const AuthManager = new AuthManagerClass();
