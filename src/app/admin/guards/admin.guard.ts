import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';

export const adminGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  
  // Check if user is authenticated
  const token = localStorage.getItem('TOKEN');

  if (!token) {
    router.navigate(['/admin/login']);
    return false;
  }

  // Check if user is admin
  try {
    const accountData = localStorage.getItem('ACCOUNT');
    if (accountData) {
      const user = JSON.parse(accountData);
      if (user.role_id === 1 || user.role === 'Admin') 
      {
        return true;
      }
    }
  } catch (error) {
    console.error('Error parsing user account:', error);
  }

  // Not admin, redirect to client
  router.navigate(['/login']);

  return false;
};

