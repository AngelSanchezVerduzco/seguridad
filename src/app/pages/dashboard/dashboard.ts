import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { DragDropModule, CdkDragDrop } from '@angular/cdk/drag-drop';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { IfHasPermissionDirective } from '../../directives/if-has-permission.directive';
import { PermissionService } from '../../services/permission.service';
import { GroupStore } from '../../services/group-store';
import { ProfileStore } from '../../services/profile-store';
import { TicketEntity, TicketPriority, TicketStatus, TicketStore } from '../../services/ticket-store';

type SortKey = 'createdAt_desc' | 'createdAt_asc' | 'fechaLimite_asc' | 'fechaLimite_desc' | 'prioridad_desc' | 'prioridad_asc';
type ViewMode = 'Lista' | 'Kanban';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    RouterLink,
    FormsModule,
    ReactiveFormsModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    TextareaModule,
    SelectModule,
    DatePickerModule,
    TagModule,
    DragDropModule,
    IfHasPermissionDirective,
  ],
  templateUrl: './dashboard.html',
})
export class Dashboard {
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  readonly groupStore = inject(GroupStore);
  readonly ticketStore = inject(TicketStore);
  readonly profileStore = inject(ProfileStore);
  readonly permissionService = inject(PermissionService);

  readonly statusOptions: TicketStatus[] = ['Pendiente', 'En progreso', 'Revisión', 'Finalizada'];
  readonly priorityOptions: TicketPriority[] = ['Baja', 'Media', 'Alta'];

  selectedGroupId = signal<string | null>(null);
  viewMode = signal<ViewMode>('Lista');

  query = signal('');
  statusFilter = signal<TicketStatus | 'Todos'>('Todos');
  priorityFilter = signal<TicketPriority | 'Todas'>('Todas');
  sortKey = signal<SortKey>('createdAt_desc');

  createDialogVisible = false;
  createError = '';
  readonly now = Date.now();

  readonly createForm = this.fb.group({
    groupId: ['', [Validators.required]],
    titulo: ['', [Validators.required]],
    descripcion: ['', [Validators.required]],
    estado: ['Pendiente' as TicketStatus, [Validators.required]],
    asignadoA: ['', [Validators.required]],
    prioridad: ['Media' as TicketPriority, [Validators.required]],
    fechaLimite: [null as Date | null, []],
  });

  readonly isAdmin = computed(() => this.profileStore.profile()?.isAdmin === true);
  readonly canViewTickets = computed(() => {
    const perms = this.permissionService.permissions();
    return perms.includes('tickets_view') || perms.includes('ticket_view');
  });
  readonly canEditTickets = computed(() => {
    const perms = this.permissionService.permissions();
    return perms.includes('ticket_edit') || perms.includes('tickets_edit');
  });
  readonly canViewGroups = computed(() => {
    const perms = this.permissionService.permissions();
    return perms.includes('groups_view') || perms.includes('group_view');
  });
  readonly userGroupIds = computed(() => {
    if (this.isAdmin()) return null;
    const email = this.profileStore.profile()?.email ?? '';
    return this.groupStore.groupIdsWhereMember(email);
  });

  /** Nombres de los grupos del usuario (para mostrar en dashboard cuando no es admin). */
  readonly userGroupNames = computed(() => {
    const ids = this.userGroupIds();
    if (!ids?.length) return '';
    return this.groupStore
      .groups()
      .filter((g) => ids.includes(g.id))
      .map((g) => g.nombre)
      .join(', ');
  });

  readonly groupOptions = computed(() => {
    const groups = this.groupStore.groups();
    if (this.isAdmin()) return groups.map((g) => ({ label: g.nombre, value: g.id }));
    const ids = new Set(this.userGroupIds() ?? []);
    return groups.filter((g) => ids.has(g.id)).map((g) => ({ label: g.nombre, value: g.id }));
  });
  readonly groupFilterOptions = computed(() => [{ label: 'Todos los grupos', value: null as string | null }, ...this.groupOptions()]);

  readonly statusFilterOptions = computed(() => [
    { label: 'Todos', value: 'Todos' as const },
    ...this.statusOptions.map((s) => ({ label: s, value: s })),
  ]);

  readonly priorityFilterOptions = computed(() => [
    { label: 'Todas', value: 'Todas' as const },
    ...this.priorityOptions.map((p) => ({ label: p, value: p })),
  ]);

  readonly sortOptions = computed(() => [
    { label: 'Creación (nuevo primero)', value: 'createdAt_desc' as const },
    { label: 'Creación (antiguo primero)', value: 'createdAt_asc' as const },
    { label: 'Fecha límite (próxima)', value: 'fechaLimite_asc' as const },
    { label: 'Fecha límite (lejana)', value: 'fechaLimite_desc' as const },
    { label: 'Prioridad (alta primero)', value: 'prioridad_desc' as const },
    { label: 'Prioridad (baja primero)', value: 'prioridad_asc' as const },
  ]);

  readonly ticketsBase = computed(() => {
    if (this.isAdmin()) {
      return this.ticketStore.listByGroup(this.selectedGroupId());
    }
    const ids = this.userGroupIds();
    const base = ids ? this.ticketStore.listByGroups(ids) : [];
    const sel = this.selectedGroupId();
    if (!sel) return base;
    return base.filter((t) => t.groupId === sel);
  });

  readonly ticketsFiltered = computed(() => {
    const q = this.query().trim().toLowerCase();
    const status = this.statusFilter();
    const prio = this.priorityFilter();
    const sort = this.sortKey();

    let list = this.ticketsBase();
    if (status !== 'Todos') list = list.filter((t) => t.estado === status);
    if (prio !== 'Todas') list = list.filter((t) => t.prioridad === prio);
    if (q) {
      list = list.filter((t) => {
        const groupName = this.groupName(t.groupId).toLowerCase();
        return (
          t.titulo.toLowerCase().includes(q) ||
          t.descripcion.toLowerCase().includes(q) ||
          t.asignadoA.toLowerCase().includes(q) ||
          groupName.includes(q)
        );
      });
    }

    const prioRank: Record<TicketPriority, number> = { Baja: 1, Media: 2, Alta: 3 };
    const byCreated = (a: TicketEntity, b: TicketEntity) => a.createdAt - b.createdAt;
    const byDue = (a: TicketEntity, b: TicketEntity) => (a.fechaLimite ?? Infinity) - (b.fechaLimite ?? Infinity);
    const byPrio = (a: TicketEntity, b: TicketEntity) => (prioRank[a.prioridad] ?? 0) - (prioRank[b.prioridad] ?? 0);

    const sorted = [...list];
    switch (sort) {
      case 'createdAt_asc':
        sorted.sort(byCreated);
        break;
      case 'createdAt_desc':
        sorted.sort((a, b) => byCreated(b, a));
        break;
      case 'fechaLimite_asc':
        sorted.sort(byDue);
        break;
      case 'fechaLimite_desc':
        sorted.sort((a, b) => byDue(b, a));
        break;
      case 'prioridad_asc':
        sorted.sort(byPrio);
        break;
      case 'prioridad_desc':
        sorted.sort((a, b) => byPrio(b, a));
        break;
    }
    return sorted;
  });

  readonly countsByStatusForSelection = computed(() => {
    const base: Record<TicketStatus, number> = {
      Pendiente: 0,
      'En progreso': 0,
      Revisión: 0,
      Finalizada: 0,
    };
    for (const t of this.ticketsBase()) base[t.estado] = (base[t.estado] ?? 0) + 1;
    return base;
  });

  kanbanColumn(status: TicketStatus): TicketEntity[] {
    const q = this.query().trim().toLowerCase();
    const prio = this.priorityFilter();
    let list = this.ticketsBase().filter((t) => t.estado === status);
    if (prio !== 'Todas') list = list.filter((t) => t.prioridad === prio);
    if (q) {
      list = list.filter((t) => {
        const groupName = this.groupName(t.groupId).toLowerCase();
        return (
          t.titulo.toLowerCase().includes(q) ||
          t.descripcion.toLowerCase().includes(q) ||
          t.asignadoA.toLowerCase().includes(q) ||
          groupName.includes(q)
        );
      });
    }
    return list;
  }

  irTicket(t: TicketEntity): void {
    this.router.navigate(['/tickets', t.id]);
  }

  abrirCrearTicket(): void {
    this.createError = '';
    const opts = this.groupOptions();
    const sel = this.selectedGroupId();
    const gid =
      sel && opts.some((o) => o.value === sel) ? sel : (opts[0]?.value ?? '');
    const email = this.profileStore.profile()?.email?.trim() ?? '';
    this.createForm.reset({
      groupId: gid,
      titulo: '',
      descripcion: '',
      estado: 'Pendiente',
      asignadoA: email,
      prioridad: 'Media',
      fechaLimite: null,
    });
    this.ensureAssigneeMatchesGroup(this.createForm, false);
    this.createDialogVisible = true;
  }

  /** Opciones de “Asignado a” según el grupo elegido en el diálogo. */
  createAssigneeOptions(): { label: string; value: string }[] {
    const gid = String(this.createForm.get('groupId')?.value ?? '');
    return this.groupStore.membersOf(gid).map((m) => ({ label: m, value: m }));
  }

  onCreateDialogGroupChange(): void {
    this.ensureAssigneeMatchesGroup(this.createForm, false);
  }

  /**
   * Ajusta asignado al primer miembro del grupo si el valor actual no pertenece.
   * allowForeign: al editar un ticket, conservar asignado aunque ya no esté en miembros.
   */
  private ensureAssigneeMatchesGroup(form: FormGroup, allowForeign: boolean): void {
    const gid = String(form.get('groupId')?.value ?? '');
    const members = this.groupStore.membersOf(gid);
    const cur = String(form.get('asignadoA')?.value ?? '').trim();
    const match = members.find((m) => m.toLowerCase() === cur.toLowerCase());
    if (match) {
      if (match !== cur) form.patchValue({ asignadoA: match }, { emitEvent: false });
      return;
    }
    if (allowForeign && cur) return;
    form.patchValue({ asignadoA: members[0] ?? '' }, { emitEvent: false });
  }

  guardarCrearTicket(): void {
    this.createForm.markAllAsTouched();
    if (this.createForm.invalid) return;
    this.createError = '';
    const v = this.createForm.getRawValue();
    this.ticketStore
      .add({
        groupId: String(v.groupId ?? ''),
        titulo: String(v.titulo ?? ''),
        descripcion: String(v.descripcion ?? ''),
        estado: v.estado as TicketStatus,
        asignadoA: String(v.asignadoA ?? ''),
        prioridad: v.prioridad as TicketPriority,
        fechaLimite: v.fechaLimite instanceof Date ? v.fechaLimite.getTime() : null,
      })
      .subscribe({
        next: () => {
          this.createDialogVisible = false;
        },
        error: (e) => {
          this.createError = e instanceof Error ? e.message : 'No se pudo crear el ticket';
        },
      });
  }

  /** IDs de las columnas del Kanban para conectar las listas entre sí. */
  readonly kanbanColumnIds = computed(() =>
    this.statusOptions.map((s) => 'col-' + s)
  );

  /** Para cada columna, devuelve los IDs del resto de columnas (conexión explícita). */
  connectedTo(currentStatus: TicketStatus): string[] {
    return this.kanbanColumnIds().filter((id) => id !== 'col-' + currentStatus);
  }

  onTicketDrop(event: CdkDragDrop<TicketStatus, TicketEntity>): void {
    if (!this.isAdmin() && !this.permissionService.hasAnyPermission(['ticket_edit', 'tickets_edit'])) return;
    const ticket = event.item.data as TicketEntity;
    const newStatus = event.container.data as TicketStatus;
    if (ticket.estado !== newStatus) {
      this.ticketStore.update(ticket.id, { estado: newStatus }).subscribe({
        error: (e) => console.error(e),
      });
    }
  }

  groupName(groupId: string): string {
    const g = this.groupStore.groups().find((x) => x.id === groupId);
    return g?.nombre ?? '(sin grupo)';
  }

  formatDate(ts: number | null): string {
    if (!ts) return '-';
    return new Date(ts).toLocaleDateString();
  }

  statusSeverity(status: TicketStatus): 'success' | 'info' | 'warn' | 'danger' {
    switch (status) {
      case 'Pendiente':
        return 'warn';
      case 'En progreso':
        return 'info';
      case 'Revisión':
        return 'danger';
      case 'Finalizada':
        return 'success';
    }
  }

  prioritySeverity(p: TicketPriority): 'success' | 'info' | 'warn' | 'danger' {
    switch (p) {
      case 'Baja':
        return 'success';
      case 'Media':
        return 'warn';
      case 'Alta':
        return 'danger';
    }
  }
}

