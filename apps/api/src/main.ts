import { createServer } from "node:http";

import { loadApiRuntimeEnv } from "./config/env";
import { createApiRequestHandler } from "./app";

const { apiPort } = loadApiRuntimeEnv();
const server = createServer(createApiRequestHandler());
server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;

server.listen(apiPort, () => {
  console.log(
    JSON.stringify({
      service: "api",
      status: "listening",
      port: apiPort,
      databaseBoundary: "supabase-via-api-only",
    }),
  );
});

function shutdown(signal: NodeJS.Signals): void {
  console.log(JSON.stringify({ service: "api", status: "shutting-down", signal }));

  server.close(() => {
    process.exit(0);
  });
}

server.on("error", (error) => {
  console.error(
    JSON.stringify({
      service: "api",
      status: "startup-error",
      message: error.message,
    }),
  );
  process.exit(1);
});

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
