import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
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

@Component({
  selector: 'app-ticket-detail',
  standalone: true,
  imports: [
    RouterLink,
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
  templateUrl: './ticket-detail.html',
})
export class TicketDetail {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  readonly groupStore = inject(GroupStore);
  readonly ticketStore = inject(TicketStore);

  readonly groupOptions = computed(() =>
    this.groupStore.groups().map((g) => ({ label: g.nombre, value: g.id })),
  );

  readonly statusOptions: TicketStatus[] = ['Pendiente', 'En progreso', 'Revisión', 'Finalizada'];
  readonly priorityOptions: TicketPriority[] = ['Baja', 'Media', 'Alta'];

  readonly ticketId = signal<string>(this.route.snapshot.paramMap.get('id') ?? '');
  readonly ticket = computed(() => this.ticketStore.getById(this.ticketId()));
  readonly now = Date.now();

  commentControl = new FormControl<string>('', { nonNullable: true });

  dialogVisible = false;

  readonly form = this.fb.group({
    groupId: ['', [Validators.required]],
    titulo: ['', [Validators.required]],
    descripcion: ['', [Validators.required]],
    estado: ['Pendiente' as TicketStatus, [Validators.required]],
    asignadoA: ['', [Validators.required]],
    prioridad: ['Media' as TicketPriority, [Validators.required]],
    fechaLimite: [null as Date | null, []],
  });

  editar(): void {
    const t = this.ticket();
    if (!t) return;
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

  guardar(): void {
    const t = this.ticket();
    if (!t) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    this.ticketStore.update(t.id, {
      groupId: String(v.groupId ?? ''),
      titulo: String(v.titulo ?? ''),
      descripcion: String(v.descripcion ?? ''),
      estado: v.estado as TicketStatus,
      asignadoA: String(v.asignadoA ?? ''),
      prioridad: v.prioridad as TicketPriority,
      fechaLimite: v.fechaLimite instanceof Date ? v.fechaLimite.getTime() : null,
    });
    this.dialogVisible = false;
  }

  agregarComentario(): void {
    const t = this.ticket();
    if (!t) return;
    const text = (this.commentControl.value ?? '').trim();
    if (!text) return;
    this.ticketStore.addComment(t.id, text);
    this.commentControl.setValue('');
  }

  eliminar(): void {
    const t = this.ticket();
    if (!t) return;
    this.ticketStore.remove(t.id);
    this.router.navigate(['/tickets']);
  }

  groupName(groupId: string): string {
    const g = this.groupStore.groups().find((x) => x.id === groupId);
    return g?.nombre ?? '(sin grupo)';
  }

  formatDate(ts: number | null): string {
    if (!ts) return '-';
    return new Date(ts).toLocaleString();
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

  trackById(_: number, item: { id: string }): string {
    return item.id;
  }
}

