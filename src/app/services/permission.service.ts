import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class PermissionService {
  /** Signal reactivo: se puede leer en templates y computeds. */
  readonly permissions = signal<string[]>([]);

  setPermissions(perms: string[]) {
    this.permissions.set(perms);
  }

  hasPermission(perm: string): boolean {
    return this.permissions().includes(perm);
  }

  hasAnyPermission(perms: string[]): boolean {
    return perms.some(p => this.permissions().includes(p));
  }
}