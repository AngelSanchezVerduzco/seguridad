import { supabaseAdmin, supabasePublic } from '../db/supabase';
import type { PermissionCode } from '../constants/permissions';

type RegisterInput = {
  email: string;
  password: string;
  confirmPassword: string;
  usuario: string;
  nombreCompleto: string;
  direccion: string;
  fechaNacimiento: string;
  telefono: string;
};

type LoginInput = {
  email: string;
  password: string;
};

type AddUserInput = {
  email: string;
  password: string;
  nombre: string;
  permissions: PermissionCode[];
};

export type AdminUserDto = {
  id: string;
  email: string;
  nombre: string;
  isAdmin: boolean;
  permissions: string[];
  createdAt: number;
};

export type SelfProfileDto = {
  usuario: string;
  email: string;
  nombreCompleto: string;
  direccion: string;
  fechaNacimiento: string;
  telefono: string;
  isAdmin: boolean;
};

type OwnProfilePatchInput = {
  usuario: string;
  email: string;
  nombreCompleto: string;
  direccion: string;
  fechaNacimiento: string;
  telefono: string;
};

export class UsersService {
  async register(input: RegisterInput) {
    // Validaciones espejo del front (para que la API no acepte payloads inválidos).
    const SIMBOLOS_ESPECIALES = `!@#$%^&*()_+-=[]{}|;':",./<>?`;

    const phone = String(input.telefono ?? '');
    if (!/^[0-9]{1,10}$/.test(phone)) {
      throw new Error('El teléfono debe contener solo dígitos (máximo 10).');
    }

    const password = String(input.password ?? '');
    const confirmPassword = String(input.confirmPassword ?? '');
    if (password !== confirmPassword) {
      throw new Error('La confirmación de contraseña no coincide.');
    }
    if (password.length < 10) {
      throw new Error('La contraseña debe tener mínimo 10 caracteres.');
    }
    const tieneSimbolo = [...SIMBOLOS_ESPECIALES].some((c) => password.includes(c));
    if (!tieneSimbolo) {
      throw new Error(`La contraseña debe incluir al menos un símbolo: ${SIMBOLOS_ESPECIALES}`);
    }

    const fechaNacimiento = this.parseBirthDateFromFront(input.fechaNacimiento);
    if (!fechaNacimiento) {
      throw new Error('fechaNacimiento inválida (debe venir como dd/MM/yyyy).');
    }

    // "mayor de edad": replicar la misma lógica del front.
    const hoy = new Date();
    let edad = hoy.getFullYear() - fechaNacimiento.getFullYear();
    const m = hoy.getMonth() - fechaNacimiento.getMonth();
    if (m < 0 || (m === 0 && hoy.getDate() < fechaNacimiento.getDate())) edad--;
    if (edad < 18) {
      throw new Error('Debes ser mayor de edad (18 años).');
    }

    const fechaNacimientoIso = this.toISODate(fechaNacimiento);

    const { data, error } = await supabasePublic.auth.signUp({
      email: input.email,
      password,
    });
    if (error || !data.user) {
      throw new Error(error?.message ?? 'No se pudo registrar usuario');
    }

    const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
      id: data.user.id,
      email: input.email.toLowerCase(),
      usuario: input.usuario,
      nombre_completo: input.nombreCompleto,
      direccion: input.direccion,
      fecha_nacimiento: fechaNacimientoIso,
      telefono: phone,
      is_admin: false,
    });

    if (profileError) {
      throw new Error(`Usuario creado pero falló profile: ${profileError.message}`);
    }

    return { user: data.user, session: data.session };
  }

  async login(input: LoginInput) {
    const { data, error } = await supabasePublic.auth.signInWithPassword({
      email: input.email,
      password: input.password,
    });
    if (error || !data.user || !data.session) {
      throw new Error(error?.message ?? 'Credenciales inválidas');
    }

    const userId = data.user.id;
    const emailNorm = input.email.toLowerCase().trim();

    const pickIsAdmin = (row: Record<string, unknown> | null | undefined): boolean => {
      if (!row || typeof row !== 'object') return false;
      const v = row['is_admin'] ?? row['isAdmin'];
      return v === true || v === 'true' || v === 't' || v === 1;
    };

    const mapProfile = (
      r: Record<string, unknown>,
      fallbackEmail: string,
    ): {
      usuario: string;
      email: string;
      nombreCompleto: string;
      direccion: string;
      fechaNacimiento: string;
      telefono: string;
      isAdmin: boolean;
    } => {
      const fn = r['fecha_nacimiento'];
      return {
        usuario: String(r['usuario'] ?? '').trim(),
        email: String(r['email'] ?? fallbackEmail)
          .trim()
          .toLowerCase(),
        nombreCompleto: String(r['nombre_completo'] ?? '').trim(),
        direccion: String(r['direccion'] ?? '').trim(),
        fechaNacimiento: fn == null ? '' : String(fn),
        telefono: String(r['telefono'] ?? '').trim(),
        isAdmin: pickIsAdmin(r),
      };
    };

    let profileRow: Record<string, unknown> | null = null;

    const byId = await supabaseAdmin
      .from('profiles')
      .select('usuario,email,nombre_completo,direccion,fecha_nacimiento,telefono,is_admin')
      .eq('id', userId)
      .maybeSingle();

    if (byId.error) {
      console.error('[users-service] login profiles por id:', byId.error.message);
    } else if (byId.data && typeof byId.data === 'object') {
      profileRow = byId.data as Record<string, unknown>;
    }

    if (!profileRow) {
      const byEmail = await supabaseAdmin
        .from('profiles')
        .select('usuario,email,nombre_completo,direccion,fecha_nacimiento,telefono,is_admin')
        .eq('email', emailNorm)
        .maybeSingle();
      if (byEmail.error) {
        console.error('[users-service] login profiles por email:', byEmail.error.message);
      } else if (byEmail.data && typeof byEmail.data === 'object') {
        profileRow = byEmail.data as Record<string, unknown>;
      }
    }

    const profile = profileRow ? mapProfile(profileRow, data.user.email ?? emailNorm) : null;
    const isAdmin = profile?.isAdmin === true;

    let permissions: string[] = [];
    if (!isAdmin) {
      try {
        permissions = await this.getPermissionCodesForUser(userId);
      } catch (e) {
        console.error('[users-service] login permisos:', e instanceof Error ? e.message : e);
        permissions = [];
      }
    }

    return {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresIn: data.session.expires_in,
      user: data.user,
      profile,
      isAdmin,
      permissions,
    };
  }

  /** Códigos de permiso asignados en `user_permissions` + `permissions_catalog`. */
  private async getPermissionCodesForUser(userId: string): Promise<string[]> {
    const { data: cat, error: catErr } = await supabaseAdmin.from('permissions_catalog').select('id, code');
    if (catErr) throw new Error(catErr.message);
    const codeByPermId = new Map((cat ?? []).map((c) => [c.id as string, String(c.code)]));

    const { data: upRows, error: upErr } = await supabaseAdmin
      .from('user_permissions')
      .select('permission_id')
      .eq('user_id', userId);
    if (upErr) throw new Error(upErr.message);

    const codes: string[] = [];
    for (const row of upRows ?? []) {
      const code = codeByPermId.get(row.permission_id as string);
      if (code) codes.push(code);
    }
    return codes;
  }

  async addUser(input: AddUserInput) {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: input.email.toLowerCase(),
      password: input.password,
      email_confirm: true,
    });
    if (error || !data.user) {
      throw new Error(error?.message ?? 'No se pudo crear usuario');
    }

    const userId = data.user.id;
    const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
      id: userId,
      email: input.email.toLowerCase(),
      usuario: input.nombre,
      nombre_completo: input.nombre,
      direccion: '',
      fecha_nacimiento: null,
      telefono: '',
      is_admin: false,
    });
    if (profileError) {
      throw new Error(`Usuario creado pero falló profile: ${profileError.message}`);
    }

    await this.setUserPermissions(userId, input.permissions);

    return {
      userId,
      email: input.email.toLowerCase(),
      permissions: input.permissions,
    };
  }

  async listUsersForAdmin(): Promise<AdminUserDto[]> {
    const { data: profiles, error } = await supabaseAdmin
      .from('profiles')
      .select('id,email,usuario,nombre_completo,is_admin')
      .order('email', { ascending: true });
    if (error) throw new Error(error.message);

    const { data: upRows, error: upErr } = await supabaseAdmin
      .from('user_permissions')
      .select('user_id, permission_id');
    if (upErr) throw new Error(upErr.message);

    const { data: cat, error: catErr } = await supabaseAdmin.from('permissions_catalog').select('id, code');
    if (catErr) throw new Error(catErr.message);

    const codeByPermId = new Map((cat ?? []).map((c) => [c.id as string, String(c.code)]));
    const permsByUser = new Map<string, string[]>();
    for (const row of upRows ?? []) {
      const uid = row.user_id as string;
      const pid = row.permission_id as string;
      const code = codeByPermId.get(pid);
      if (!code) continue;
      const list = permsByUser.get(uid) ?? [];
      list.push(code);
      permsByUser.set(uid, list);
    }

    return (profiles ?? []).map((p) => {
      const row = p as Record<string, unknown>;
      const id = String(row['id'] ?? '');
      const email = String(row['email'] ?? '').toLowerCase();
      const usuario = String(row['usuario'] ?? '').trim();
      const nombreCompleto = String(row['nombre_completo'] ?? '').trim();
      const nombre = nombreCompleto || usuario || email;
      const isAdmin = row['is_admin'] === true || row['is_admin'] === 'true' || row['is_admin'] === 1;
      const createdAt = 0;
      return {
        id,
        email,
        nombre,
        isAdmin,
        permissions: permsByUser.get(id) ?? [],
        createdAt,
      };
    });
  }

  async updateUserPermissions(userId: string, permissions: PermissionCode[]): Promise<AdminUserDto> {
    const { data: prof, error } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!prof) throw new Error('Usuario no encontrado');

    await this.setUserPermissions(userId, permissions);
    const list = await this.listUsersForAdmin();
    const one = list.find((u) => u.id === userId);
    if (!one) throw new Error('No se pudo recargar el usuario');
    return one;
  }

  async deleteUser(actorUserId: string, targetUserId: string): Promise<void> {
    if (actorUserId === targetUserId) {
      throw new Error('No puedes eliminar tu propia cuenta');
    }
    const { error } = await supabaseAdmin.auth.admin.deleteUser(targetUserId);
    if (error) throw new Error(error.message);
  }

  /** Actualiza `profiles` (y el email en Auth si cambió). Solo el propio usuario autenticado. */
  async updateOwnProfile(userId: string, input: OwnProfilePatchInput): Promise<SelfProfileDto> {
    const phone = String(input.telefono ?? '').trim();
    if (!/^[0-9]{1,10}$/.test(phone)) {
      throw new Error('El teléfono debe contener solo dígitos (máximo 10).');
    }

    const birthDate = this.parseProfileBirthDateToDate(input.fechaNacimiento);
    if (!birthDate) {
      throw new Error('fechaNacimiento inválida (use dd/MM/yyyy o YYYY-MM-DD).');
    }

    const hoy = new Date();
    let edad = hoy.getFullYear() - birthDate.getFullYear();
    const m = hoy.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && hoy.getDate() < birthDate.getDate())) edad--;
    if (edad < 18) {
      throw new Error('Debes ser mayor de edad (18 años).');
    }

    const fechaNacimientoIso = this.toISODate(birthDate);
    const emailNorm = String(input.email ?? '').toLowerCase().trim();

    const { data: before, error: fetchErr } = await supabaseAdmin
      .from('profiles')
      .select('email')
      .eq('id', userId)
      .maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);
    if (!before) throw new Error('Perfil no encontrado');

    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        usuario: String(input.usuario ?? '').trim(),
        email: emailNorm,
        nombre_completo: String(input.nombreCompleto ?? '').trim(),
        direccion: String(input.direccion ?? '').trim(),
        fecha_nacimiento: fechaNacimientoIso,
        telefono: phone,
      })
      .eq('id', userId);

    if (profileError) throw new Error(profileError.message);

    const prevEmail = String((before as { email?: string }).email ?? '')
      .toLowerCase()
      .trim();
    if (prevEmail !== emailNorm) {
      const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        email: emailNorm,
      });
      if (authErr) throw new Error(authErr.message);
    }

    const { data: row, error: reloadErr } = await supabaseAdmin
      .from('profiles')
      .select('usuario,email,nombre_completo,direccion,fecha_nacimiento,telefono,is_admin')
      .eq('id', userId)
      .maybeSingle();
    if (reloadErr) throw new Error(reloadErr.message);
    if (!row || typeof row !== 'object') throw new Error('No se pudo recargar el perfil');

    return this.mapRowToSelfProfileDto(row as Record<string, unknown>, emailNorm);
  }

  /** Elimina la cuenta del usuario autenticado (Auth + datos enlazados según Supabase). */
  async deleteOwnAccount(userId: string): Promise<void> {
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) throw new Error(error.message);
  }

  private mapRowToSelfProfileDto(r: Record<string, unknown>, fallbackEmail: string): SelfProfileDto {
    const fn = r['fecha_nacimiento'];
    const isAdmin =
      r['is_admin'] === true ||
      r['is_admin'] === 'true' ||
      r['is_admin'] === 't' ||
      r['is_admin'] === 1;
    return {
      usuario: String(r['usuario'] ?? '').trim(),
      email: String(r['email'] ?? fallbackEmail)
        .trim()
        .toLowerCase(),
      nombreCompleto: String(r['nombre_completo'] ?? '').trim(),
      direccion: String(r['direccion'] ?? '').trim(),
      fechaNacimiento: fn == null ? '' : String(fn),
      telefono: String(r['telefono'] ?? '').trim(),
      isAdmin,
    };
  }

  /** Acepta `YYYY-MM-DD` o `dd/MM/yyyy` (como registro). */
  private parseProfileBirthDateToDate(value: string): Date | null {
    const raw = String(value ?? '').trim();
    const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) {
      const year = Number(iso[1]);
      const month = Number(iso[2]);
      const day = Number(iso[3]);
      const date = new Date(year, month - 1, day);
      if (
        date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day
      ) {
        return null;
      }
      return date;
    }
    return this.parseBirthDateFromFront(raw);
  }

  private async setUserPermissions(userId: string, permissions: PermissionCode[]): Promise<void> {
    const { error: deleteError } = await supabaseAdmin.from('user_permissions').delete().eq('user_id', userId);
    if (deleteError) {
      throw new Error(`No se pudieron limpiar permisos previos: ${deleteError.message}`);
    }

    if (permissions.length === 0) return;

    const { data: permissionRows, error: permissionsError } = await supabaseAdmin
      .from('permissions_catalog')
      .select('id, code')
      .in('code', permissions);

    if (permissionsError) {
      throw new Error(`No se pudieron consultar permisos: ${permissionsError.message}`);
    }

    if (!permissionRows || permissionRows.length !== permissions.length) {
      const found = new Set((permissionRows ?? []).map((r) => String(r.code)));
      const faltan = permissions.filter((c) => !found.has(c));
      throw new Error(
        faltan.length
          ? `Permisos no registrados en permissions_catalog: ${faltan.join(', ')}`
          : 'Uno o más permisos no existen en permissions_catalog',
      );
    }

    const rows = permissionRows.map((p) => ({
      user_id: userId,
      permission_id: p.id,
    }));
    const { error: insertError } = await supabaseAdmin.from('user_permissions').insert(rows);
    if (insertError) {
      throw new Error(`No se pudieron asignar permisos: ${insertError.message}`);
    }
  }

  private parseBirthDateFromFront(value: string): Date | null {
    const raw = String(value ?? '').trim();
    const match = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!match) return null;

    const day = Number(match[1]);
    const month = Number(match[2]);
    const year = Number(match[3]);

    const date = new Date(year, month - 1, day);
    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return null;
    }
    return date;
  }

  private toISODate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

export const usersService = new UsersService();
