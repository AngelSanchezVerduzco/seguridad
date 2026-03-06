import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { ProfileStore } from '../../services/profile-store';

@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [ReactiveFormsModule, ButtonModule, InputTextModule, TextareaModule],
  templateUrl: './perfil.html',
})
export class Perfil {
  private readonly fb = inject(FormBuilder);
  public profileStore = inject(ProfileStore);

  readonly form = this.fb.group({
    usuario: ['', [Validators.required]],
    email: ['', [Validators.required]],
    nombreCompleto: ['', [Validators.required]],
    direccion: ['', [Validators.required]],
    fechaNacimiento: ['', [Validators.required]],
    telefono: ['', [Validators.required]],
  });

  constructor() {
    const p = this.profileStore.profile();
    if (p) {
      this.form.patchValue({
        usuario: p.usuario,
        email: p.email,
        nombreCompleto: p.nombreCompleto,
        direccion: p.direccion,
        fechaNacimiento: p.fechaNacimiento,
        telefono: p.telefono,
      });
    }
  }

  guardar(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    this.profileStore.set({
      usuario: v.usuario ?? '',
      email: v.email ?? '',
      nombreCompleto: v.nombreCompleto ?? '',
      direccion: v.direccion ?? '',
      fechaNacimiento: v.fechaNacimiento ?? '',
      telefono: v.telefono ?? '',
    });
  }

  resetear(): void {
    const p = this.profileStore.profile();
    this.form.reset({
      usuario: p?.usuario ?? '',
      email: p?.email ?? '',
      nombreCompleto: p?.nombreCompleto ?? '',
      direccion: p?.direccion ?? '',
      fechaNacimiento: p?.fechaNacimiento ?? '',
      telefono: p?.telefono ?? '',
    });
  }

  borrar(): void {
    this.profileStore.clear();
    this.form.reset({
      usuario: '',
      email: '',
      nombreCompleto: '',
      direccion: '',
      fechaNacimiento: '',
      telefono: '',
    });
  }
}

