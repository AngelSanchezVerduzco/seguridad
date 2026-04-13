import Fastify from 'fastify';
import cors from '@fastify/cors';
import proxy from '@fastify/http-proxy';
import { env } from './config/env';

export function buildApp() {
  const app = Fastify({ logger: true });

  // Por defecto @fastify/cors solo permite GET,HEAD,POST; el front usa PATCH/DELETE en grupos y tickets.
  app.register(cors, {
    origin: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Algunos clientes (PowerShell/Postman) pueden mandar "Expect: 100-continue",
  // que @fastify/http-proxy no soporta en este flujo de proxy.
  app.addHook('onRequest', async (req) => {
    if (req.headers.expect) {
      delete req.headers.expect;
    }
  });

  app.get('/health', async () => {
    return {
      statusCode: 200,
      intOpCode: 0,
      data: [
        {
          service: 'api-gateway',
          usersServiceUrl: env.usersServiceUrl,
        },
      ],
    };
  });

  // Proxy principal activo: USERS microservice
  app.register(proxy, {
    upstream: env.usersServiceUrl,
    prefix: '/api/users',
    rewritePrefix: '/api/users',
    http2: false,
  });

  app.register(proxy, {
    upstream: env.ticketServiceUrl,
    prefix: '/api/tickets',
    rewritePrefix: '/api/tickets',
    http2: false,
  });

  app.register(proxy, {
    upstream: env.groupServiceUrl,
    prefix: '/api/groups',
    rewritePrefix: '/api/groups',
    http2: false,
  });

  return app;
}
