import Ajv, { type ErrorObject } from 'ajv';
import addFormats from 'ajv-formats';
import type { FastifyReply } from 'fastify';
import { sendError } from '../utils/apiResponse';

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

function formatErrors(errors: ErrorObject[] | null | undefined): string[] {
  if (!errors) return [];
  return errors.map((error) => {
    const path = error.instancePath || '/';
    return `${path} ${error.message ?? 'valor inválido'}`.trim();
  });
}

export function compileSchema(schema: object) {
  return ajv.compile(schema);
}

export function validateBodyOrReply<T>(
  reply: FastifyReply,
  validate: ReturnType<typeof ajv.compile>,
  body: unknown,
): body is T {
  const ok = validate(body);
  if (!ok) {
    const errors = formatErrors(validate.errors);
    sendError(reply, 400, 'Body inválido según JSON Schema', errors);
    return false;
  }
  return true;
}
