import { Component, signal, inject, effect } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { HttpClient } from '@angular/common/http';
import { PermissionService } from './services/permission.service';
import { ProfileStore } from './services/profile-store';
import { UserAccountStore } from './services/user-account-store';
import { ADMIN_PERMISSIONS, USER_PERMISSIONS } from './services/auth-accounts';

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

  private profileStore = inject(ProfileStore);
  private userAccountStore = inject(UserAccountStore);

  constructor() {
    effect(() => {
      const profile = this.profileStore.profile();
      if (profile?.email) {
        if (profile.isAdmin === true) {
          this.permissionService.setPermissions(ADMIN_PERMISSIONS);
        } else if (profile.permissions !== undefined) {
          this.permissionService.setPermissions(profile.permissions);
        } else {
          const account = this.userAccountStore.getByEmail(profile.email);
          this.permissionService.setPermissions(account?.permissions ?? USER_PERMISSIONS);
        }
        return;
      }
      this.http.get<{ permissions: string[] }>('/assets/permissions.json').subscribe({
        next: (data) => this.permissionService.setPermissions(data.permissions),
        error: () => this.permissionService.setPermissions([]),
      });
    });
  }

  onButtonClick(): void {
    console.log('Botón PrimeNG pulsado');
  }
}
