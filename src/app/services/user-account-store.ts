import { Injectable, computed, signal } from '@angular/core';
import { ADMIN_PERMISSIONS } from './auth-accounts';

export type UserAccount = {
  email: string;
  nombre: string;
  password: string;
  permissions: string[];
  createdAt: number;
};

@Injectable({ providedIn: 'root' })
export class UserAccountStore {
  private readonly storageKey = 'app.user-accounts.v1';

  readonly accounts = signal<UserAccount[]>(this.load());
  readonly total = computed(() => this.accounts().length);

  /** Todos los permisos posibles (para los checkboxes). */
  readonly allPermissions: string[] = [...ADMIN_PERMISSIONS];

  getByEmail(email: string): UserAccount | null {
    const e = (email ?? '').toLowerCase().trim();
    return this.accounts().find((a) => a.email.toLowerCase().trim() === e) ?? null;
  }

  /** Registra un usuario si no existe (se usa internamente para compatibilidad). */
  ensureAccount(email: string, nombre: string, password?: string): void {
    if (this.getByEmail(email)) return;
    this.addAccount(email, nombre, password ?? '1234', ['groups_view', 'group_view', 'tickets_view', 'ticket_view']);
  }

  /** Crea un usuario con permisos específicos. */
  addAccount(email: string, nombre: string, password: string, permissions: string[]): void {
    if (this.getByEmail(email)) return;
    const next: UserAccount[] = [
      ...this.accounts(),
      {
        email: email.toLowerCase().trim(),
        nombre,
        password,
        permissions: [...permissions],
        createdAt: Date.now(),
      },
    ];
    this.accounts.set(next);
    this.save(next);
  }

  /** Actualiza nombre y/o contraseña. */
  updateAccount(email: string, patch: { nombre?: string; password?: string }): void {
    const e = (email ?? '').toLowerCase().trim();
    const next = this.accounts().map((a) => {
      if (a.email.toLowerCase().trim() !== e) return a;
      return {
        ...a,
        nombre: patch.nombre !== undefined ? patch.nombre : a.nombre,
        password: patch.password !== undefined ? patch.password : a.password,
      };
    });
    this.accounts.set(next);
    this.save(next);
  }

  /** Verifica contraseña. */
  authenticate(email: string, password: string): UserAccount | null {
    const account = this.getByEmail(email);
    if (!account) return null;
    if (account.password !== password) return null;
    return account;
  }

  /** Actualiza los permisos de un usuario. */
  setPermissions(email: string, permissions: string[]): void {
    const e = (email ?? '').toLowerCase().trim();
    const next = this.accounts().map((a) =>
      a.email.toLowerCase().trim() === e ? { ...a, permissions: [...permissions] } : a
    );
    this.accounts.set(next);
    this.save(next);
  }

  remove(email: string): void {
    const e = (email ?? '').toLowerCase().trim();
    const next = this.accounts().filter((a) => a.email.toLowerCase().trim() !== e);
    this.accounts.set(next);
    this.save(next);
  }

  private load(): UserAccount[] {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as UserAccount[];
    } catch { /* ignore */ }
    return [];
  }

  private save(accounts: UserAccount[]): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(accounts));
    } catch { /* ignore */ }
  }
}
