import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { TableModule } from 'primeng/table';
import { GroupEntity, GroupStore } from '../../services/group-store';
import { ProfileStore } from '../../services/profile-store';
import { PermissionService } from '../../services/permission.service';
import { AuthSession } from '../../services/auth-session';

function labelFromJwtPayload(token: string | null): string {
  if (!token) return '';
  try {
    const parts = token.split('.');
    if (parts.length < 2) return '';
    let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4;
    if (pad) b64 += '='.repeat(4 - pad);
    const json = atob(b64);
    const payload = JSON.parse(json) as {
      email?: unknown;
      user_metadata?: Record<string, unknown>;
    };
    const top = typeof payload.email === 'string' ? payload.email.trim() : '';
    const meta = payload.user_metadata;
    const metaEmail = meta && typeof meta['email'] === 'string' ? String(meta['email']).trim() : '';
    const metaUser = meta && typeof meta['usuario'] === 'string' ? String(meta['usuario']).trim() : '';
    return top || metaEmail || metaUser;
  } catch {
    return '';
  }
}

@Component({
  selector: 'app-group-crud',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    TextareaModule,
    TableModule,
  ],
  templateUrl: './group-crud.html',
})
export class GroupCrud {
  private readonly fb = inject(FormBuilder);
  readonly groupStore = inject(GroupStore);
  readonly profileStore = inject(ProfileStore);
  readonly permissionService = inject(PermissionService);
  private readonly authSession = inject(AuthSession);

  /** Solo true en “Nuevo grupo”; permite sincronizar autor cuando el JWT/perfil ya está listo. */
  private readonly createDialogActive = signal(false);

  dialogVisible = false;
  saveError = '';
  editing: GroupEntity | null = null;
  memberControl = new FormControl<string>('', { nonNullable: true });
  pendingMembers: string[] = [];

  readonly isAdmin = computed(() => this.profileStore.profile()?.isAdmin === true);
  readonly currentUserEmail = computed(() => this.profileStore.profile()?.email ?? '');

  /** Etiqueta del autor al crear: perfil, o email del JWT si el perfil aún no cargó. */
  readonly currentAutorLabel = computed(() => {
    const p = this.profileStore.profile();
    if (p) {
      const email = p.email.trim();
      if (email) return email;
      const u = p.usuario.trim();
      if (u) return u;
    }
    return labelFromJwtPayload(this.authSession.accessToken());
  });

  readonly canCreate = computed(() => {
    const perms = this.permissionService.permissions();
    return perms.includes('groups_add') || perms.includes('group_add');
  });
  readonly canEdit = computed(() => {
    const perms = this.permissionService.permissions();
    return perms.includes('groups_edit');
  });
  readonly canDelete = computed(() => {
    const perms = this.permissionService.permissions();
    return perms.includes('groups_delete') || perms.includes('group_delete');
  });

  readonly form = this.fb.group({
    nivel: ['', [Validators.required]],
    autor: ['', [Validators.required]],
    nombre: ['', [Validators.required]],
    descripcion: ['', [Validators.required]],
  });

  constructor() {
    effect(() => {
      if (!this.createDialogActive()) return;
      const label = this.currentAutorLabel().trim();
      if (!label) return;
      const cur = String(this.form.controls.autor.value ?? '').trim();
      if (!cur) {
        this.form.patchValue({ autor: label }, { emitEvent: false });
      }
    });
  }

  cerrarDialogo(): void {
    this.dialogVisible = false;
    this.createDialogActive.set(false);
  }

  onDialogOculto(): void {
    this.createDialogActive.set(false);
  }

  canJoinGroup(g: GroupEntity): boolean {
    return (
      this.permissionService.hasPermission('group_join') &&
      !this.isMember(g)
    );
  }

  isMember(g: GroupEntity): boolean {
    const email = this.currentUserEmail().toLowerCase().trim();
    if (!email) return false;
    return (g.miembros ?? []).some((m) => m.toLowerCase().trim() === email);
  }

  unirse(g: GroupEntity): void {
    const email = this.currentUserEmail().trim();
    if (!email) return;
    this.saveError = '';
    this.groupStore.addMember(g.id, email).subscribe({
      error: (e) => {
        this.saveError = e instanceof Error ? e.message : 'No se pudo unir al grupo';
      },
    });
  }

  nuevo(): void {
    this.saveError = '';
    this.editing = null;
    const autor = this.currentAutorLabel();
    this.form.reset({
      nivel: '',
      autor,
      nombre: '',
      descripcion: '',
    });
    // Al crear no pedimos que el usuario “rellene” autor: lo toma la sesión (backend también).
    this.form.controls.autor.clearValidators();
    this.form.controls.autor.updateValueAndValidity({ emitEvent: false });
    this.memberControl.setValue('');
    this.pendingMembers = [];
    this.createDialogActive.set(true);
    this.dialogVisible = true;
  }

  editar(g: GroupEntity): void {
    this.saveError = '';
    this.createDialogActive.set(false);
    this.editing = g;
    this.form.reset({
      nivel: g.nivel,
      autor: g.autor,
      nombre: g.nombre,
      descripcion: g.descripcion,
    });
    this.form.controls.autor.setValidators([Validators.required]);
    this.form.controls.autor.updateValueAndValidity({ emitEvent: false });
    this.memberControl.setValue('');
    this.pendingMembers = Array.isArray(g.miembros) ? [...g.miembros] : [];
    this.dialogVisible = true;
  }

  eliminar(g: GroupEntity): void {
    this.saveError = '';
    this.groupStore.remove(g.id).subscribe({
      error: (e) => {
        this.saveError = e instanceof Error ? e.message : 'No se pudo eliminar el grupo';
      },
    });
  }

  agregarMiembro(): void {
    const value = (this.memberControl.value ?? '').trim();
    if (!value) return;
    if (!this.pendingMembers.includes(value)) {
      this.pendingMembers = [...this.pendingMembers, value];
    }
    this.memberControl.setValue('');
  }

  quitarMiembro(handle: string): void {
    this.pendingMembers = this.pendingMembers.filter((m) => m !== handle);
  }

  guardar(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      const labels: Record<string, string> = {
        nivel: 'Nivel',
        autor: 'Autor',
        nombre: 'Nombre',
        descripcion: 'Descripción',
      };
      const missing = Object.entries(this.form.controls)
        .filter(([key, c]) => c.invalid && !(key === 'autor' && !this.editing))
        .map(([k]) => labels[k] ?? k);
      this.saveError =
        missing.length > 0
          ? `Completa los campos obligatorios: ${missing.join(', ')}.`
          : 'Revisa el formulario.';
      return;
    }
    this.saveError = '';
    const v = this.form.getRawValue();
    const autorCreacion = this.currentAutorLabel().trim() || String(v.autor ?? '').trim();
    if (!this.editing && !autorCreacion) {
      this.saveError = 'No se pudo determinar el usuario de la sesión (autor). Vuelve a iniciar sesión.';
      return;
    }

    const payload = {
      nivel: String(v.nivel ?? ''),
      autor: this.editing ? String(v.autor ?? '') : autorCreacion,
      nombre: String(v.nombre ?? ''),
      descripcion: String(v.descripcion ?? ''),
      miembros: [...this.pendingMembers],
    };

    const req = this.editing
      ? this.groupStore.update(this.editing.id, payload)
      : this.groupStore.add({
          ...payload,
          tickets: 0,
        });

    req.subscribe({
      next: () => {
        this.cerrarDialogo();
      },
      error: (e) => {
        this.saveError = e instanceof Error ? e.message : 'No se pudo guardar el grupo';
      },
    });
  }
}

