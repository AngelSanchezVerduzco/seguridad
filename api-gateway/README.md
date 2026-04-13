# api-gateway

Gateway central con Fastify para enrutar tráfico del frontend hacia microservicios.

## Objetivo

- El frontend solo se comunica con `api-gateway`.
- `api-gateway` enruta a microservicios (`users`, `ticket`; `group` pendiente).

## Configuración

1. Copia `.env.example` a `.env`.
2. Define variables:

```env
PORT=3000
USERS_SERVICE_URL=http://localhost:4000
TICKET_SERVICE_URL=http://localhost:4001
GROUP_SERVICE_URL=http://localhost:4002
```

## Scripts

- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run typecheck`

## Endpoints

- `GET /health`
- Proxies activos:
  - `/api/users/*` → `USERS_SERVICE_URL/api/users/*`
  - `/api/tickets/*` → `TICKET_SERVICE_URL/api/tickets/*`
- Placeholder:
  - `GET /api/groups/health`

## Flujo recomendado de pruebas

1. Levantar `users-service` en `http://localhost:4000`.
2. Levantar `ticket-service` en `http://localhost:4001` (crear tabla `tickets` en Supabase; ver `ticket-service/README.md`).
3. Levantar `api-gateway` en `http://localhost:3000`.
4. Probar usuarios:
   - `GET http://localhost:3000/health`
   - `POST http://localhost:3000/api/users/register`
   - `POST http://localhost:3000/api/users/login`
   - `POST http://localhost:3000/api/users/add`
5. Probar tickets (header `Authorization: Bearer <token>` del login):
   - `GET http://localhost:3000/api/tickets/health`
   - `GET http://localhost:3000/api/tickets`
   - `POST http://localhost:3000/api/tickets` (body JSON según schemas en `ticket-service`)

Con esto validas gateway → users y gateway → tickets.
