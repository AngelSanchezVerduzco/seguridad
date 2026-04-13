# users-service

Microservicio `USERS` con `Node.js + Express + TypeScript`, conectado a Supabase y validación `JSON Schema` con Ajv.

## Requisitos

- Node.js 18+
- Proyecto Supabase con tablas ya creadas (`profiles`, `permissions_catalog`, `user_permissions`)

## Configuración

1. Copia `.env.example` a `.env`
2. Completa variables:

```env
PORT=4000
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
SUPABASE_SECRET_KEY=sb_secret_xxx
```

## Scripts

- `npm run dev`: ejecución en desarrollo
- `npm run typecheck`: chequeo de tipos
- `npm run build`: compila a `dist`
- `npm run start`: ejecuta build

## Endpoints

Base URL local: `http://localhost:4000`

- `GET /health`
- `POST /api/users/register`
- `POST /api/users/login`
- `POST /api/users/add` (requiere `Authorization: Bearer <token>` y admin)

## JSON Schemas

- `src/schemas/login.schema.json`
- `src/schemas/register.schema.json`
- `src/schemas/add-user.schema.json`
- `src/schemas/permissions.schema.json`

## Ejemplos Postman

### Register

`POST /api/users/register`

```json
{
  "email": "alumno2@demo.com",
  "password": "Demo12345!",
  "usuario": "alumno2",
  "nombreCompleto": "Alumno Dos",
  "direccion": "Av. Demo 555",
  "fechaNacimiento": "2000-01-10",
  "telefono": "1234567890"
}
```

### Login

`POST /api/users/login`

```json
{
  "email": "alumno2@demo.com",
  "password": "Demo12345!"
}
```

### Add User (admin)

`POST /api/users/add`

Header:

`Authorization: Bearer <access_token_admin>`

```json
{
  "email": "operador2@demo.com",
  "password": "Operador12345!",
  "nombre": "Operador Dos",
  "permissions": ["groups_view", "tickets_view", "ticket_view"]
}
```

## Estados esperados

- `200`: login exitoso
- `201`: register/add exitoso
- `400`: body inválido o regla de negocio
- `401`: no autenticado
- `403`: usuario autenticado sin rol admin
