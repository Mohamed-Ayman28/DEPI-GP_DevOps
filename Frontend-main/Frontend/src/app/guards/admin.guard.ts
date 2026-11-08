import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isAuthenticated()) {
    return router.createUrlTree(['/admin/login']);
  }

  return auth.verifyAdminSession().pipe(
    map(isAdmin => isAdmin ? true : router.createUrlTree(['/admin/login']))
  );
};
