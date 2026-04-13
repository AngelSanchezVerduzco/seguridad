import 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    userId?: string;
    userLabel?: string;
  }
}

export {};
