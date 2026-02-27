import { Component } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { PanelMenuModule } from 'primeng/panelmenu';
import { ButtonModule } from 'primeng/button';
import { MenuItem } from 'primeng/api';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, PanelMenuModule, ButtonModule],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home {
  items: MenuItem[] = [
    {
      label: 'Inicio',
      icon: 'pi pi-home',
      routerLink: ['/home'],
    },
    {
      label: 'Perfil',
      icon: 'pi pi-user',
    },
    {
      label: 'Seguridad',
      icon: 'pi pi-shield',
    },
    {
      label: 'Cerrar sesión',
      icon: 'pi pi-sign-out',
      command: () => this.logout(),
    },
  ];

  constructor(private router: Router) {}

  logout(): void {
    this.router.navigate(['/auth/login']);
  }
}
