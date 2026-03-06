import { Injectable, computed, signal } from '@angular/core';

export type GroupEntity = {
  id: string;
  nivel: string;
  autor: string;
  nombre: string;
  integrantes: number;
  tickets: number;
  descripcion: string;
  createdAt: number;
};

@Injectable({ providedIn: 'root' })
export class GroupStore {
  private readonly storageKey = 'app.groups.v1';

  readonly groups = signal<GroupEntity[]>(this.load());
  readonly total = computed(() => this.groups().length);

  add(data: Omit<GroupEntity, 'id' | 'createdAt'>): void {
    const next: GroupEntity[] = [
      ...this.groups(),
      {
        id: this.makeId(),
        createdAt: Date.now(),
        ...data,
      },
    ];
    this.groups.set(next);
    this.save(next);
  }

  update(id: string, patch: Partial<Omit<GroupEntity, 'id' | 'createdAt'>>): void {
    const next = this.groups().map((g) => (g.id === id ? { ...g, ...patch } : g));
    this.groups.set(next);
    this.save(next);
  }

  remove(id: string): void {
    const next = this.groups().filter((g) => g.id !== id);
    this.groups.set(next);
    this.save(next);
  }

  private load(): GroupEntity[] {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed)) return parsed as GroupEntity[];
      }
    } catch {
      // ignore
    }

    // Seed simple: coincide con el "Total: 1" inicial.
    const seed: GroupEntity[] = [
      {
        id: 'seed-1',
        createdAt: Date.now(),
        nivel: '1',
        autor: 'xxx',
        nombre: 'Grupo demo',
        integrantes: 1,
        tickets: 0,
        descripcion: 'x',
      },
    ];
    this.save(seed);
    return seed;
  }

  private save(groups: GroupEntity[]): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(groups));
    } catch {
      // ignore
    }
  }

  private makeId(): string {
    const c = globalThis.crypto as Crypto | undefined;
    if (c?.randomUUID) return c.randomUUID();
    return `g_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }
}

