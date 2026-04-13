import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, map, of, switchMap, tap, throwError } from 'rxjs';
import { API_BASE_URL } from './api-config';
import { AuthSession } from './auth-session';

export type AdminUser = {
  id: string;
  email: string;
  nombre: string;
  isAdmin: boolean;
  permissions: string[];
  createdAt: number;
};

type ApiEnvelope<T> = {
  statusCode: number;
  intOpCode: number;
  data: T[];
};

const LEGACY_LOCAL_KEY = 'app.user-accounts.v1';

@Injectable({ providedIn: 'root' })
export class AdminUsersStore {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthSession);

  readonly users = signal<AdminUser[]>([]);
  readonly total = computed(() => this.users().length);
  readonly listError = signal<string | null>(null);

  private authHeaders(): HttpHeaders | null {
    const t = this.auth.accessToken();
    if (!t) return null;
    return new HttpHeaders({
      Authorization: `Bearer ${t}`,
      'Content-Type': 'application/json',
    });
  }

  private baseUrl(): string {
    return `${API_BASE_URL}/api/users`;
  }

  private clearLegacyLocalStorage(): void {
    try {
      localStorage.removeItem(LEGACY_LOCAL_KEY);
    } catch {
      // ignore
    }
  }

  /** Listado desde users-service (solo admin en backend). */
  refresh(): Observable<void> {
    const h = this.authHeaders();
    if (!h) {
      this.users.set([]);
      return of(void 0);
    }
    return this.http.get<ApiEnvelope<Record<string, unknown>>>(`${this.baseUrl()}/admin/users`, { headers: h }).pipe(
      tap(() => this.listError.set(null)),
      map((body) => (body.data ?? []).map((row) => this.mapApiRow(row))),
      map((list) => {
        this.clearLegacyLocalStorage();
        this.users.set(list);
        return void 0;
      }),
      catchError((err) => {
        this.listError.set(this.toError(err).message);
        this.users.set([]);
        return of(void 0);
      }),
    );
  }

  create(input: { email: string; nombre: string; password: string; permissions: string[] }): Observable<void> {
    const h = this.authHeaders();
    if (!h) return throwError(() => new Error('Inicia sesión como administrador.'));
    const body = {
      email: input.email.trim().toLowerCase(),
      nombre: input.nombre.trim(),
      password: input.password,
      permissions: input.permissions,
    };
    return this.http.post<ApiEnvelope<unknown>>(`${this.baseUrl()}/add`, body, { headers: h }).pipe(
      switchMap(() => this.refresh()),
      catchError((err) => throwError(() => this.toError(err))),
    );
  }

  updatePermissions(userId: string, permissions: string[]): Observable<void> {
    const h = this.authHeaders();
    if (!h) return throwError(() => new Error('Inicia sesión como administrador.'));
    return this.http
      .patch<ApiEnvelope<unknown>>(`${this.baseUrl()}/admin/users/${userId}/permissions`, { permissions }, { headers: h })
      .pipe(
        switchMap(() => this.refresh()),
        catchError((err) => throwError(() => this.toError(err))),
      );
  }

  remove(userId: string): Observable<void> {
    const h = this.authHeaders();
    if (!h) return throwError(() => new Error('Inicia sesión como administrador.'));
    return this.http.delete<ApiEnvelope<unknown>>(`${this.baseUrl()}/admin/users/${userId}`, { headers: h }).pipe(
      switchMap(() => this.refresh()),
      catchError((err) => throwError(() => this.toError(err))),
    );
  }

  private mapApiRow(raw: Record<string, unknown>): AdminUser {
    const { message: _m, ...rest } = raw as Record<string, unknown> & { message?: string };
    const permissions = Array.isArray(rest['permissions'])
      ? (rest['permissions'] as unknown[]).filter((x): x is string => typeof x === 'string')
      : [];
    return {
      id: typeof rest['id'] === 'string' ? rest['id'] : '',
      email: typeof rest['email'] === 'string' ? rest['email'] : '',
      nombre: typeof rest['nombre'] === 'string' ? rest['nombre'] : '',
      isAdmin: rest['isAdmin'] === true,
      permissions,
      createdAt: typeof rest['createdAt'] === 'number' ? rest['createdAt'] : 0,
    };
  }

  private toError(err: unknown): Error {
    const wrapped = (err as { error?: unknown })?.error;
    const body =
      wrapped && typeof wrapped === 'object' && wrapped !== null && 'data' in wrapped
        ? (wrapped as ApiEnvelope<{ message?: string }>)
        : null;
    const msg = body?.data?.[0]?.message;
    if (typeof msg === 'string' && msg.trim()) return new Error(msg);
    return new Error('Error al comunicarse con el servidor de usuarios');
  }
}
