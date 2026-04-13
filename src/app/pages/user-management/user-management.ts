import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { CheckboxModule } from 'primeng/checkbox';
import { TagModule } from 'primeng/tag';
import { AdminUser, AdminUsersStore } from '../../services/admin-users-store';
import { ProfileStore } from '../../services/profile-store';

const DEFAULT_NEW_PERMISSIONS = [
  'groups_view',
  'group_view',
  'tickets_view',
  'ticket_view',
] as const;

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [
    DatePipe,
    RouterLink,
    FormsModule,
    ReactiveFormsModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    TableModule,
    CheckboxModule,
    TagModule,
  ],
  templateUrl: './user-management.html',
})
export class UserManagement implements OnInit {
  private readonly fb = inject(FormBuilder);
  readonly adminUsers = inject(AdminUsersStore);
  private readonly profileStore = inject(ProfileStore);

  createDialogVisible = false;
  createError = '';
  permPanelError = '';

  readonly createForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    nombre: ['', [Validators.required]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  readonly permissionGroups = [
    {
      label: 'Grupos',
      permissions: [
        { key: 'groups_view', label: 'Ver grupos' },
        { key: 'group_view', label: 'Ver grupo' },
        { key: 'groups_add', label: 'Crear grupo' },
        { key: 'group_add', label: 'Crear grupo (alt)' },
        { key: 'groups_edit', label: 'Editar grupo' },
        { key: 'groups_delete', label: 'Eliminar grupo' },
        { key: 'group_delete', label: 'Eliminar grupo (alt)' },
        { key: 'group_join', label: 'Unirse a grupo' },
      ],
    },
    {
      label: 'Tickets',
      permissions: [
        { key: 'tickets_view', label: 'Ver tickets' },
        { key: 'ticket_view', label: 'Ver ticket' },
        { key: 'tickets_add', label: 'Crear ticket' },
        { key: 'ticket_add', label: 'Crear ticket (alt)' },
        { key: 'tickets_edit', label: 'Editar ticket' },
        { key: 'ticket_edit', label: 'Editar ticket (alt)' },
        { key: 'ticket_delete', label: 'Eliminar ticket' },
      ],
    },
    {
      label: 'Usuarios',
      permissions: [
        { key: 'users_view', label: 'Ver usuarios' },
        { key: 'user_view', label: 'Ver usuario' },
        { key: 'users_edit', label: 'Editar usuario' },
        { key: 'user_edit', label: 'Editar usuario (alt)' },
        { key: 'user_add', label: 'Crear usuario' },
        { key: 'user_delete', label: 'Eliminar usuario' },
      ],
    },
  ];

  selectedUser = signal<AdminUser | null>(null);
  editPermissions = signal<Set<string>>(new Set());

  readonly currentUserEmail = computed(() => this.profileStore.profile()?.email?.toLowerCase().trim() ?? '');

  ngOnInit(): void {
    this.adminUsers.refresh().subscribe();
  }

  abrirPermisos(user: AdminUser): void {
    this.permPanelError = '';
    this.selectedUser.set(user);
    this.editPermissions.set(new Set(user.permissions));
  }

  cerrarPermisos(): void {
    this.permPanelError = '';
    this.selectedUser.set(null);
    this.editPermissions.set(new Set());
  }

  togglePermission(key: string): void {
    const current = new Set(this.editPermissions());
    if (current.has(key)) {
      current.delete(key);
    } else {
      current.add(key);
    }
    this.editPermissions.set(current);
  }

  hasPermission(key: string): boolean {
    return this.editPermissions().has(key);
  }

  guardarPermisos(): void {
    const user = this.selectedUser();
    if (!user) return;
    this.permPanelError = '';
    this.adminUsers.updatePermissions(user.id, [...this.editPermissions()]).subscribe({
      next: () => this.cerrarPermisos(),
      error: (e) => {
        this.permPanelError = e instanceof Error ? e.message : 'No se pudieron guardar los permisos';
      },
    });
  }

  abrirCrear(): void {
    this.createForm.reset({ email: '', nombre: '', password: '' });
    this.createError = '';
    this.createDialogVisible = true;
  }

  crearUsuario(): void {
    this.createForm.markAllAsTouched();
    this.createError = '';
    if (this.createForm.invalid) return;

    const v = this.createForm.getRawValue();
    const email = (v.email ?? '').trim().toLowerCase();

    if (email === 'admin@admin.com') {
      this.createError = 'No puedes crear una cuenta admin.';
      return;
    }

    this.adminUsers
      .create({
        email,
        nombre: (v.nombre ?? '').trim(),
        password: v.password ?? '',
        permissions: [...DEFAULT_NEW_PERMISSIONS],
      })
      .subscribe({
        next: () => {
          this.createDialogVisible = false;
        },
        error: (e) => {
          this.createError = e instanceof Error ? e.message : 'No se pudo crear el usuario';
        },
      });
  }

  esUsuarioActual(u: AdminUser): boolean {
    const cur = this.currentUserEmail();
    if (!cur) return false;
    return u.email.toLowerCase().trim() === cur;
  }

  eliminarUsuario(user: AdminUser): void {
    if (this.esUsuarioActual(user)) {
      return;
    }
    this.adminUsers.remove(user.id).subscribe({
      error: () => {
        // El store ya refresca; podríamos añadir toast — por ahora silencioso si 403
      },
    });
    if (this.selectedUser()?.id === user.id) {
      this.cerrarPermisos();
    }
  }
}
