import { Component, OnInit, computed, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { finalize } from 'rxjs';
import { ProfileStore } from '../../services/profile-store';
import { AuthSession } from '../../services/auth-session';
import { PermissionService } from '../../services/permission.service';
import { API_BASE_URL } from '../../services/api-config';

type ApiEnvelope<T> = {
  statusCode: number;
  intOpCode: number;
  data: T[];
};

@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [ReactiveFormsModule, ButtonModule, InputTextModule, TextareaModule],
  templateUrl: './perfil.html',
})
export class Perfil implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  readonly profileStore = inject(ProfileStore);
  private readonly authSession = inject(AuthSession);
  private readonly permissionService = inject(PermissionService);

  /** Reactivo: cambia si se guarda o borra token en la misma vista. */
  readonly tieneSesionApi = computed(() => !!this.authSession.accessToken());

  readonly form = this.fb.group({
    usuario: ['', [Validators.required]],
    email: ['', [Validators.required]],
    nombreCompleto: ['', [Validators.required]],
    direccion: ['', [Validators.required]],
    fechaNacimiento: ['', [Validators.required]],
    telefono: ['', [Validators.required]],
  });

  saveMessage = '';
  saveError = '';
  deleteError = '';
  saving = false;
  deleting = false;

  ngOnInit(): void {
    this.syncFormFromProfile();
  }

  private syncFormFromProfile(): void {
    const p = this.profileStore.profile();
    if (!p) return;
    this.form.patchValue({
      usuario: p.usuario,
      email: p.email,
      nombreCompleto: p.nombreCompleto,
      direccion: p.direccion,
      fechaNacimiento: p.fechaNacimiento,
      telefono: p.telefono,
    });
  }

  private msgFromHttp(err: unknown): string {
    const e = err as { error?: { data?: Array<{ message?: string }> } };
    return e?.error?.data?.[0]?.message ?? 'Error de red o del servidor.';
  }

  guardar(): void {
    this.saveMessage = '';
    this.saveError = '';
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    const v = this.form.getRawValue();
    const token = this.authSession.accessToken();

    if (!token) {
      this.profileStore.update({
        usuario: v.usuario ?? '',
        email: v.email ?? '',
        nombreCompleto: v.nombreCompleto ?? '',
        direccion: v.direccion ?? '',
        fechaNacimiento: v.fechaNacimiento ?? '',
        telefono: v.telefono ?? '',
      });
      this.saveMessage = 'Cambios guardados solo en este equipo (sesión sin token de API).';
      return;
    }

    const body = {
      usuario: (v.usuario ?? '').trim(),
      email: (v.email ?? '').trim().toLowerCase(),
      nombreCompleto: (v.nombreCompleto ?? '').trim(),
      direccion: (v.direccion ?? '').trim(),
      fechaNacimiento: (v.fechaNacimiento ?? '').trim(),
      telefono: (v.telefono ?? '').trim(),
    };

    this.saving = true;
    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    });

    this.http
      .patch<ApiEnvelope<Record<string, unknown>>>(`${API_BASE_URL}/api/users/me`, body, { headers })
      .pipe(finalize(() => (this.saving = false)))
      .subscribe({
        next: (res) => {
          const row = res.data?.[0];
          if (!row || typeof row !== 'object') {
            this.saveError = 'Respuesta inválida del servidor.';
            return;
          }
          const prev = this.profileStore.profile();
          const isAdmin = row['isAdmin'] === true || prev?.isAdmin === true;
          this.profileStore.set({
            usuario: String(row['usuario'] ?? ''),
            email: String(row['email'] ?? '').toLowerCase(),
            nombreCompleto: String(row['nombreCompleto'] ?? ''),
            direccion: String(row['direccion'] ?? ''),
            fechaNacimiento: String(row['fechaNacimiento'] ?? ''),
            telefono: String(row['telefono'] ?? ''),
            isAdmin,
            ...(prev?.permissions !== undefined ? { permissions: prev.permissions } : {}),
          });
          this.saveMessage = 'Perfil actualizado en el servidor.';
        },
        error: (err) => {
          this.saveError = this.msgFromHttp(err);
        },
      });
  }

  resetear(): void {
    this.saveMessage = '';
    this.saveError = '';
    this.syncFormFromProfile();
  }

  borrar(): void {
    this.deleteError = '';
    if (!confirm('¿Eliminar tu cuenta de forma permanente? No podrás deshacer esta acción.')) {
      return;
    }

    const token = this.authSession.accessToken();
    if (!token) {
      this.cerrarSesionLocal();
      return;
    }

    this.deleting = true;
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
    this.http
      .delete<ApiEnvelope<unknown>>(`${API_BASE_URL}/api/users/me`, { headers })
      .pipe(finalize(() => (this.deleting = false)))
      .subscribe({
        next: () => this.cerrarSesionLocal(),
        error: (err) => {
          this.deleteError = this.msgFromHttp(err);
        },
      });
  }

  private cerrarSesionLocal(): void {
    this.authSession.clear();
    this.permissionService.setPermissions([]);
    this.profileStore.clear();
    this.form.reset({
      usuario: '',
      email: '',
      nombreCompleto: '',
      direccion: '',
      fechaNacimiento: '',
      telefono: '',
    });
    void this.router.navigate(['/login']);
  }
}
