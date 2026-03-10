import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { DragDropModule, CdkDragDrop } from '@angular/cdk/drag-drop';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { IfHasPermissionDirective } from '../../directives/if-has-permission.directive';
import { GroupStore } from '../../services/group-store';
import { TicketEntity, TicketPriority, TicketStatus, TicketStore } from '../../services/ticket-store';

type SortKey = 'createdAt_desc' | 'createdAt_asc' | 'fechaLimite_asc' | 'fechaLimite_desc' | 'prioridad_desc' | 'prioridad_asc';
type ViewMode = 'Lista' | 'Kanban';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    RouterLink,
    FormsModule,
    ButtonModule,
    InputTextModule,
    SelectModule,
    TagModule,
    DragDropModule,
    IfHasPermissionDirective,
  ],
  templateUrl: './dashboard.html',
})
export class Dashboard {
  private readonly router = inject(Router);
  readonly groupStore = inject(GroupStore);
  readonly ticketStore = inject(TicketStore);

  readonly statusOptions: TicketStatus[] = ['Pendiente', 'En progreso', 'Revisión', 'Finalizada'];
  readonly priorityOptions: TicketPriority[] = ['Baja', 'Media', 'Alta'];

  selectedGroupId = signal<string | null>(null);
  viewMode = signal<ViewMode>('Lista');

  query = signal('');
  statusFilter = signal<TicketStatus | 'Todos'>('Todos');
  priorityFilter = signal<TicketPriority | 'Todas'>('Todas');
  sortKey = signal<SortKey>('createdAt_desc');

  readonly groupOptions = computed(() => this.groupStore.groups().map((g) => ({ label: g.nombre, value: g.id })));
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

  readonly ticketsBase = computed(() => this.ticketStore.listByGroup(this.selectedGroupId()));

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
    const groupId = this.selectedGroupId();
    let list = this.ticketStore.listByGroup(groupId).filter((t) => t.estado === status);
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

  /** IDs de las columnas del Kanban para conectar las listas entre sí. */
  readonly kanbanColumnIds = computed(() =>
    this.statusOptions.map((s) => 'col-' + s)
  );

  /** Para cada columna, devuelve los IDs del resto de columnas (conexión explícita). */
  connectedTo(currentStatus: TicketStatus): string[] {
    return this.kanbanColumnIds().filter((id) => id !== 'col-' + currentStatus);
  }

  onTicketDrop(event: CdkDragDrop<TicketStatus, TicketEntity>): void {
    const ticket = event.item.data as TicketEntity;
    const newStatus = event.container.data as TicketStatus;
    if (ticket.estado !== newStatus) {
      this.ticketStore.update(ticket.id, { estado: newStatus });
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

