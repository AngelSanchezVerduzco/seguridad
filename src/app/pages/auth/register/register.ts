import { HttpClient } from '@angular/common/http';
import { Component, inject } from '@angular/core';
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
import { Router } from '@angular/router';
import { API_BASE_URL } from '../../../services/api-config';
import { AuthSession } from '../../../services/auth-session';

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
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly authSession = inject(AuthSession);

  form: FormGroup;
  submitting = false;
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
    if (this.submitting) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Formulario incompleto',
        detail: 'Revisa los campos marcados.',
      });
      return;
    }

    const v = this.form.getRawValue() as {
      usuario: string;
      email: string;
      password: string;
      confirmPassword: string;
      nombreCompleto: string;
      direccion: string;
      fechaNacimiento: Date | null;
      telefono: number | null;
    };

    const fecha =
      v.fechaNacimiento instanceof Date
        ? `${String(v.fechaNacimiento.getDate()).padStart(2, '0')}/${String(
            v.fechaNacimiento.getMonth() + 1
          ).padStart(2, '0')}/${v.fechaNacimiento.getFullYear()}`
        : '';

    const payload = {
      usuario: String(v.usuario ?? '').trim(),
      email: String(v.email ?? '').trim().toLowerCase(),
      password: String(v.password ?? ''),
      confirmPassword: String(v.confirmPassword ?? ''),
      nombreCompleto: String(v.nombreCompleto ?? '').trim(),
      direccion: String(v.direccion ?? '').trim(),
      fechaNacimiento: fecha,
      telefono: v.telefono !== null && v.telefono !== undefined ? String(v.telefono) : '',
    };

    this.submitting = true;
    this.http
      .post<{ statusCode: number; intOpCode: number; data: Array<{ message?: string }> }>(
        `${API_BASE_URL}/api/users/register`,
        payload
      )
      .subscribe({
        next: (res) => {
          this.submitting = false;
          this.authSession.clear();
          this.messageService.add({
            severity: 'success',
            summary: 'Registro exitoso',
            detail: res.data?.[0]?.message ?? 'Cuenta creada correctamente. Inicia sesión.',
          });
          this.form.reset();
          setTimeout(() => this.router.navigate(['/auth/login']), 700);
        },
        error: (err: unknown) => {
          this.submitting = false;
          const msg = this.readRegisterErrorMessage(err);
          // Para depurar: F12 → Consola; verás el cuerpo que devolvió el servidor.
          console.error('[register] error del servidor:', err);
          console.error('[register] mensaje mostrado al usuario:', msg);
          this.messageService.add({
            severity: 'error',
            summary: 'Error en registro',
            detail: msg,
          });
        },
      });
  }

  private readRegisterErrorMessage(err: unknown): string {
    const body = (err as { error?: unknown })?.error;
    if (body && typeof body === 'object' && body !== null && 'data' in body) {
      const row = (body as { data?: Array<{ message?: string }> }).data?.[0];
      if (typeof row?.message === 'string' && row.message.trim()) {
        return this.translateRegisterError(row.message);
      }
    }
    if (typeof body === 'string' && body.trim()) return this.translateRegisterError(body);
    return 'No se pudo completar el registro. Revisa correo, contraseña (10+ caracteres y un símbolo) o si el correo ya está registrado.';
  }

  private translateRegisterError(raw: string): string {
    const m = raw.toLowerCase();
    if (m.includes('rate limit')) {
      return 'Supabase aplicó un límite temporal (muchos intentos de registro). Espera unos minutos o prueba otro correo; si el usuario ya se creó antes, entra con Login.';
    }
    if (m.includes('already') && m.includes('registered')) {
      return 'Ese correo ya está registrado. Usa Iniciar sesión en lugar de registrarte de nuevo.';
    }
    return raw;
  }
}
