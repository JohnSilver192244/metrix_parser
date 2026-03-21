import type { ServerResponse } from "node:http";

import type { ApiMeta } from "@metrix-parser/shared-types";

import type { ApiFailureResponse, ApiSuccessResponse } from "../dto/api";

export function sendSuccess<TData, TMeta extends ApiMeta = ApiMeta>(
  res: ServerResponse,
  data: TData,
  meta?: TMeta,
  statusCode = 200,
): void {
  const body: ApiSuccessResponse<TData, TMeta> = meta ? { data, meta } : { data };

  sendJson(res, statusCode, body);
}

export function sendError(
  res: ServerResponse,
  error: ApiFailureResponse["error"],
  statusCode: number,
): void {
  const body: ApiFailureResponse = { error };

  sendJson(res, statusCode, body);
}

function sendJson(
  res: ServerResponse,
  statusCode: number,
  body: ApiSuccessResponse<unknown> | ApiFailureResponse,
): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}
