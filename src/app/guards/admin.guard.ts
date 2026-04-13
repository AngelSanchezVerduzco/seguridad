import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { ProfileStore } from '../services/profile-store';
import { PermissionService } from '../services/permission.service';

/** Solo permite acceso a usuarios admin. Si no es admin, redirige al dashboard. */
export const adminGuard: CanActivateFn = () => {
  const profileStore = inject(ProfileStore);
  const router = inject(Router);
  if (profileStore.profile()?.isAdmin === true) {
    return true;
  }
  return router.createUrlTree(['/dashboard']);
};

/** Permite acceso si el usuario tiene al menos uno de los permisos indicados. */
export function permissionGuard(...requiredPerms: string[]): CanActivateFn {
  return () => {
    const permissionService = inject(PermissionService);
    const router = inject(Router);
    if (permissionService.hasAnyPermission(requiredPerms)) {
      return true;
    }
    return router.createUrlTree(['/dashboard']);
  };
}
