import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

// 沒登入會被踢回 /login
export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  // 直接問 Supabase 一次,確保 App 剛啟動還沒 hydrate 也能正確判斷
  const user = await auth.getCurrentUser();
  if (user) return true;

  router.navigate(['/login']);
  return false;
};
