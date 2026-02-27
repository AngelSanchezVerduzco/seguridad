import { Component } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  AbstractControl,
  ValidationErrors,
  ValidatorFn,
} from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { DatePickerModule } from 'primeng/datepicker';
import { PasswordModule } from 'primeng/password';
import { InputNumberModule } from 'primeng/inputnumber';
import { RouterLink } from '@angular/router';

/** Símbolos especiales permitidos para la contraseña */
const SIMBOLOS_ESPECIALES = '!@#$%^&*()_+-=[]{}|;\':",./<>?';

function passwordFuerte(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const v = control.value as string;
    if (!v) return null;
    if (v.length < 10) {
      return { minlength: { requiredLength: 10 } };
    }
    const tieneSimbolo = [...SIMBOLOS_ESPECIALES].some((c) => v.includes(c));
    if (!tieneSimbolo) {
      return { sinSimbolo: { simbolos: SIMBOLOS_ESPECIALES } };
    }
    return null;
  };
}

function mayorDeEdad(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const fecha = control.value as Date | null;
    if (!fecha) return null;
    const hoy = new Date();
    const nacimiento = new Date(fecha);
    let edad = hoy.getFullYear() - nacimiento.getFullYear();
    const m = hoy.getMonth() - nacimiento.getMonth();
    if (m < 0 || (m === 0 && hoy.getDate() < nacimiento.getDate())) edad--;
    if (edad < 18) {
      return { menorEdad: true };
    }
    return null;
  };
}

function coincidirCon(campo: string): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const form = control.parent;
    if (!form) return null;
    const otro = form.get(campo)?.value;
    if (control.value !== otro) {
      return { noCoincide: true };
    }
    return null;
  };
}

function maxDiezDigitos(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const valor = control.value;
    if (!valor) return null;
    const strValor = String(valor);
    if (strValor.length > 10) {
      return { maxDigitos: { max: 10, actual: strValor.length } };
    }
    return null;
  };
}

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    ButtonModule,
    InputTextModule,
    MessageModule,
    ToastModule,
    DatePickerModule,
    PasswordModule,
    InputNumberModule,
  ],
  providers: [MessageService],
  templateUrl: './register.html',
  styleUrl: './register.css',
})
export class Register {
  form: FormGroup;
  /** Fecha máxima = hoy menos 18 años (solo mayores de edad) */
  maxDate: Date;
  /** Símbolos mostrados en la ayuda de contraseña */
  readonly simbolosEspeciales = SIMBOLOS_ESPECIALES;

  constructor(
    private fb: FormBuilder,
    private messageService: MessageService
  ) {
    const hoy = new Date();
    this.maxDate = new Date(hoy.getFullYear() - 18, hoy.getMonth(), hoy.getDate());

    this.form = this.fb.group({
      usuario: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, passwordFuerte()]],
      confirmPassword: ['', [Validators.required, coincidirCon('password')]],
      nombreCompleto: ['', [Validators.required]],
      direccion: ['', [Validators.required]],
      fechaNacimiento: [null as Date | null, [Validators.required, mayorDeEdad()]],
      telefono: [null as number | null, [Validators.required, maxDiezDigitos()]],
    });

    this.form.get('password')?.valueChanges.subscribe(() => {
      this.form.get('confirmPassword')?.updateValueAndValidity();
    });
  }

  isInvalid(name: string): boolean {
    const c = this.form.get(name);
    return !!c && c.invalid && (c.dirty || c.touched);
  }

  getError(name: string): string {
    const c = this.form.get(name);
    if (!c || !c.errors || !c.touched) return '';
    const e = c.errors;
    if (e['required']) return 'Campo obligatorio.';
    if (e['email']) return 'Correo no válido.';
    if (e['minlength']) return `Mínimo ${e['minlength'].requiredLength} caracteres.`;
    if (e['sinSimbolo']) return `La contraseña debe incluir al menos un símbolo: ${this.simbolosEspeciales}`;
    if (e['menorEdad']) return 'Debes ser mayor de edad (18 años).';
    if (e['noCoincide']) return 'No coincide con la contraseña.';
    if (e['maxDigitos']) return `El teléfono no puede exceder 10 dígitos.`;
    return 'Valor no válido.';
  }

  onSubmit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Formulario incompleto',
        detail: 'Revisa los campos marcados.',
      });
      return;
    }
    this.messageService.add({
      severity: 'success',
      summary: 'Registro enviado',
      detail: 'Datos recibidos correctamente (sin backend por ahora).',
    });
  }
}
