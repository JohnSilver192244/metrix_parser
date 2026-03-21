import assert from "node:assert/strict";
import test from "node:test";
import type { IncomingMessage, ServerResponse } from "node:http";

import { createApiRequestHandler } from "./app";
import { createRouter, type RouteDefinition } from "./lib/router";

async function invokeRequest(path: string, method = "GET") {
  const handler = createApiRequestHandler();
  const headers = new Map<string, string>();
  let body = "";

  const req = {
    method,
    url: path,
    headers: {
      host: "localhost",
    },
  } as IncomingMessage;

  const res = {
    statusCode: 200,
    setHeader(name: string, value: string) {
      headers.set(name, value);
    },
    end(chunk?: string) {
      body = chunk ?? "";
    },
  } as unknown as ServerResponse;

  await handler(req, res);

  return {
    statusCode: res.statusCode,
    headers,
    body,
  };
}

test("GET /health returns the success envelope", async () => {
  const response = await invokeRequest("/health");
  const payload = JSON.parse(response.body) as {
    data: { service: string; status: string; timestamp: string };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(response.headers.get("Content-Type"), "application/json; charset=utf-8");
  assert.equal(payload.data.service, "api");
  assert.equal(payload.data.status, "ok");
  assert.ok(Date.parse(payload.data.timestamp));
});

test("unknown routes return the shared error envelope", async () => {
  const response = await invokeRequest("/missing-route");
  const payload = JSON.parse(response.body) as {
    error: { code: string; message: string };
  };

  assert.equal(response.statusCode, 404);
  assert.equal(response.headers.get("Content-Type"), "application/json; charset=utf-8");
  assert.deepEqual(payload, {
    error: {
      code: "not_found",
      message: "Route not found",
    },
  });
});

test("internal errors are sanitized in the API response", async () => {
  const routes: RouteDefinition[] = [
    {
      method: "GET",
      path: "/boom",
      handler: () => {
        throw new Error("db password leaked");
      },
    },
  ];
  const handler = createRouter(routes);
  const headers = new Map<string, string>();
  let body = "";
  let headersSent = false;
  let writableEnded = false;

  const req = {
    method: "GET",
    url: "/boom",
    headers: { host: "localhost" },
  } as IncomingMessage;

  const res = {
    statusCode: 200,
    get headersSent() {
      return headersSent;
    },
    get writableEnded() {
      return writableEnded;
    },
    setHeader(name: string, value: string) {
      headers.set(name, value);
      headersSent = true;
    },
    end(chunk?: string) {
      body = chunk ?? "";
      writableEnded = true;
    },
  } as unknown as ServerResponse;

  await handler(req, res);

  const payload = JSON.parse(body) as { error: { code: string; message: string } };
  assert.equal(res.statusCode, 500);
  assert.equal(headers.get("Content-Type"), "application/json; charset=utf-8");
  assert.equal(payload.error.code, "internal_error");
  assert.equal(payload.error.message, "Internal server error");
});

test("router does not write a second error response after headers are sent", async () => {
  const routes: RouteDefinition[] = [
    {
      method: "GET",
      path: "/partial",
      handler: ({ res }) => {
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(JSON.stringify({ data: { ok: true } }));
        throw new Error("late failure");
      },
    },
  ];
  const handler = createRouter(routes);
  let writeAttempts = 0;
  let body = "";
  let headersSent = false;
  let writableEnded = false;

  const req = {
    method: "GET",
    url: "/partial",
    headers: { host: "localhost" },
  } as IncomingMessage;

  const res = {
    statusCode: 200,
    get headersSent() {
      return headersSent;
    },
    get writableEnded() {
      return writableEnded;
    },
    setHeader() {
      headersSent = true;
    },
    end(chunk?: string) {
      writeAttempts += 1;
      body = chunk ?? "";
      writableEnded = true;
    },
  } as unknown as ServerResponse;

  await handler(req, res);

  assert.equal(writeAttempts, 1);
  assert.deepEqual(JSON.parse(body), { data: { ok: true } });
});
