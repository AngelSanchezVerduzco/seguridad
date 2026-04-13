import { Component, computed, inject, OnInit } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { PanelMenuModule } from 'primeng/panelmenu';
import { ButtonModule } from 'primeng/button';
import { MenuItem } from 'primeng/api';
import { AuthSession } from '../services/auth-session';
import { GroupStore } from '../services/group-store';
import { TicketStore } from '../services/ticket-store';
import { ProfileStore } from '../services/profile-store';
import { PermissionService } from '../services/permission.service';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterOutlet, PanelMenuModule, ButtonModule],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.css',
})
export class MainLayout implements OnInit {
  appVersion = '0.0.0';
  private readonly permissionService = inject(PermissionService);
  private readonly authSession = inject(AuthSession);
  private readonly groupStore = inject(GroupStore);
  private readonly ticketStore = inject(TicketStore);

  constructor(
    private router: Router,
    private profileStore: ProfileStore
  ) {}

  ngOnInit(): void {
    this.groupStore.refresh().subscribe(() => {
      this.ticketStore.refresh().subscribe();
    });
  }

  /** Menú basado en permisos reales, no en isAdmin. */
  readonly items = computed<MenuItem[]>(() => {
    const perms = this.permissionService.permissions();
    const hasAny = (ps: string[]) => ps.some((p) => perms.includes(p));
    const isAdmin = this.profileStore.profile()?.isAdmin === true;

    const items: MenuItem[] = [
      { label: 'Dashboard', icon: 'pi pi-chart-bar', routerLink: ['/dashboard'] },
    ];

    if (hasAny(['groups_view', 'group_view', 'groups_add', 'group_add', 'groups_edit', 'groups_delete'])) {
      items.push({ label: 'Grupos', icon: 'pi pi-users', routerLink: ['/group/crud'] });
    }
    if (isAdmin) {
      items.push({ label: 'Usuarios', icon: 'pi pi-shield', routerLink: ['/users'] });
    }
    items.push(
      { label: 'Perfil', icon: 'pi pi-user', routerLink: ['/user'] },
      { label: 'Cerrar sesión', icon: 'pi pi-sign-out', command: () => this.logout() },
    );

    return items;
  });

  logout(): void {
    this.authSession.clear();
    this.profileStore.clear();
    this.groupStore.refresh().subscribe();
    this.ticketStore.refresh().subscribe();
    this.router.navigate(['/auth/login']);
  }
}
