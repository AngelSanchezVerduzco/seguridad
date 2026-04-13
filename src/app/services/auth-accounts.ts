/**
 * Cuentas hardcodeadas: permisos por tipo de cuenta.
 * NO son roles, solo conjuntos de permisos.
 */

export const ADMIN_EMAIL = 'admin@admin.com';
export const USER_EMAIL = 'user@user.com';

/** Todos los permisos disponibles (cuenta admin). */
export const ADMIN_PERMISSIONS: string[] = [
  'groups_view',
  'group_view',
  'groups_edit',
  'groups_delete',
  'group_delete',
  'groups_add',
  'group_add',
  'users_view',
  'user_view',
  'users_edit',
  'user_edit',
  'user_delete',
  'user_add',
  'tickets_view',
  'ticket_view',
  'tickets_edit',
  'ticket_edit',
  'ticket_delete',
  'ticket_add',
  'tickets_add',
];

/** Permisos restringidos: solo ver en dashboard el grupo al que lo invitó el admin y sus tickets. */
export const USER_PERMISSIONS: string[] = [
  'groups_view',
  'group_view',
  'tickets_view',
  'ticket_view',
];
