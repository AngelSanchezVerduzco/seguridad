import { Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'app.auth.accessToken.v1';

@Injectable({ providedIn: 'root' })
export class AuthSession {
  readonly accessToken = signal<string | null>(this.read());

  setAccessToken(token: string): void {
    const t = token.trim();
    this.accessToken.set(t);
    try {
      localStorage.setItem(STORAGE_KEY, t);
    } catch {
      // ignore
    }
  }

  clear(): void {
    this.accessToken.set(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }

  private read(): string | null {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      return v?.trim() ? v.trim() : null;
    } catch {
      return null;
    }
  }
}
