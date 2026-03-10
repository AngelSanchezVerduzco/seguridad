import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { IfHasPermissionDirective } from '../../directives/if-has-permission.directive';
import { GroupStore } from '../../services/group-store';
import { TicketEntity, TicketPriority, TicketStatus, TicketStore } from '../../services/ticket-store';

type SortKey = 'createdAt_desc' | 'createdAt_asc' | 'fechaLimite_asc' | 'fechaLimite_desc' | 'prioridad_desc' | 'prioridad_asc';

@Component({
  selector: 'app-tickets',
  standalone: true,
  imports: [
    FormsModule,
    ReactiveFormsModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    TextareaModule,
    SelectModule,
    DatePickerModule,
    TableModule,
    TagModule,
    IfHasPermissionDirective,
  ],
  templateUrl: './tickets.html',
})
export class Tickets {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);

  readonly groupStore = inject(GroupStore);
  readonly ticketStore = inject(TicketStore);

  readonly statusOptions: TicketStatus[] = ['Pendiente', 'En progreso', 'Revisión', 'Finalizada'];
  readonly priorityOptions: TicketPriority[] = ['Baja', 'Media', 'Alta'];

  selectedGroupId = signal<string | null>(null);
  query = signal('');
  statusFilter = signal<TicketStatus | 'Todos'>('Todos');
  priorityFilter = signal<TicketPriority | 'Todas'>('Todas');
  sortKey = signal<SortKey>('createdAt_desc');

  dialogVisible = false;
  editing = signal<TicketEntity | null>(null);

  readonly form = this.fb.group({
    groupId: ['', [Validators.required]],
    titulo: ['', [Validators.required]],
    descripcion: ['', [Validators.required]],
    estado: ['Pendiente' as TicketStatus, [Validators.required]],
    asignadoA: ['', [Validators.required]],
    prioridad: ['Media' as TicketPriority, [Validators.required]],
    fechaLimite: [null as Date | null, []],
  });

  readonly groupOptions = computed(() => {
    return this.groupStore.groups().map((g) => ({ label: g.nombre, value: g.id }));
  });

  readonly groupFilterOptions = computed(() => [{ label: 'Todos', value: null as string | null }, ...this.groupOptions()]);

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

  readonly now = Date.now();

  readonly filteredTickets = computed(() => {
    const groupId = this.selectedGroupId();
    const q = this.query().trim().toLowerCase();
    const status = this.statusFilter();
    const prio = this.priorityFilter();
    const sort = this.sortKey();

    let list = this.ticketStore.listByGroup(groupId);
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

  nuevo(): void {
    this.editing.set(null);
    this.form.reset({
      groupId: this.groupStore.groups()[0]?.id ?? '',
      titulo: '',
      descripcion: '',
      estado: 'Pendiente',
      asignadoA: '',
      prioridad: 'Media',
      fechaLimite: null,
    });
    this.dialogVisible = true;
  }

  ver(t: TicketEntity): void {
    this.router.navigate(['/tickets', t.id]);
  }

  editar(t: TicketEntity): void {
    this.editing.set(t);
    this.form.reset({
      groupId: t.groupId,
      titulo: t.titulo,
      descripcion: t.descripcion,
      estado: t.estado,
      asignadoA: t.asignadoA,
      prioridad: t.prioridad,
      fechaLimite: t.fechaLimite ? new Date(t.fechaLimite) : null,
    });
    this.dialogVisible = true;
  }

  eliminar(t: TicketEntity): void {
    this.ticketStore.remove(t.id);
  }

  guardar(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    const payload = {
      groupId: String(v.groupId ?? ''),
      titulo: String(v.titulo ?? ''),
      descripcion: String(v.descripcion ?? ''),
      estado: v.estado as TicketStatus,
      asignadoA: String(v.asignadoA ?? ''),
      prioridad: v.prioridad as TicketPriority,
      fechaLimite: v.fechaLimite instanceof Date ? v.fechaLimite.getTime() : null,
    };

    const editing = this.editing();
    if (editing) {
      this.ticketStore.update(editing.id, payload);
    } else {
      this.ticketStore.add(payload);
    }
    this.dialogVisible = false;
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

