#!/usr/bin/env node

import fs from "node:fs/promises";

function parseArg(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1) {
    return null;
  }

  return process.argv[index + 1] ?? null;
}

const baselineFile = parseArg("--baseline");
const afterFile = parseArg("--after");

if (!baselineFile || !afterFile) {
  console.error("Usage: node scripts/perf-compare.mjs --baseline <file> --after <file>");
  process.exit(1);
}

function asMap(rows) {
  const result = new Map();

  for (const row of rows ?? []) {
    result.set(row.name, row);
  }

  return result;
}

function compareRows(label, baselineRows, afterRows) {
  const baselineMap = asMap(baselineRows);
  const afterMap = asMap(afterRows);
  const unionKeys = new Set([...baselineMap.keys(), ...afterMap.keys()]);

  const compared = [];
  for (const key of unionKeys) {
    const before = baselineMap.get(key);
    const after = afterMap.get(key);

    const beforeP95 = before?.p95Ms ?? null;
    const afterP95 = after?.p95Ms ?? null;
    const delta =
      beforeP95 !== null && afterP95 !== null
        ? Number((afterP95 - beforeP95).toFixed(2))
        : null;

    compared.push({
      name: key,
      beforeP95,
      afterP95,
      delta,
    });
  }

  compared.sort((left, right) => {
    if (left.delta === null && right.delta === null) {
      return 0;
    }

    if (left.delta === null) {
      return 1;
    }

    if (right.delta === null) {
      return -1;
    }

    return right.delta - left.delta;
  });

  console.log(`\n${label}`);
  for (const row of compared.slice(0, 10)) {
    const baselineLabel = row.beforeP95 === null ? "n/a" : `${row.beforeP95}ms`;
    const afterLabel = row.afterP95 === null ? "n/a" : `${row.afterP95}ms`;
    const deltaLabel = row.delta === null ? "n/a" : `${row.delta}ms`;

    console.log(
      `${row.name} | baseline=${baselineLabel} | after=${afterLabel} | delta=${deltaLabel}`,
    );
  }
}

async function main() {
  const baseline = JSON.parse(await fs.readFile(baselineFile, "utf8"));
  const after = JSON.parse(await fs.readFile(afterFile, "utf8"));

  compareRows(
    "Endpoint p95 delta",
    baseline.requests?.endpointTop10ByP95,
    after.requests?.endpointTop10ByP95,
  );
  compareRows("SQL p95 delta", baseline.sql?.top10ByP95, after.sql?.top10ByP95);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
