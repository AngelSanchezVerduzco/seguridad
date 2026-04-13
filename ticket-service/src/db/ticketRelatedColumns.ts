/**
 * Si PostgREST devuelve error de columna al insertar comentarios o historial,
 * ajusta estos nombres a los de tu tabla en Supabase (Table Editor).
 *
 * Ejemplo mínimo para `ticket_history` (nombres alineados con insertKeys por defecto):
 * - id uuid PK default gen_random_uuid()
 * - ticket_id uuid not null
 * - field text not null
 * - from_value text, to_value text
 * - quien cambió: `by_text` + `by_user_id` (como en tu tabla) o equivalentes
 * - `changed_at` timestamptz (si NOT NULL sin default, se envía en el INSERT)
 */
export const ticketComments = {
  table: 'ticket_comments' as const,
  /** Columnas usadas en INSERT */
  insertKeys: {
    ticketId: 'ticket_id',
    /** Contenido del comentario (en tu esquema: `text`). */
    body: 'text',
    /** Nombre o email visible del autor (en tu esquema: `author_text`). */
    author: 'author_text' as string | null,
    /** UUID del usuario autenticado (en tu esquema: `author_user_id`, no `user_id`). */
    userId: 'author_user_id' as string | null,
  },
};

export const ticketHistory = {
  table: 'ticket_history' as const,
  insertKeys: {
    /** `null` si la PK tiene DEFAULT en BD; si falla el INSERT, pon `'id'` (UUID v4). */
    id: null as string | null,
    ticketId: 'ticket_id',
    field: 'field',
    fromValue: 'from_value',
    toValue: 'to_value',
    /** Email / nombre visible (columna `by_text` en tu esquema). */
    byText: 'by_text' as string | null,
    /** UUID del usuario JWT (columna `by_user_id`). */
    byUserId: 'by_user_id' as string | null,
    /** Coincide con tu columna `changed_at`. */
    changedAt: 'changed_at' as string | null,
  },
};
