// Read-only compatibility check. Uses only the browser's public project key.
const url =
  process.env.VITE_SUPABASE_URL || "https://fipcnxfxxngdjunrlbat.supabase.co";
const key =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  "sb_publishable_2cK8fX6MV8F21xLM4A8gMg_hRCp3-9I";
let response;
try {
  response = await fetch(`${url}/rest/v1/rpc/pl_schema_version`, {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: "{}",
    signal: AbortSignal.timeout(20000),
  });
} catch {
  throw new Error(
    "No se pudo consultar Supabase. Verifica la red y la URL del proyecto antes de publicar.",
  );
}
if (!response.ok || (await response.json()) !== 3)
  throw new Error(
    "Deployment blocked: apply the Para Legal v3 public-access migration to Supabase before publishing this frontend. See docs/DEPLOYMENT.md.",
  );
console.log("Supabase schema v3 public-access confirmed.");
