import { Routes } from '@angular/router';
import { LandingPages } from './pages/landing-pages/landing-pages';
import { Login } from './pages/auth/login/login';
import { Register } from './pages/auth/register/register';

export const routes: Routes = [
  {
    path: '',
    component: LandingPages,
  },
  {
    path: 'auth/login',
    component: Login,
  },
  {
    path: 'auth/register',
    component: Register,
  },
  {
    path: '**',
    redirectTo: '',
  },
];
