import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, map, of, switchMap, throwError } from 'rxjs';
import { API_BASE_URL } from './api-config';
import { AuthSession } from './auth-session';

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

type ApiEnvelope<T> = {
  statusCode: number;
  intOpCode: number;
  data: T[];
};

/** Clave antigua del modo demo; ya no se usa — se borra al refrescar con API. */
const LEGACY_STORAGE_KEY = 'app.groups.v1';

@Injectable({ providedIn: 'root' })
export class GroupStore {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthSession);

  readonly groups = signal<GroupEntity[]>([]);
  readonly total = computed(() => this.groups().length);

  private authHeaders(): HttpHeaders | null {
    const t = this.auth.accessToken();
    if (!t) return null;
    return new HttpHeaders({
      Authorization: `Bearer ${t}`,
      'Content-Type': 'application/json',
    });
  }

  private groupsUrl(): string {
    return `${API_BASE_URL}/api/groups`;
  }

  private clearLegacyLocalStorage(): void {
    try {
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch {
      // ignore
    }
  }

  /** Solo datos del microservicio (Supabase vía group-service). Sin token: lista vacía. */
  refresh(): Observable<void> {
    const h = this.authHeaders();
    if (!h) {
      this.groups.set([]);
      return of(void 0);
    }
    return this.http.get<ApiEnvelope<Record<string, unknown>>>(this.groupsUrl(), { headers: h }).pipe(
      map((body) => (body.data ?? []).map((row) => this.mapApiRow(row))),
      map((list) => {
        this.clearLegacyLocalStorage();
        // Evita NG0100 con p-table al actualizar la lista en el mismo ciclo que el diálogo.
        setTimeout(() => this.groups.set(list), 0);
        return void 0;
      }),
      catchError(() => {
        setTimeout(() => this.groups.set([]), 0);
        return of(void 0);
      }),
    );
  }

  groupIdsWhereMember(email: string): string[] {
    const e = (email ?? '').toLowerCase().trim();
    if (!e) return [];
    return this.groups()
      .filter((g) => (g.miembros ?? []).some((m) => m.toLowerCase().trim() === e))
      .map((g) => g.id);
  }

  /** Emails/handles de miembros del grupo (para asignar tickets). */
  membersOf(groupId: string): string[] {
    if (!groupId) return [];
    const g = this.groups().find((x) => x.id === groupId);
    return (g?.miembros ?? [])
      .filter((m) => typeof m === 'string' && m.trim().length > 0)
      .map((m) => m.trim());
  }

  add(data: Omit<GroupEntity, 'id' | 'createdAt' | 'integrantes'> & { integrantes?: number }): Observable<void> {
    const h = this.authHeaders();
    if (!h) return throwError(() => new Error('Inicia sesión con cuenta Supabase para gestionar grupos.'));
    const miembros = Array.isArray(data.miembros) ? data.miembros : [];
    const body = {
      nivel: String(data.nivel ?? ''),
      autor: String(data.autor ?? ''),
      nombre: String(data.nombre ?? ''),
      descripcion: String(data.descripcion ?? ''),
      miembros,
    };
    return this.http.post<ApiEnvelope<Record<string, unknown>>>(this.groupsUrl(), body, { headers: h }).pipe(
      switchMap(() => this.refresh()),
      catchError((err) => throwError(() => this.toError(err))),
    );
  }

  update(id: string, patch: Partial<Omit<GroupEntity, 'id' | 'createdAt'>>): Observable<void> {
    const h = this.authHeaders();
    if (!h) return throwError(() => new Error('Inicia sesión con cuenta Supabase para gestionar grupos.'));
    const body: Record<string, unknown> = {};
    if (patch.nivel !== undefined) body['nivel'] = patch.nivel;
    if (patch.autor !== undefined) body['autor'] = patch.autor;
    if (patch.nombre !== undefined) body['nombre'] = patch.nombre;
    if (patch.descripcion !== undefined) body['descripcion'] = patch.descripcion;
    if (patch.miembros !== undefined) body['miembros'] = patch.miembros;
    return this.http
      .patch<ApiEnvelope<Record<string, unknown>>>(`${this.groupsUrl()}/${id}`, body, { headers: h })
      .pipe(
        switchMap(() => this.refresh()),
        catchError((err) => throwError(() => this.toError(err))),
      );
  }

  remove(id: string): Observable<void> {
    const h = this.authHeaders();
    if (!h) return throwError(() => new Error('Inicia sesión con cuenta Supabase para gestionar grupos.'));
    return this.http.delete<ApiEnvelope<unknown>>(`${this.groupsUrl()}/${id}`, { headers: h }).pipe(
      switchMap(() => this.refresh()),
      catchError((err) => throwError(() => this.toError(err))),
    );
  }

  addMember(groupId: string, handle: string): Observable<void> {
    const value = (handle ?? '').trim();
    if (!value) return of(void 0);
    const h = this.authHeaders();
    if (!h) return throwError(() => new Error('Inicia sesión con cuenta Supabase para gestionar grupos.'));
    return this.http
      .post<ApiEnvelope<Record<string, unknown>>>(
        `${this.groupsUrl()}/${groupId}/members`,
        { handle: value },
        { headers: h },
      )
      .pipe(
        switchMap(() => this.refresh()),
        catchError((err) => throwError(() => this.toError(err))),
      );
  }

  removeMember(groupId: string, handle: string): Observable<void> {
    const value = (handle ?? '').trim();
    if (!value) return of(void 0);
    const h = this.authHeaders();
    if (!h) return throwError(() => new Error('Inicia sesión con cuenta Supabase para gestionar grupos.'));
    return this.http
      .request<ApiEnvelope<Record<string, unknown>>>('DELETE', `${this.groupsUrl()}/${groupId}/members`, {
        body: { handle: value },
        headers: h,
      })
      .pipe(
        switchMap(() => this.refresh()),
        catchError((err) => throwError(() => this.toError(err))),
      );
  }

  private mapApiRow(raw: Record<string, unknown>): GroupEntity {
    const { message: _m, ...rest } = raw as Record<string, unknown> & { message?: string };
    return this.normalize(rest);
  }

  private normalize(raw: Record<string, unknown>): GroupEntity {
    const id = typeof raw['id'] === 'string' ? raw['id'] : this.makeId();
    const createdAt = typeof raw['createdAt'] === 'number' ? raw['createdAt'] : Date.now();
    const nivel = typeof raw['nivel'] === 'string' ? raw['nivel'] : '';
    const autor = typeof raw['autor'] === 'string' ? raw['autor'] : '';
    const nombre = typeof raw['nombre'] === 'string' ? raw['nombre'] : '';
    const descripcion = typeof raw['descripcion'] === 'string' ? raw['descripcion'] : '';
    const tickets = typeof raw['tickets'] === 'number' ? raw['tickets'] : 0;
    const integrantesNum =
      typeof raw['integrantes'] === 'number' ? raw['integrantes'] : Array.isArray(raw['miembros']) ? raw['miembros'].length : 0;

    let miembros: string[] = [];
    if (Array.isArray(raw['miembros'])) {
      miembros = (raw['miembros'] as unknown[])
        .filter((m) => typeof m === 'string' && (m as string).trim().length > 0)
        .map((m) => (m as string).trim());
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
      integrantes: miembros.length || integrantesNum,
    };
  }

  private makeId(): string {
    const c = globalThis.crypto as Crypto | undefined;
    if (c?.randomUUID) return c.randomUUID();
    return `g_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  private toError(err: unknown): Error {
    const wrapped = (err as { error?: unknown })?.error;
    const body =
      wrapped && typeof wrapped === 'object' && wrapped !== null && 'data' in wrapped
        ? (wrapped as ApiEnvelope<{ message?: string }>)
        : null;
    const msg = body?.data?.[0]?.message;
    if (typeof msg === 'string' && msg.trim()) return new Error(msg);
    return new Error('Error al comunicarse con el servidor de grupos');
  }
}
