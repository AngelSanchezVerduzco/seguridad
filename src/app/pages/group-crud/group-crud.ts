import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { InputNumberModule } from 'primeng/inputnumber';
import { TableModule } from 'primeng/table';
import { GroupEntity, GroupStore } from '../../services/group-store';

@Component({
  selector: 'app-group-crud',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    TextareaModule,
    InputNumberModule,
    TableModule,
  ],
  templateUrl: './group-crud.html',
})
export class GroupCrud {
  private readonly fb = inject(FormBuilder);
  dialogVisible = false;
  editing: GroupEntity | null = null;

  readonly form = this.fb.group({
    nivel: ['', [Validators.required]],
    autor: ['', [Validators.required]],
    nombre: ['', [Validators.required]],
    integrantes: [1, [Validators.required]],
    tickets: [0, [Validators.required]],
    descripcion: ['', [Validators.required]],
  });

  constructor(public groupStore: GroupStore) {}

  nuevo(): void {
    this.editing = null;
    this.form.reset({
      nivel: '',
      autor: '',
      nombre: '',
      integrantes: 1,
      tickets: 0,
      descripcion: '',
    });
    this.dialogVisible = true;
  }

  editar(g: GroupEntity): void {
    this.editing = g;
    this.form.reset({
      nivel: g.nivel,
      autor: g.autor,
      nombre: g.nombre,
      integrantes: g.integrantes,
      tickets: g.tickets,
      descripcion: g.descripcion,
    });
    this.dialogVisible = true;
  }

  eliminar(g: GroupEntity): void {
    this.groupStore.remove(g.id);
  }

  guardar(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const v = this.form.getRawValue();

    const payload = {
      nivel: String(v.nivel ?? ''),
      autor: String(v.autor ?? ''),
      nombre: String(v.nombre ?? ''),
      integrantes: Number(v.integrantes ?? 0),
      tickets: Number(v.tickets ?? 0),
      descripcion: String(v.descripcion ?? ''),
    };

    if (this.editing) {
      this.groupStore.update(this.editing.id, payload);
    } else {
      this.groupStore.add(payload);
    }

    this.dialogVisible = false;
  }
}

