import { Injectable, computed, inject, signal } from '@angular/core';
import { GroupStore } from './group-store';
import { ProfileStore } from './profile-store';

export type TicketStatus = 'Pendiente' | 'En progreso' | 'Revisión' | 'Finalizada';
export type TicketPriority = 'Baja' | 'Media' | 'Alta';

export type TicketComment = {
  id: string;
  text: string;
  createdAt: number;
  author: string;
};

export type TicketHistoryEntry = {
  id: string;
  changedAt: number;
  field: string;
  from: string;
  to: string;
  by: string;
};

export type TicketEntity = {
  id: string;
  groupId: string;
  titulo: string;
  descripcion: string;
  estado: TicketStatus;
  asignadoA: string;
  prioridad: TicketPriority;
  createdAt: number;
  fechaLimite: number | null;
  comentarios: TicketComment[];
  historial: TicketHistoryEntry[];
  updatedAt: number;
};

@Injectable({ providedIn: 'root' })
export class TicketStore {
  private readonly storageKey = 'app.tickets.v1';

  private readonly groupStore = inject(GroupStore);
  private readonly profileStore = inject(ProfileStore);

  readonly tickets = signal<TicketEntity[]>(this.load());
  readonly total = computed(() => this.tickets().length);

  readonly countsByStatus = computed(() => {
    const base: Record<TicketStatus, number> = {
      Pendiente: 0,
      'En progreso': 0,
      Revisión: 0,
      Finalizada: 0,
    };
    for (const t of this.tickets()) base[t.estado] = (base[t.estado] ?? 0) + 1;
    return base;
  });

  getById(id: string): TicketEntity | null {
    return this.tickets().find((t) => t.id === id) ?? null;
  }

  listByGroup(groupId: string | null): TicketEntity[] {
    if (!groupId) return this.tickets();
    return this.tickets().filter((t) => t.groupId === groupId);
  }

  add(data: {
    groupId: string;
    titulo: string;
    descripcion: string;
    estado: TicketStatus;
    asignadoA: string;
    prioridad: TicketPriority;
    fechaLimite: number | null;
  }): void {
    const now = Date.now();
    const by = this.actor();
    const ticket: TicketEntity = {
      id: this.makeId(),
      groupId: String(data.groupId ?? ''),
      titulo: String(data.titulo ?? ''),
      descripcion: String(data.descripcion ?? ''),
      estado: data.estado,
      asignadoA: String(data.asignadoA ?? ''),
      prioridad: data.prioridad,
      createdAt: now,
      fechaLimite: data.fechaLimite ?? null,
      comentarios: [],
      historial: [
        {
          id: this.makeId(),
          changedAt: now,
          field: 'ticket',
          from: '',
          to: 'creado',
          by,
        },
      ],
      updatedAt: now,
    };

    const next = [...this.tickets(), ticket];
    this.tickets.set(next);
    this.save(next);
    this.syncGroupTicketCount(ticket.groupId);
  }

  update(
    id: string,
    patch: Partial<
      Pick<TicketEntity, 'groupId' | 'titulo' | 'descripcion' | 'estado' | 'asignadoA' | 'prioridad' | 'fechaLimite'>
    >
  ): void {
    const current = this.getById(id);
    if (!current) return;

    const by = this.actor();
    const now = Date.now();
    const updated: TicketEntity = {
      ...current,
      ...patch,
      groupId: patch.groupId !== undefined ? String(patch.groupId ?? '') : current.groupId,
      titulo: patch.titulo !== undefined ? String(patch.titulo ?? '') : current.titulo,
      descripcion: patch.descripcion !== undefined ? String(patch.descripcion ?? '') : current.descripcion,
      asignadoA: patch.asignadoA !== undefined ? String(patch.asignadoA ?? '') : current.asignadoA,
      fechaLimite: patch.fechaLimite !== undefined ? (patch.fechaLimite ?? null) : current.fechaLimite,
      updatedAt: now,
    };

    const changes: TicketHistoryEntry[] = [];
    this.pushChange(changes, 'groupId', current.groupId, updated.groupId, by, now);
    this.pushChange(changes, 'titulo', current.titulo, updated.titulo, by, now);
    this.pushChange(changes, 'descripcion', current.descripcion, updated.descripcion, by, now);
    this.pushChange(changes, 'estado', current.estado, updated.estado, by, now);
    this.pushChange(changes, 'asignadoA', current.asignadoA, updated.asignadoA, by, now);
    this.pushChange(changes, 'prioridad', current.prioridad, updated.prioridad, by, now);
    this.pushChange(
      changes,
      'fechaLimite',
      current.fechaLimite ? new Date(current.fechaLimite).toISOString() : '',
      updated.fechaLimite ? new Date(updated.fechaLimite).toISOString() : '',
      by,
      now
    );

    if (changes.length) {
      updated.historial = [...updated.historial, ...changes];
    }

    const next = this.tickets().map((t) => (t.id === id ? updated : t));
    this.tickets.set(next);
    this.save(next);

    if (current.groupId !== updated.groupId) {
      this.syncGroupTicketCount(current.groupId);
      this.syncGroupTicketCount(updated.groupId);
    } else {
      this.syncGroupTicketCount(updated.groupId);
    }
  }

  remove(id: string): void {
    const current = this.getById(id);
    const next = this.tickets().filter((t) => t.id !== id);
    this.tickets.set(next);
    this.save(next);
    if (current) this.syncGroupTicketCount(current.groupId);
  }

  addComment(ticketId: string, text: string): void {
    const current = this.getById(ticketId);
    if (!current) return;
    const value = (text ?? '').trim();
    if (!value) return;

    const now = Date.now();
    const by = this.actor();
    const comment: TicketComment = {
      id: this.makeId(),
      createdAt: now,
      text: value,
      author: by,
    };

    const updated: TicketEntity = {
      ...current,
      comentarios: [...current.comentarios, comment],
      historial: [
        ...current.historial,
        {
          id: this.makeId(),
          changedAt: now,
          field: 'comentario',
          from: '',
          to: value.slice(0, 120),
          by,
        },
      ],
      updatedAt: now,
    };

    const next = this.tickets().map((t) => (t.id === ticketId ? updated : t));
    this.tickets.set(next);
    this.save(next);
  }

  private actor(): string {
    const p = this.profileStore.profile();
    const user = (p?.usuario ?? '').trim();
    if (user) return user;
    const email = (p?.email ?? '').trim();
    if (email) return email;
    return 'anon';
  }

  private pushChange(
    acc: TicketHistoryEntry[],
    field: string,
    from: unknown,
    to: unknown,
    by: string,
    changedAt: number
  ): void {
    const a = String(from ?? '');
    const b = String(to ?? '');
    if (a === b) return;
    acc.push({
      id: this.makeId(),
      changedAt,
      field,
      from: a,
      to: b,
      by,
    });
  }

  private load(): TicketEntity[] {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) return (parsed as any[]).map((t) => this.normalize(t));
    } catch {
      // ignore
    }
    return [];
  }

  private normalize(raw: any): TicketEntity {
    const now = Date.now();
    const estado: TicketStatus = this.isStatus(raw?.estado) ? raw.estado : 'Pendiente';
    const prioridad: TicketPriority = this.isPriority(raw?.prioridad) ? raw.prioridad : 'Media';
    const comentarios: TicketComment[] = Array.isArray(raw?.comentarios)
      ? raw.comentarios
          .filter((c: any) => c && typeof c === 'object')
          .map((c: any) => ({
            id: typeof c.id === 'string' ? c.id : this.makeId(),
            text: typeof c.text === 'string' ? c.text : '',
            createdAt: typeof c.createdAt === 'number' ? c.createdAt : now,
            author: typeof c.author === 'string' ? c.author : 'anon',
          }))
      : [];
    const historial: TicketHistoryEntry[] = Array.isArray(raw?.historial)
      ? raw.historial
          .filter((h: any) => h && typeof h === 'object')
          .map((h: any) => ({
            id: typeof h.id === 'string' ? h.id : this.makeId(),
            field: typeof h.field === 'string' ? h.field : 'ticket',
            from: typeof h.from === 'string' ? h.from : '',
            to: typeof h.to === 'string' ? h.to : '',
            by: typeof h.by === 'string' ? h.by : 'anon',
            changedAt: typeof h.changedAt === 'number' ? h.changedAt : now,
          }))
      : [];

    return {
      id: typeof raw?.id === 'string' ? raw.id : this.makeId(),
      groupId: typeof raw?.groupId === 'string' ? raw.groupId : '',
      titulo: typeof raw?.titulo === 'string' ? raw.titulo : '',
      descripcion: typeof raw?.descripcion === 'string' ? raw.descripcion : '',
      estado,
      asignadoA: typeof raw?.asignadoA === 'string' ? raw.asignadoA : '',
      prioridad,
      createdAt: typeof raw?.createdAt === 'number' ? raw.createdAt : now,
      fechaLimite: typeof raw?.fechaLimite === 'number' ? raw.fechaLimite : null,
      comentarios,
      historial,
      updatedAt: typeof raw?.updatedAt === 'number' ? raw.updatedAt : now,
    };
  }

  private save(tickets: TicketEntity[]): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(tickets));
    } catch {
      // ignore
    }
  }

  private syncGroupTicketCount(groupId: string): void {
    if (!groupId) return;
    const count = this.tickets().filter((t) => t.groupId === groupId).length;
    this.groupStore.update(groupId, { tickets: count });
  }

  private isStatus(value: any): value is TicketStatus {
    return value === 'Pendiente' || value === 'En progreso' || value === 'Revisión' || value === 'Finalizada';
  }

  private isPriority(value: any): value is TicketPriority {
    return value === 'Baja' || value === 'Media' || value === 'Alta';
  }

  private makeId(): string {
    const c = globalThis.crypto as Crypto | undefined;
    if (c?.randomUUID) return c.randomUUID();
    return `t_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }
}

