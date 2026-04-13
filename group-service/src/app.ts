import cors from 'cors';
import express from 'express';
import groupsRoutes from './routes/groups.routes';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.status(200).json({ ok: true, service: 'group-service' });
});

app.use('/api/groups', groupsRoutes);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ message: 'Error interno del servidor' });
});

export default app;
