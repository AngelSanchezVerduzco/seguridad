import { Injectable, computed, signal } from '@angular/core';

export type ProfileEntity = {
  usuario: string;
  email: string;
  nombreCompleto: string;
  direccion: string;
  fechaNacimiento: string;
  telefono: string;
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
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === 'object') return parsed as ProfileEntity;
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

