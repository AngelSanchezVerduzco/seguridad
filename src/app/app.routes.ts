import { Routes } from '@angular/router';
import { Login } from './pages/auth/login/login';
import { Register } from './pages/auth/register/register';
import { MainLayout } from './layout/main-layout';
import { Group } from './pages/group/group';
import { GroupCrud } from './pages/group-crud/group-crud';
import { Perfil } from './pages/perfil/perfil';
import { Dashboard } from './pages/dashboard/dashboard';
import { Tickets } from './pages/tickets/tickets';
import { TicketDetail } from './pages/ticket-detail/ticket-detail';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'dashboard',
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
        path: 'dashboard',
        component: Dashboard,
      },
      {
        path: 'group',
        component: Group,
      },
      {
        path: 'group/crud',
        component: GroupCrud,
      },
      {
        path: 'tickets',
        component: Tickets,
      },
      {
        path: 'tickets/:id',
        component: TicketDetail,
      },
      {
        path: 'user',
        component: Perfil,
      },
      {
        path: 'perfil',
        redirectTo: 'user',
      },
    ],
  },
  {
    path: '**',
    redirectTo: '',
  },
];
