import type { NextFunction, Request, Response } from 'express';
import Ajv, { type ErrorObject } from 'ajv';
import addFormats from 'ajv-formats';

import { sendError } from '../utils/apiResponse';

import permissionsSchema from '../schemas/permissions.schema.json';

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
ajv.addSchema(permissionsSchema, 'permissions.schema.json');

function formatErrors(errors: ErrorObject[] | null | undefined): string[] {
  if (!errors) return [];
  return errors.map((error) => {
    const path = error.instancePath || '/';
    return `${path} ${error.message ?? 'valor inválido'}`.trim();
  });
}

export function validateSchema(schema: object) {
  const validate = ajv.compile(schema);
  return (req: Request, res: Response, next: NextFunction) => {
    const ok = validate(req.body);
    if (!ok) {
      const errors = formatErrors(validate.errors);
      return sendError(res, 400, 'Body inválido según JSON Schema', errors);
    }
    return next();
  };
}
