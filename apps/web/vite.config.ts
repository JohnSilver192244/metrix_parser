import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    define: {
      "globalThis.__LOCAL_SUPABASE_URL__": JSON.stringify(env.SUPABASE_URL ?? ""),
      "globalThis.__LOCAL_SUPABASE_SERVICE_ROLE_KEY__": JSON.stringify(
        env.SUPABASE_SERVICE_ROLE_KEY ?? "",
      ),
      "globalThis.__LOCAL_DISCGOLFMETRIX_BASE_URL__": JSON.stringify(
        env.DISCGOLFMETRIX_BASE_URL ?? "",
      ),
      "globalThis.__LOCAL_DISCGOLFMETRIX_COUNTRY_CODE__": JSON.stringify(
        env.DISCGOLFMETRIX_COUNTRY_CODE ?? "",
      ),
      "globalThis.__LOCAL_DISCGOLFMETRIX_API_CODE__": JSON.stringify(
        env.DISCGOLFMETRIX_API_CODE ?? "",
      ),
    },
    plugins: [react(), cloudflare()],
    server: {
      port: 5173,
    },
  };
});
