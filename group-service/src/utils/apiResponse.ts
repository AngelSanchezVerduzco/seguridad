import type { Response } from 'express';

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
  res: Response<ApiResponseBody<T>>,
  statusCode: number,
  message: string,
  data?: T | T[],
): Response<ApiResponseBody<T>> {
  const dataArr = normalizeData(data);
  const next = mergeMessageIntoFirstData(dataArr, message);
  return res.status(statusCode).json({
    statusCode,
    intOpCode: 0,
    data: next,
  });
}

export function sendError(
  res: Response,
  statusCode: number,
  message: string,
  errors?: string[],
): Response {
  return res.status(statusCode).json({
    statusCode,
    intOpCode: 1,
    data: [{ message, errors }] as unknown as unknown[],
  } as ApiResponseBody<unknown>);
}
