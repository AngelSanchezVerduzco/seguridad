import { Component } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';

/** Símbolos especiales permitidos para la contraseña (mismas reglas que registro) */
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
      return { sinSimbolo: true };
    }
    return null;
  };
}

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [RouterLink, ReactiveFormsModule, ButtonModule, InputTextModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  form: FormGroup;
  readonly simbolosEspeciales = SIMBOLOS_ESPECIALES;

  constructor(private fb: FormBuilder, private router: Router) {
    this.form = this.fb.group({
      email: ['', [Validators.required]],
      password: ['', [Validators.required, passwordFuerte()]],
    });
  }

  isInvalid(name: string): boolean {
    const c = this.form.get(name);
    return !!c && c.invalid && (c.dirty || c.touched);
  }

  onLogin(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      return;
    }
    // Solo front: si cumple las reglas, navega al home.
    this.router.navigate(['/home']);
  }
}
