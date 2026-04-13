# ticket-service

Microservicio de tickets con **Fastify**, **Supabase** (service role) y validación **JSON Schema** (Ajv). Mismo formato de respuesta que `users-service`: `statusCode`, `intOpCode`, `data` (éxito); en error `message` y `errors` dentro del primer elemento de `data`.

## Esquema en Supabase (normalizado)

El código está alineado con un modelo en **tres tablas**:

### `public.tickets`

Columnas esperadas (como en Table Editor):

- `id` (uuid), `group_id` (uuid), `titulo`, `descripcion`
- `estado` (enum `ticket_status` o texto compatible con los valores del API)
- `asignado_a_user_id` (uuid, nullable), `asignado_a_text` (text, nullable)
- `prioridad` (enum `ticket_priority` o texto compatible)
- `fecha_limite` (**timestamptz**, nullable)
- `created_by` (uuid), `created_at`, `updated_at`

En el API, `asignadoA` es un solo string: si es un UUID se guarda en `asignado_a_user_id`; si no, en `asignado_a_text`. `fechaLimite` en JSON es **milisegundos epoch**; en BD se guarda como `timestamptz`.

### `ticket_comments` y `ticket_history`

Los comentarios y el historial se leen/escriben en esas tablas. Los nombres de columnas usados en **INSERT** se configuran en **`src/db/ticketRelatedColumns.ts`**. Si PostgREST devuelve error de columna, abre ese archivo y cámbialos a los nombres reales de tu tabla (por ejemplo `message` en lugar de `body`).

### SQL alternativo (solo si partes de cero)

Si aún no tienes tablas, puedes usar un script propio; el antiguo ejemplo con `comentarios`/`historial` en JSON **ya no aplica** a esta versión del servicio.

## Variables de entorno

Copia `.env.example` a `.env` y completa:

- `PORT` — por defecto `4001` (debe coincidir con `TICKET_SERVICE_URL` del gateway).
- `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` — mismos valores que en `users-service`.

## Scripts

```bash
npm install
npm run build
npm run start
```

## Endpoints

- `GET /health` — comprobación simple (`{ ok, service }`), sin formato unificado.
- `GET /api/tickets/health` — health con formato `statusCode` / `intOpCode` / `data` (útil vía gateway).

Rutas con **`Authorization: Bearer <access_token>`** (mismo JWT que login en users):

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/tickets` | Lista; query opcional `?groupId=` |
| POST | `/api/tickets` | Crear (body validado por schema) |
| GET | `/api/tickets/:id` | Detalle |
| PATCH | `/api/tickets/:id` | Actualizar parcial |
| DELETE | `/api/tickets/:id` | Eliminar |
| POST | `/api/tickets/:id/comments` | Agregar comentario `{ "text": "..." }` |

Estados: `Pendiente`, `En progreso`, `Revisión`, `Finalizada`. Prioridades: `Baja`, `Media`, `Alta`. `fechaLimite` es epoch en milisegundos o `null`.

## Gateway

Con `api-gateway` en marcha y `TICKET_SERVICE_URL=http://localhost:4001`, las mismas rutas bajo `/api/tickets` están disponibles en el puerto del gateway (p. ej. `http://localhost:3000/api/tickets/...`).
