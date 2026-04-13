import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { ProfileStore } from '../services/profile-store';

export const authGuard: CanActivateFn = () => {
  const profileStore = inject(ProfileStore);
  const router = inject(Router);
  if (profileStore.profile()?.email) {
    return true;
  }
  return router.createUrlTree(['/auth/login']);
};
