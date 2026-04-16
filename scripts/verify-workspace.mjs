import { existsSync, readFileSync } from "node:fs";

const requiredPaths = [
  "apps/web",
  "apps/api",
  "apps/worker",
  "packages/shared-types",
  "packages/shared-utils",
  "supabase",
  "apps/web/src/app/App.tsx",
  "packages/shared-types/src/api/index.ts",
  "packages/shared-utils/src/errors/index.ts",
  "supabase/migrations",
];

for (const target of requiredPaths) {
  if (!existsSync(target)) {
    throw new Error(`Missing required path: ${target}`);
  }
}

const rootPackage = JSON.parse(readFileSync("package.json", "utf8"));
const webPackage = JSON.parse(readFileSync("apps/web/package.json", "utf8"));

if (!Array.isArray(rootPackage.workspaces) || rootPackage.workspaces.length !== 2) {
  throw new Error("Root workspace metadata is invalid.");
}

const expectedWebDeps = ["react", "react-dom"];
for (const dependency of expectedWebDeps) {
  if (!webPackage.dependencies?.[dependency]) {
    throw new Error(`Missing web dependency: ${dependency}`);
  }
}

const expectedWebDevDeps = ["vite", "typescript", "@vitejs/plugin-react"];
for (const dependency of expectedWebDevDeps) {
  if (!webPackage.devDependencies?.[dependency]) {
    throw new Error(`Missing web dev dependency: ${dependency}`);
  }
}

console.log("Workspace skeleton verification passed.");
