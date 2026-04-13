import type { FastifyReply } from 'fastify';

export type ApiResponseBody<T = unknown> = {
  statusCode: number;
  intOpCode: number;
  data: T[];
};

function normalizeData<T>(data: T | T[] | undefined): T[] {
  if (data === undefined) return [];
  if (Array.isArray(data)) return data;
  return [data];
}

function mergeMessageIntoFirstData<T>(dataArray: T[], message?: string): T[] {
  if (!message || dataArray.length === 0) return dataArray;
  const first = dataArray[0];

  if (first !== null && typeof first === 'object' && !Array.isArray(first)) {
    return [{ ...(first as Record<string, unknown>), message }, ...dataArray.slice(1)] as T[];
  }

  return [{ value: first, message } as unknown as T, ...dataArray.slice(1)];
}

export function sendSuccess<T>(
  reply: FastifyReply,
  statusCode: number,
  message: string,
  data?: T | T[],
): FastifyReply {
  const dataArr = normalizeData(data);
  const next = mergeMessageIntoFirstData(dataArr, message);
  return reply.code(statusCode).send({
    statusCode,
    intOpCode: 0,
    data: next,
  } satisfies ApiResponseBody<T>);
}

export function sendError(
  reply: FastifyReply,
  statusCode: number,
  message: string,
  errors?: string[],
): FastifyReply {
  return reply.code(statusCode).send({
    statusCode,
    intOpCode: 1,
    data: [{ message, errors }],
  } satisfies ApiResponseBody<{ message: string; errors?: string[] }>);
}
