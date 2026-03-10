import { Component } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { PanelMenuModule } from 'primeng/panelmenu';
import { ButtonModule } from 'primeng/button';
import { MenuItem } from 'primeng/api';
import { ProfileStore } from '../services/profile-store';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterOutlet, PanelMenuModule, ButtonModule],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.css',
})
export class MainLayout {
  appVersion = '0.0.0';
  items: MenuItem[] = [
    {
      label: 'Dashboard',
      icon: 'pi pi-chart-bar',
      routerLink: ['/dashboard'],
    },
    {
      label: 'Tickets',
      icon: 'pi pi-ticket',
      routerLink: ['/tickets'],
    },
    {
      label: 'Grupos',
      icon: 'pi pi-users',
      routerLink: ['/group/crud'],
    },
    {
      label: 'Perfil',
      icon: 'pi pi-user',
      routerLink: ['/user'],
    },
    {
      label: 'Cerrar sesión',
      icon: 'pi pi-sign-out',
      command: () => this.logout(),
    },
  ];

  constructor(
    private router: Router,
    private profileStore: ProfileStore
  ) {}

  logout(): void {
    // Al cerrar sesión, reseteamos los datos "de sesión" del perfil.
    this.profileStore.clear();
    this.router.navigate(['/auth/login']);
  }
}
