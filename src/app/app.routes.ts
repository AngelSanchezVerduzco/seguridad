import { Routes } from '@angular/router';
import { Login } from './pages/auth/login/login';
import { Register } from './pages/auth/register/register';
import { MainLayout } from './layout/main-layout';
import { Group } from './pages/group/group';
import { GroupCrud } from './pages/group-crud/group-crud';
import { Perfil } from './pages/perfil/perfil';
import { Dashboard } from './pages/dashboard/dashboard';
import { TicketDetail } from './pages/ticket-detail/ticket-detail';
import { UserManagement } from './pages/user-management/user-management';
import { authGuard } from './guards/auth.guard';
import { adminGuard, permissionGuard } from './guards/admin.guard';

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
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        component: Dashboard,
      },
      {
        path: 'group',
        component: Group,
        canActivate: [permissionGuard('groups_view', 'group_view', 'groups_add', 'group_add', 'groups_edit', 'groups_delete')],
      },
      {
        path: 'group/crud',
        component: GroupCrud,
        canActivate: [permissionGuard('groups_view', 'group_view', 'groups_add', 'group_add', 'groups_edit', 'groups_delete')],
      },
      {
        path: 'tickets',
        redirectTo: 'dashboard',
        pathMatch: 'full',
      },
      {
        path: 'tickets/:id',
        component: TicketDetail,
        canActivate: [permissionGuard('tickets_view', 'ticket_view', 'tickets_add', 'ticket_add', 'tickets_edit', 'ticket_edit')],
      },
      {
        path: 'users',
        component: UserManagement,
        canActivate: [adminGuard],
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
