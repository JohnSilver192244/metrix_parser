import crypto from "node:crypto";

if (typeof crypto.getRandomValues !== "function" && crypto.webcrypto) {
  crypto.getRandomValues = crypto.webcrypto.getRandomValues.bind(crypto.webcrypto);
}

const viteCliUrl = new URL("../../../node_modules/vite/bin/vite.js", import.meta.url);

await import(viteCliUrl.href);
