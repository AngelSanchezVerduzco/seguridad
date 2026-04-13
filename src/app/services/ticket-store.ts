import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, map, of, switchMap, tap, throwError } from 'rxjs';
import { API_BASE_URL } from './api-config';
import { AuthSession } from './auth-session';
import { GroupStore } from './group-store';

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

type ApiEnvelope<T> = {
  statusCode: number;
  intOpCode: number;
  data: T[];
};

const LEGACY_STORAGE_KEY = 'app.tickets.v1';

@Injectable({ providedIn: 'root' })
export class TicketStore {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthSession);
  private readonly groupStore = inject(GroupStore);

  readonly tickets = signal<TicketEntity[]>([]);
  readonly listError = signal<string | null>(null);
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

  private ticketsUrl(): string {
    return `${API_BASE_URL}/api/tickets`;
  }

  private authHeaders(): HttpHeaders | null {
    const t = this.auth.accessToken();
    if (!t) return null;
    return new HttpHeaders({
      Authorization: `Bearer ${t}`,
      'Content-Type': 'application/json',
    });
  }

  private clearLegacyLocalStorage(): void {
    try {
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch {
      // ignore
    }
  }

  private bumpTickets(list: TicketEntity[]): void {
    setTimeout(() => this.tickets.set(list), 0);
  }

  /** Listado según permisos en ticket-service (grupos del actor). */
  refresh(): Observable<void> {
    const h = this.authHeaders();
    if (!h) {
      this.tickets.set([]);
      return of(void 0);
    }
    return this.http.get<ApiEnvelope<Record<string, unknown>>>(this.ticketsUrl(), { headers: h }).pipe(
      tap(() => this.listError.set(null)),
      map((body) => (body.data ?? []).map((row) => this.mapApiTicket(row))),
      map((list) => {
        this.clearLegacyLocalStorage();
        this.bumpTickets(list);
        return void 0;
      }),
      catchError((err) => {
        this.listError.set(this.toError(err).message);
        this.bumpTickets([]);
        return of(void 0);
      }),
    );
  }

  /** Carga un ticket por id (p. ej. enlace directo) y lo mezcla en la lista. */
  ensureLoaded(id: string): Observable<void> {
    const trimmed = (id ?? '').trim();
    if (!trimmed || this.getById(trimmed)) return of(void 0);
    const h = this.authHeaders();
    if (!h) return of(void 0);
    return this.http.get<ApiEnvelope<Record<string, unknown>>>(`${this.ticketsUrl()}/${trimmed}`, { headers: h }).pipe(
      map((body) => {
        const row = (body.data ?? [])[0] as Record<string, unknown> | undefined;
        if (!row) return void 0;
        const t = this.mapApiTicket(row);
        setTimeout(() => this.upsertTicket(t), 0);
        return void 0;
      }),
      catchError(() => of(void 0)),
    );
  }

  private upsertTicket(t: TicketEntity): void {
    this.tickets.update((list) => {
      const i = list.findIndex((x) => x.id === t.id);
      if (i >= 0) {
        const next = [...list];
        next[i] = t;
        return next;
      }
      return [t, ...list];
    });
  }

  getById(id: string): TicketEntity | null {
    return this.tickets().find((t) => t.id === id) ?? null;
  }

  listByGroup(groupId: string | null): TicketEntity[] {
    if (!groupId) return this.tickets();
    return this.tickets().filter((t) => t.groupId === groupId);
  }

  listByGroups(groupIds: string[] | null): TicketEntity[] {
    if (groupIds === null) return this.tickets();
    if (groupIds.length === 0) return [];
    const set = new Set(groupIds);
    return this.tickets().filter((t) => set.has(t.groupId));
  }

  add(data: {
    groupId: string;
    titulo: string;
    descripcion: string;
    estado: TicketStatus;
    asignadoA: string;
    prioridad: TicketPriority;
    fechaLimite: number | null;
  }): Observable<void> {
    const h = this.authHeaders();
    if (!h) return throwError(() => new Error('Inicia sesión para gestionar tickets.'));
    const body: Record<string, unknown> = {
      groupId: String(data.groupId ?? ''),
      titulo: String(data.titulo ?? ''),
      descripcion: String(data.descripcion ?? ''),
      estado: data.estado,
      asignadoA: String(data.asignadoA ?? ''),
      prioridad: data.prioridad,
      fechaLimite: data.fechaLimite,
    };
    return this.http.post<ApiEnvelope<unknown>>(this.ticketsUrl(), body, { headers: h }).pipe(
      switchMap(() => {
        this.groupStore.refresh().subscribe();
        return this.refresh();
      }),
      catchError((err) => throwError(() => this.toError(err))),
    );
  }

  update(
    id: string,
    patch: Partial<
      Pick<TicketEntity, 'groupId' | 'titulo' | 'descripcion' | 'estado' | 'asignadoA' | 'prioridad' | 'fechaLimite'>
    >,
  ): Observable<void> {
    const h = this.authHeaders();
    if (!h) return throwError(() => new Error('Inicia sesión para gestionar tickets.'));
    const body: Record<string, unknown> = {};
    if (patch.groupId !== undefined) body['groupId'] = patch.groupId;
    if (patch.titulo !== undefined) body['titulo'] = patch.titulo;
    if (patch.descripcion !== undefined) body['descripcion'] = patch.descripcion;
    if (patch.estado !== undefined) body['estado'] = patch.estado;
    if (patch.asignadoA !== undefined) body['asignadoA'] = patch.asignadoA;
    if (patch.prioridad !== undefined) body['prioridad'] = patch.prioridad;
    if (patch.fechaLimite !== undefined) body['fechaLimite'] = patch.fechaLimite;
    return this.http.patch<ApiEnvelope<unknown>>(`${this.ticketsUrl()}/${id}`, body, { headers: h }).pipe(
      switchMap(() => {
        this.groupStore.refresh().subscribe();
        return this.refresh();
      }),
      catchError((err) => throwError(() => this.toError(err))),
    );
  }

  remove(id: string): Observable<void> {
    const h = this.authHeaders();
    if (!h) return throwError(() => new Error('Inicia sesión para gestionar tickets.'));
    return this.http.delete<ApiEnvelope<unknown>>(`${this.ticketsUrl()}/${id}`, { headers: h }).pipe(
      switchMap(() => {
        this.groupStore.refresh().subscribe();
        return this.refresh();
      }),
      catchError((err) => throwError(() => this.toError(err))),
    );
  }

  addComment(ticketId: string, text: string): Observable<void> {
    const value = (text ?? '').trim();
    if (!value) return of(void 0);
    const h = this.authHeaders();
    if (!h) return throwError(() => new Error('Inicia sesión para comentar.'));
    return this.http
      .post<ApiEnvelope<unknown>>(`${this.ticketsUrl()}/${ticketId}/comments`, { text: value }, { headers: h })
      .pipe(
        switchMap(() => this.refresh()),
        catchError((err) => throwError(() => this.toError(err))),
      );
  }

  private mapApiTicket(raw: Record<string, unknown>): TicketEntity {
    const { message: _m, ...rest } = raw as Record<string, unknown> & { message?: string };
    return this.normalizeEntity(rest);
  }

  private normalizeEntity(raw: Record<string, unknown>): TicketEntity {
    const now = Date.now();
    const estado: TicketStatus = this.isStatus(raw['estado']) ? raw['estado'] : 'Pendiente';
    const prioridad: TicketPriority = this.isPriority(raw['prioridad']) ? raw['prioridad'] : 'Media';
    const comentarios: TicketComment[] = Array.isArray(raw['comentarios'])
      ? (raw['comentarios'] as unknown[])
          .filter((c) => c && typeof c === 'object')
          .map((c) => {
            const o = c as Record<string, unknown>;
            return {
              id: typeof o['id'] === 'string' ? o['id'] : this.makeId(),
              text: typeof o['text'] === 'string' ? o['text'] : '',
              createdAt: typeof o['createdAt'] === 'number' ? o['createdAt'] : now,
              author: typeof o['author'] === 'string' ? o['author'] : 'anon',
            };
          })
      : [];
    const historial: TicketHistoryEntry[] = Array.isArray(raw['historial'])
      ? (raw['historial'] as unknown[])
          .filter((h) => h && typeof h === 'object')
          .map((h) => this.normalizeHistoryEntry(h as Record<string, unknown>, now))
      : [];

    return {
      id: typeof raw['id'] === 'string' ? raw['id'] : this.makeId(),
      groupId: typeof raw['groupId'] === 'string' ? raw['groupId'] : '',
      titulo: typeof raw['titulo'] === 'string' ? raw['titulo'] : '',
      descripcion: typeof raw['descripcion'] === 'string' ? raw['descripcion'] : '',
      estado,
      asignadoA: typeof raw['asignadoA'] === 'string' ? raw['asignadoA'] : '',
      prioridad,
      createdAt: typeof raw['createdAt'] === 'number' ? raw['createdAt'] : now,
      fechaLimite: raw['fechaLimite'] === null ? null : typeof raw['fechaLimite'] === 'number' ? raw['fechaLimite'] : null,
      comentarios,
      historial,
      updatedAt: typeof raw['updatedAt'] === 'number' ? raw['updatedAt'] : now,
    };
  }

  private normalizeHistoryEntry(o: Record<string, unknown>, now: number): TicketHistoryEntry {
    const ca = o['changedAt'] ?? o['changed_at'];
    let changedAt = now;
    if (typeof ca === 'number' && Number.isFinite(ca)) changedAt = ca;
    else if (typeof ca === 'string') {
      const t = new Date(ca).getTime();
      if (Number.isFinite(t)) changedAt = t;
    }
    const field =
      typeof o['field'] === 'string'
        ? o['field']
        : typeof o['campo'] === 'string'
          ? o['campo']
          : 'ticket';
    const from =
      typeof o['from'] === 'string'
        ? o['from']
        : typeof o['from_value'] === 'string'
          ? o['from_value']
          : '';
    const to =
      typeof o['to'] === 'string'
        ? o['to']
        : typeof o['to_value'] === 'string'
          ? o['to_value']
          : '';
    const by =
      typeof o['by'] === 'string'
        ? o['by']
        : typeof o['by_text'] === 'string'
          ? o['by_text']
          : typeof o['changed_by'] === 'string'
            ? o['changed_by']
            : typeof o['by_user_id'] === 'string'
              ? o['by_user_id']
              : 'anon';
    return {
      id: typeof o['id'] === 'string' ? o['id'] : this.makeId(),
      field,
      from,
      to,
      by,
      changedAt,
    };
  }

  private isStatus(value: unknown): value is TicketStatus {
    return value === 'Pendiente' || value === 'En progreso' || value === 'Revisión' || value === 'Finalizada';
  }

  private isPriority(value: unknown): value is TicketPriority {
    return value === 'Baja' || value === 'Media' || value === 'Alta';
  }

  private makeId(): string {
    const c = globalThis.crypto as Crypto | undefined;
    if (c?.randomUUID) return c.randomUUID();
    return `t_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  private toError(err: unknown): Error {
    const wrapped = (err as { error?: unknown })?.error;
    const body =
      wrapped && typeof wrapped === 'object' && wrapped !== null && 'data' in wrapped
        ? (wrapped as ApiEnvelope<{ message?: string }>)
        : null;
    const msg = body?.data?.[0]?.message;
    if (typeof msg === 'string' && msg.trim()) return new Error(msg);
    return new Error('Error al comunicarse con el servidor de tickets');
  }
}
