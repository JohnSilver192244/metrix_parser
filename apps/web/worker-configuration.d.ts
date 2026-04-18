declare module "cloudflare:workers";

declare global {
  var __LOCAL_SUPABASE_URL__: string | undefined;
  var __LOCAL_SUPABASE_SERVICE_ROLE_KEY__: string | undefined;
  var __LOCAL_DISCGOLFMETRIX_BASE_URL__: string | undefined;
  var __LOCAL_DISCGOLFMETRIX_COUNTRY_CODE__: string | undefined;
  var __LOCAL_DISCGOLFMETRIX_API_CODE__: string | undefined;
}
