import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class PermissionService {
  private permissions = signal<string[]>([]);

  setPermissions(perms: string[]) {
    this.permissions.set(perms);
  }

  hasPermission(perm: string): boolean {
    return this.permissions().includes(perm);
  }

  hasAnyPermission(perms: string[]): boolean {
    return perms.some(p => this.hasPermission(p));
  }
}