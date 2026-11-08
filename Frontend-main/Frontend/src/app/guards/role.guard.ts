import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService, UserRole } from '../services/auth.service';

export const roleGuard: CanActivateFn = route => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const roles = (route.data['roles'] ?? []) as UserRole[];

  if (!auth.isAuthenticated()) {
    return router.createUrlTree(['/']);
  }
  if (auth.hasRole(roles)) {
    return true;
  }
  return auth.hasRole(['admin'])
    ? router.createUrlTree(['/admin/dashboard'])
    : router.createUrlTree(['/']);
};
