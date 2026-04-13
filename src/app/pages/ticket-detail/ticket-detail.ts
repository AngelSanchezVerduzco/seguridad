import { Component, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { IfHasPermissionDirective } from '../../directives/if-has-permission.directive';
import { GroupStore } from '../../services/group-store';
import { ProfileStore } from '../../services/profile-store';
import { TicketEntity, TicketPriority, TicketStatus, TicketStore } from '../../services/ticket-store';

@Component({
  selector: 'app-ticket-detail',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    TextareaModule,
    SelectModule,
    DatePickerModule,
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
  readonly profileStore = inject(ProfileStore);

  readonly isAdmin = computed(() => this.profileStore.profile()?.isAdmin === true);
  readonly userGroupIds = computed(() => {
    if (this.isAdmin()) return null;
    const email = this.profileStore.profile()?.email ?? '';
    return this.groupStore.groupIdsWhereMember(email);
  });

  readonly ticketId = signal<string>('');
  readonly ticket = computed(() => this.ticketStore.getById(this.ticketId()));

  readonly canAccessTicket = computed(() => {
    const t = this.ticket();
    if (!t) return true;
    if (this.isAdmin()) return true;
    const ids = this.userGroupIds() ?? [];
    return ids.includes(t.groupId);
  });

  readonly now = Date.now();

  commentControl = new FormControl<string>('', { nonNullable: true });

  dialogVisible = false;
  detailSaveError = '';
  readonly commentError = signal<string | null>(null);

  readonly form = this.fb.group({
    groupId: ['', [Validators.required]],
    titulo: ['', [Validators.required]],
    descripcion: ['', [Validators.required]],
    estado: ['Pendiente' as TicketStatus, [Validators.required]],
    asignadoA: ['', [Validators.required]],
    prioridad: ['Media' as TicketPriority, [Validators.required]],
    fechaLimite: [null as Date | null, []],
  });

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((pm) => {
      const id = pm.get('id') ?? '';
      this.ticketId.set(id);
      this.detailSaveError = '';
      this.commentError.set(null);
      if (id) {
        this.ticketStore.ensureLoaded(id).subscribe();
      }
    });

    effect(() => {
      const t = this.ticket();
      const canAccess = this.canAccessTicket();
      if (t && !canAccess) {
        void this.router.navigate(['/dashboard']);
      }
    });
  }

  readonly groupOptions = computed(() =>
    this.groupStore.groups().map((g) => ({ label: g.nombre, value: g.id })),
  );

  readonly statusOptions: TicketStatus[] = ['Pendiente', 'En progreso', 'Revisión', 'Finalizada'];
  readonly priorityOptions: TicketPriority[] = ['Baja', 'Media', 'Alta'];

  editar(): void {
    const t = this.ticket();
    if (!t) return;
    this.detailSaveError = '';
    this.form.reset({
      groupId: t.groupId,
      titulo: t.titulo,
      descripcion: t.descripcion,
      estado: t.estado,
      asignadoA: t.asignadoA,
      prioridad: t.prioridad,
      fechaLimite: t.fechaLimite ? new Date(t.fechaLimite) : null,
    });
    this.ensureAssigneeMatchesGroup(this.form, true);
    this.dialogVisible = true;
  }

  detailAssigneeOptions(): { label: string; value: string }[] {
    const gid = String(this.form.get('groupId')?.value ?? '');
    const members = this.groupStore.membersOf(gid);
    const cur = String(this.form.get('asignadoA')?.value ?? '').trim();
    const opts = members.map((m) => ({ label: m, value: m }));
    if (cur && !members.some((m) => m.toLowerCase() === cur.toLowerCase())) {
      opts.unshift({ label: `${cur} (asignación actual)`, value: cur });
    }
    return opts;
  }

  onDetailDialogGroupChange(): void {
    this.ensureAssigneeMatchesGroup(this.form, false);
  }

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

  guardar(): void {
    const t = this.ticket();
    if (!t) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.detailSaveError = '';
    const v = this.form.getRawValue();
    this.ticketStore
      .update(t.id, {
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
          this.dialogVisible = false;
        },
        error: (e) => {
          this.detailSaveError = e instanceof Error ? e.message : 'No se pudo guardar';
        },
      });
  }

  agregarComentario(): void {
    const t = this.ticket();
    if (!t) return;
    const text = (this.commentControl.value ?? '').trim();
    if (!text) return;
    this.commentError.set(null);
    this.ticketStore.addComment(t.id, text).subscribe({
      next: () => {
        this.commentControl.setValue('');
      },
      error: (e) => {
        const msg = e instanceof Error ? e.message : 'No se pudo agregar el comentario';
        this.commentError.set(msg);
      },
    });
  }

  volver(): void {
    void this.router.navigate(['/dashboard']);
  }

  eliminar(): void {
    const t = this.ticket();
    if (!t) return;
    this.ticketStore.remove(t.id).subscribe({
      next: () => {
        void this.router.navigate(['/dashboard']);
      },
      error: (e) => {
        this.detailSaveError = e instanceof Error ? e.message : 'No se pudo eliminar';
      },
    });
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

