#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

function parseArg(flag, fallback = null) {
  const index = process.argv.indexOf(flag);
  if (index === -1) {
    return fallback;
  }

  return process.argv[index + 1] ?? fallback;
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

const apiBaseUrl = parseArg("--api", "http://127.0.0.1:3001");
const outputPath = parseArg("--out", path.resolve(".omx", "perf", "snapshot.json"));
const runSampleTraffic = hasFlag("--sample-traffic");

const sampleTrafficPaths = [
  "/health",
  "/players",
  "/competitions",
  "/courses",
  "/results",
  "/season-points-table",
  "/seasons",
];

async function requestJson(url, init) {
  const response = await fetch(url, init);
  const body = await response.text();

  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) ${url}: ${body}`);
  }

  return body ? JSON.parse(body) : null;
}

async function resetMetrics() {
  await requestJson(new URL("/health/performance/reset", apiBaseUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  });
}

async function generateSampleTraffic() {
  for (let index = 0; index < 4; index += 1) {
    for (const routePath of sampleTrafficPaths) {
      try {
        await fetch(new URL(routePath, apiBaseUrl));
      } catch {
        // Keep collecting even if one endpoint is unavailable in local runtime.
      }
    }
  }
}

function formatSummaryRows(rows) {
  return rows.map((row) => `${row.name} | p95=${row.p95Ms}ms | avg=${row.avgMs}ms | n=${row.count}`);
}

async function main() {
  await resetMetrics();

  if (runSampleTraffic) {
    await generateSampleTraffic();
  }

  const payload = await requestJson(new URL("/health/performance", apiBaseUrl), {
    method: "GET",
  });

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(payload?.data ?? payload, null, 2));

  const snapshot = payload?.data ?? payload;
  console.log(`Saved snapshot: ${outputPath}`);
  console.log("Top endpoint p95:");
  console.log(formatSummaryRows(snapshot.requests.endpointTop10ByP95).join("\n") || "(no data)");
  console.log("Top SQL p95:");
  console.log(formatSummaryRows(snapshot.sql.top10ByP95).join("\n") || "(no data)");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
