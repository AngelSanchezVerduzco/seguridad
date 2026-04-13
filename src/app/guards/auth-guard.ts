import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { ProfileStore } from '../services/profile-store';

export const authGuard: CanActivateFn = (route, state) => {
  const profileStore = inject(ProfileStore);
  const router = inject(Router);

  if (profileStore.hasProfile()) {
    return true;
  } else {
    router.navigate(['/auth/login']);
    return false;
  }
};
