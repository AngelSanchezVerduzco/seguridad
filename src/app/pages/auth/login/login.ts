import { HttpClient } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { API_BASE_URL } from '../../../services/api-config';
import { AuthSession } from '../../../services/auth-session';
import { ProfileStore } from '../../../services/profile-store';
import { PermissionService } from '../../../services/permission.service';
import { UserAccountStore } from '../../../services/user-account-store';
import { ADMIN_EMAIL, ADMIN_PERMISSIONS, USER_PERMISSIONS } from '../../../services/auth-accounts';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [RouterLink, ReactiveFormsModule, ButtonModule, InputTextModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  private readonly http = inject(HttpClient);
  private readonly authSession = inject(AuthSession);
  private readonly profileStore = inject(ProfileStore);
  private readonly permissionService = inject(PermissionService);
  private readonly userAccountStore = inject(UserAccountStore);

  form: FormGroup;
  loginError = '';

  constructor(private fb: FormBuilder, private router: Router) {
    this.form = this.fb.group({
      email: ['', [Validators.required]],
      password: ['', [Validators.required, Validators.minLength(1)]],
    });
  }

  isInvalid(name: string): boolean {
    const c = this.form.get(name);
    return !!c && c.invalid && (c.dirty || c.touched);
  }

  onLogin(): void {
    this.form.markAllAsTouched();
    this.loginError = '';
    if (this.form.invalid) return;

    const email = (this.form.get('email')?.value ?? '').trim().toLowerCase();
    const password = (this.form.get('password')?.value ?? '').trim();

    if (email === ADMIN_EMAIL) {
      // Admin: cualquier contraseña no vacía
      if (!password) {
        this.loginError = 'Ingresa la contraseña';
        return;
      }
      this.authSession.clear();
      this.profileStore.set({
        usuario: 'admin',
        email: ADMIN_EMAIL,
        nombreCompleto: 'Administrador',
        direccion: '',
        fechaNacimiento: '',
        telefono: '',
        isAdmin: true,
      });
      this.permissionService.setPermissions(ADMIN_PERMISSIONS);
      this.router.navigate(['/dashboard']);
      return;
    }

    // Buscar en los usuarios creados por el admin
    if (!password) {
      this.loginError = 'Ingresa la contraseña';
      return;
    }

    this.http
      .post<{
        statusCode: number;
        intOpCode: number;
        data: Array<{
          accessToken?: string;
          /** Viene del users-service leyendo profiles.is_admin */
          isAdmin?: boolean;
          /** Permisos desde user_permissions (solo usuarios no admin). */
          permissions?: string[];
          user?: {
            email?: string;
            user_metadata?: Record<string, unknown>;
          };
          profile?: {
            usuario?: string;
            email?: string;
            nombreCompleto?: string;
            direccion?: string;
            fechaNacimiento?: string;
            telefono?: string;
            isAdmin?: boolean;
          } | null;
        }>;
      }>(`${API_BASE_URL}/api/users/login`, { email, password })
      .subscribe({
        next: (res) => {
          const row = res.data?.[0];
          const token = row?.accessToken?.trim();
          if (token) {
            this.authSession.setAccessToken(token);
            const u = row.user;
            const meta = (u?.user_metadata ?? {}) as Record<string, unknown>;
            const p = row.profile;

            const usuario =
              (p?.usuario && String(p.usuario).trim()) ||
              (typeof meta['usuario'] === 'string' && meta['usuario'].trim()
                ? String(meta['usuario']).trim()
                : '') ||
              email.split('@')[0] ||
              'usuario';

            const nombreCompleto =
              (p?.nombreCompleto && String(p.nombreCompleto).trim()) ||
              (typeof meta['nombreCompleto'] === 'string' && meta['nombreCompleto'].trim()
                ? String(meta['nombreCompleto']).trim()
                : '') ||
              usuario;

            const isAdminFromApi = row.isAdmin === true;
            const isAdminFromProfile = p?.isAdmin === true;
            const isAdminFromMeta = meta['is_admin'] === true || meta['isAdmin'] === true;
            const isAdmin = isAdminFromApi || isAdminFromProfile || isAdminFromMeta;

            const apiPerms = row.permissions;
            const nonAdminPermissions = Array.isArray(apiPerms)
              ? apiPerms
              : this.userAccountStore.getByEmail(email)?.permissions ?? USER_PERMISSIONS;

            this.profileStore.set({
              usuario,
              email: (p?.email ?? u?.email ?? email).toLowerCase().trim(),
              nombreCompleto,
              direccion:
                (p?.direccion != null && String(p.direccion)) ||
                (typeof meta['direccion'] === 'string' ? String(meta['direccion']) : ''),
              fechaNacimiento:
                (p?.fechaNacimiento != null && String(p.fechaNacimiento)) ||
                (typeof meta['fechaNacimiento'] === 'string' ? String(meta['fechaNacimiento']) : ''),
              telefono:
                (p?.telefono != null && String(p.telefono)) ||
                (typeof meta['telefono'] === 'string' ? String(meta['telefono']) : ''),
              isAdmin,
              ...(isAdmin ? {} : { permissions: nonAdminPermissions }),
            });
            if (isAdmin) {
              this.permissionService.setPermissions(ADMIN_PERMISSIONS);
            } else {
              this.permissionService.setPermissions(nonAdminPermissions);
            }
            this.router.navigate(['/dashboard']);
            return;
          }
          this.loginError = 'No se pudo iniciar sesión con el servidor.';
        },
        error: (err) => {
          this.authSession.clear();
          const msg =
            (err?.error?.data?.[0]?.message as string | undefined) ??
            'No se pudo iniciar sesión en el servidor.';
          this.loginError = msg;
        },
      });
  }
}
