import Fastify from 'fastify';
import cors from '@fastify/cors';
import { ticketsRoutes } from './routes/tickets.routes';

export function buildApp() {
  const app = Fastify({ logger: true });

  app.register(cors, { origin: true });

  app.get('/health', async (_req, reply) => {
    return reply.status(200).send({ ok: true, service: 'ticket-service' });
  });

  app.register(ticketsRoutes);

  return app;
}
