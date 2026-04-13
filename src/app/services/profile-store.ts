import { Injectable, computed, signal } from '@angular/core';

export type ProfileEntity = {
  usuario: string;
  email: string;
  nombreCompleto: string;
  direccion: string;
  fechaNacimiento: string;
  telefono: string;
  /** Si true, tiene todos los permisos. Si false, solo ver grupos/tickets y unirse a grupos. */
  isAdmin: boolean;
  /** Permisos efectivos tras login API (user_permissions). Si falta, el cliente puede usar fallback demo. */
  permissions?: string[];
  updatedAt: number;
};

@Injectable({ providedIn: 'root' })
export class ProfileStore {
  private readonly storageKey = 'app.profile.v1';

  readonly profile = signal<ProfileEntity | null>(this.load());
  readonly hasProfile = computed(() => this.profile() !== null);

  set(data: Omit<ProfileEntity, 'updatedAt'>): void {
    const next: ProfileEntity = { ...data, updatedAt: Date.now() };
    this.profile.set(next);
    this.save(next);
  }

  update(patch: Partial<Omit<ProfileEntity, 'updatedAt'>>): void {
    const current = this.profile();
    const base: Omit<ProfileEntity, 'updatedAt'> = current ?? {
      usuario: '',
      email: '',
      nombreCompleto: '',
      direccion: '',
      fechaNacimiento: '',
      telefono: '',
      isAdmin: false,
      permissions: undefined,
    };
    this.set({ ...base, ...patch });
  }

  clear(): void {
    this.profile.set(null);
    try {
      localStorage.removeItem(this.storageKey);
    } catch {
      // ignore
    }
  }

  private load(): ProfileEntity | null {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (!parsed || typeof parsed !== 'object') return null;
      const rawPerms = parsed['permissions'];
      const permissionsFromStorage = Array.isArray(rawPerms)
        ? (rawPerms as unknown[]).filter((x): x is string => typeof x === 'string')
        : undefined;
      return {
        usuario: typeof parsed['usuario'] === 'string' ? (parsed['usuario'] as string) : '',
        email: typeof parsed['email'] === 'string' ? (parsed['email'] as string) : '',
        nombreCompleto: typeof parsed['nombreCompleto'] === 'string' ? (parsed['nombreCompleto'] as string) : '',
        direccion: typeof parsed['direccion'] === 'string' ? (parsed['direccion'] as string) : '',
        fechaNacimiento: typeof parsed['fechaNacimiento'] === 'string' ? (parsed['fechaNacimiento'] as string) : '',
        telefono: typeof parsed['telefono'] === 'string' ? (parsed['telefono'] as string) : '',
        isAdmin: parsed['isAdmin'] === true,
        ...(permissionsFromStorage !== undefined ? { permissions: permissionsFromStorage } : {}),
        updatedAt: typeof parsed['updatedAt'] === 'number' ? (parsed['updatedAt'] as number) : Date.now(),
      };
    } catch {
      // ignore
    }
    return null;
  }

  private save(profile: ProfileEntity): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(profile));
    } catch {
      // ignore
    }
  }
}

