# group-service

Microservicio de grupos con Express + Supabase, alineado a los forms actuales del front (`group-crud`).

## Variables de entorno

Copiar `.env.example` a `.env`:

```env
PORT=4002
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
```

## Scripts

```bash
npm install
npm run build
npm run start
```

## Endpoints (vía servicio o gateway)

- `GET /health` (simple)
- `GET /api/groups/health` (formato `statusCode/intOpCode/data`)
- `GET /api/groups` (Bearer)
- `POST /api/groups` (Bearer)
- `GET /api/groups/:id` (Bearer)
- `PATCH /api/groups/:id` (Bearer)
- `DELETE /api/groups/:id` (Bearer)
- `POST /api/groups/:id/members` (Bearer)
- `DELETE /api/groups/:id/members` (Bearer)

## Body create/patch acorde al front

```json
{
  "nivel": "1",
  "autor": "admin@correo.com",
  "nombre": "Grupo soporte",
  "descripcion": "Grupo de soporte",
  "miembros": ["ana@correo.com", "luis"]
}
```

`miembros` se resuelve contra `profiles.email` o `profiles.usuario`; si no existe, retorna error.
