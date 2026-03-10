import { Component, inject } from '@angular/core';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { TableModule } from 'primeng/table';
import { GroupEntity, GroupStore } from '../../services/group-store';
import { IfHasPermissionDirective } from '../../directives/if-has-permission.directive';

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
    IfHasPermissionDirective,
  ],
  templateUrl: './group-crud.html',
})
export class GroupCrud {
  private readonly fb = inject(FormBuilder);
  dialogVisible = false;
  editing: GroupEntity | null = null;
  memberControl = new FormControl<string>('', { nonNullable: true });
  pendingMembers: string[] = [];

  readonly form = this.fb.group({
    nivel: ['', [Validators.required]],
    autor: ['', [Validators.required]],
    nombre: ['', [Validators.required]],
    descripcion: ['', [Validators.required]],
  });

  constructor(public groupStore: GroupStore) {}

  nuevo(): void {
    this.editing = null;
    this.form.reset({
      nivel: '',
      autor: '',
      nombre: '',
      descripcion: '',
    });
    this.memberControl.setValue('');
    this.pendingMembers = [];
    this.dialogVisible = true;
  }

  editar(g: GroupEntity): void {
    this.editing = g;
    this.form.reset({
      nivel: g.nivel,
      autor: g.autor,
      nombre: g.nombre,
      descripcion: g.descripcion,
    });
    this.memberControl.setValue('');
    this.pendingMembers = Array.isArray(g.miembros) ? [...g.miembros] : [];
    this.dialogVisible = true;
  }

  eliminar(g: GroupEntity): void {
    this.groupStore.remove(g.id);
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
    if (this.form.invalid) return;
    const v = this.form.getRawValue();

    const payload = {
      nivel: String(v.nivel ?? ''),
      autor: String(v.autor ?? ''),
      nombre: String(v.nombre ?? ''),
      descripcion: String(v.descripcion ?? ''),
      miembros: [...this.pendingMembers],
    };

    if (this.editing) {
      this.groupStore.update(this.editing.id, payload);
    } else {
      this.groupStore.add({
        ...payload,
        tickets: 0,
      });
    }

    this.dialogVisible = false;
  }
}

