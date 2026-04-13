import dotenv from 'dotenv';

dotenv.config();

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Falta variable de entorno: ${name}`);
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 3000),
  usersServiceUrl: required('USERS_SERVICE_URL'),
  ticketServiceUrl: process.env.TICKET_SERVICE_URL ?? 'http://localhost:4001',
  groupServiceUrl: process.env.GROUP_SERVICE_URL ?? 'http://localhost:4002',
};
