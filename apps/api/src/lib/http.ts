import type { IncomingMessage, ServerResponse } from "node:http";

import type { ApiMeta } from "@metrix-parser/shared-types";

import type { ApiFailureResponse, ApiSuccessResponse } from "../dto/api";
import { HttpError } from "./http-errors";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
};

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

export function sendNoContent(res: ServerResponse, statusCode = 204): void {
  res.statusCode = statusCode;
  setCorsHeaders(res);
  res.end();
}

export function setCorsHeaders(res: ServerResponse): void {
  for (const [name, value] of Object.entries(CORS_HEADERS)) {
    res.setHeader(name, value);
  }
}

export async function readJsonBody<TBody>(req: IncomingMessage): Promise<TBody> {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }

  if (chunks.length === 0) {
    return {} as TBody;
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as TBody;
  } catch {
    throw new HttpError(400, "invalid_json", "Request body must be valid JSON");
  }
}

function sendJson(
  res: ServerResponse,
  statusCode: number,
  body: ApiSuccessResponse<unknown> | ApiFailureResponse,
): void {
  res.statusCode = statusCode;
  setCorsHeaders(res);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}
