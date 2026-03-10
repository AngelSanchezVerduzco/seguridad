import { Injectable, computed, signal } from '@angular/core';

export type GroupEntity = {
  id: string;
  nivel: string;
  autor: string;
  nombre: string;
  integrantes: number;
  tickets: number;
  descripcion: string;
  miembros: string[];
  createdAt: number;
};

@Injectable({ providedIn: 'root' })
export class GroupStore {
  private readonly storageKey = 'app.groups.v1';

  readonly groups = signal<GroupEntity[]>(this.load());
  readonly total = computed(() => this.groups().length);

  add(data: Omit<GroupEntity, 'id' | 'createdAt' | 'integrantes'> & { integrantes?: number }): void {
    const miembros = Array.isArray(data.miembros) ? data.miembros : [];
    const next: GroupEntity[] = [
      ...this.groups(),
      {
        id: this.makeId(),
        createdAt: Date.now(),
        ...data,
        miembros,
        integrantes: miembros.length,
      },
    ];
    this.groups.set(next);
    this.save(next);
  }

  update(id: string, patch: Partial<Omit<GroupEntity, 'id' | 'createdAt'>>): void {
    const next = this.groups().map((g) => {
      if (g.id !== id) return g;
      const merged = { ...g, ...patch } as GroupEntity;
      const miembros = Array.isArray(merged.miembros) ? merged.miembros : [];
      return { ...merged, miembros, integrantes: miembros.length };
    });
    this.groups.set(next);
    this.save(next);
  }

  remove(id: string): void {
    const next = this.groups().filter((g) => g.id !== id);
    this.groups.set(next);
    this.save(next);
  }

  addMember(groupId: string, handle: string): void {
    const value = (handle ?? '').trim();
    if (!value) return;
    const next = this.groups().map((g) => {
      if (g.id !== groupId) return g;
      if (g.miembros.includes(value)) return g;
      const miembros = [...g.miembros, value];
      return { ...g, miembros, integrantes: miembros.length };
    });
    this.groups.set(next);
    this.save(next);
  }

  removeMember(groupId: string, handle: string): void {
    const value = (handle ?? '').trim();
    if (!value) return;
    const next = this.groups().map((g) => {
      if (g.id !== groupId) return g;
      const miembros = g.miembros.filter((m) => m !== value);
      return { ...g, miembros, integrantes: miembros.length };
    });
    this.groups.set(next);
    this.save(next);
  }

  private load(): GroupEntity[] {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed)) {
          return (parsed as any[]).map((g) => this.normalize(g));
        }
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
        tickets: 0,
        descripcion: 'x',
        miembros: ['demo@grupo.local'],
        integrantes: 1,
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

  private normalize(raw: any): GroupEntity {
    const id = typeof raw?.id === 'string' ? raw.id : this.makeId();
    const createdAt = typeof raw?.createdAt === 'number' ? raw.createdAt : Date.now();
    const nivel = typeof raw?.nivel === 'string' ? raw.nivel : '';
    const autor = typeof raw?.autor === 'string' ? raw.autor : '';
    const nombre = typeof raw?.nombre === 'string' ? raw.nombre : '';
    const descripcion = typeof raw?.descripcion === 'string' ? raw.descripcion : '';
    const tickets = typeof raw?.tickets === 'number' ? raw.tickets : 0;

    let miembros: string[] = [];
    if (Array.isArray(raw?.miembros)) {
      miembros = raw.miembros.filter((m: any) => typeof m === 'string' && m.trim().length > 0).map((m: string) => m.trim());
    } else if (typeof raw?.integrantes === 'number' && raw.integrantes > 0) {
      miembros = Array.from({ length: Math.min(10, Math.floor(raw.integrantes)) }, (_, i) => `user${i + 1}@grupo.local`);
    }

    return {
      id,
      createdAt,
      nivel,
      autor,
      nombre,
      descripcion,
      tickets,
      miembros,
      integrantes: miembros.length,
    };
  }

  private makeId(): string {
    const c = globalThis.crypto as Crypto | undefined;
    if (c?.randomUUID) return c.randomUUID();
    return `g_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }
}

