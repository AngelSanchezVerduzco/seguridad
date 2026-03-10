import { Component, signal, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { HttpClient } from '@angular/common/http';
import { PermissionService } from './services/permission.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ButtonModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('proyecto');

  private http = inject(HttpClient);
  private permissionService = inject(PermissionService);

  constructor() {
    this.loadPermissions();
  }

  onButtonClick(): void {
    console.log('Botón PrimeNG pulsado');
  }

  private loadPermissions(): void {
    this.http.get<{ permissions: string[] }>('/assets/permissions.json').subscribe({
      next: (data) => {
        this.permissionService.setPermissions(data.permissions);
        console.log('Permisos cargados:', data.permissions);
      },
      error: (err) => {
        console.error('Error cargando permisos:', err);
      }
    });
  }
}
