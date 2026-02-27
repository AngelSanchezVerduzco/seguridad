import { Routes } from '@angular/router';
import { LandingPages } from './pages/landing-pages/landing-pages';
import { Login } from './pages/auth/login/login';
import { Register } from './pages/auth/register/register';
import { MainLayout } from './layout/main-layout';
import { Home } from './pages/home/home';
import { Group } from './pages/group/group';
import { User } from './pages/user/user';

export const routes: Routes = [
  {
    path: '',
    component: LandingPages,
    pathMatch: 'full',
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
    path: '',
    component: MainLayout,
    children: [
      {
        path: 'home',
        component: Home,
      },
      {
        path: 'group',
        component: Group,
      },
      {
        path: 'user',
        component: User,
      },
    ],
  },
  {
    path: '**',
    redirectTo: '',
  },
];
