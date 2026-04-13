import { buildApp } from './app';
import { env } from './config/env';

const app = buildApp();

app.listen({ port: env.port, host: '0.0.0.0' }, (err) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
  console.log(`ticket-service escuchando en http://localhost:${env.port}`);
});
