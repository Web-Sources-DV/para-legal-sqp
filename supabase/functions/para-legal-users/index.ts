import { allowedOrigin, validUserInput } from "./requestPolicy.ts";
import { createClient } from "npm:@supabase/supabase-js@2.117.2";

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  const permitted = allowedOrigin(
    origin,
    Deno.env.get("PL_ALLOWED_ORIGINS") ||
      "https://web-sources-dv.github.io,http://localhost:3000,http://127.0.0.1:3000",
  );
  const cors: Record<string, string> = {
    "Access-Control-Allow-Headers":
      "authorization,x-client-info,apikey,content-type",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    Vary: "Origin",
  };
  if (permitted) cors["Access-Control-Allow-Origin"] = permitted;
  const response = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  if (origin && !permitted)
    return response({ error: "Origen no permitido" }, 403);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST")
    return response({ error: "Método no disponible" }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const authorization = req.headers.get("Authorization") || "";
    if (!authorization.startsWith("Bearer "))
      return response({ error: "Sesión requerida" }, 401);
    const caller = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    });
    const { data: identity, error: identityError } =
      await caller.auth.getUser();
    if (identityError || !identity.user)
      return response({ error: "Sesión inválida" }, 401);
    const { data: profile } = await caller
      .from("pl_profiles")
      .select("role,active")
      .eq("id", identity.user.id)
      .single();
    if (!profile?.active || profile.role !== "owner")
      return response(
        { error: "Solo Daryl Villa puede gestionar usuarios" },
        403,
      );
    const text = await req.text();
    if (text.length > 10000)
      return response({ error: "Solicitud demasiado grande" }, 413);
    const input: unknown = JSON.parse(text);
    if (!validUserInput(input))
      return response(
        {
          error:
            "Completa nombre, correo, permiso y contraseña de 12 a 128 caracteres",
        },
        400,
      );
    // Privileged key remains inside the Edge Function. No emails are sent by this endpoint.
    const admin = createClient(
      url,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );
    const email = input.email.trim().toLowerCase();
    let accountId: string | undefined;
    for (let page = 1; ; page++) {
      const { data, error } = await admin.auth.admin.listUsers({
        page,
        perPage: 1000,
      });
      if (error) throw error;
      accountId = data.users.find(
        (user) => user.email?.toLowerCase() === email,
      )?.id;
      if (accountId || data.users.length < 1000) break;
    }
    let created = false;
    if (!accountId) {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password: input.password,
        email_confirm: true,
      });
      if (error || !data.user)
        return response(
          {
            error:
              "No se pudo crear la cuenta. Comprueba el correo y la contraseña.",
          },
          400,
        );
      accountId = data.user.id;
      created = true;
    }
    const { error } = await caller
      .from("pl_profiles")
      .insert({
        id: accountId,
        display_name: input.displayName.trim(),
        role: input.role,
        active: true,
      });
    if (error) {
      // Auth is shared: do not delete an identity another application may use.
      console.error("Para Legal profile creation failed", {
        code: error.code,
        created,
      });
      return response(
        {
          error:
            "La cuenta ya está habilitada o no se pudo guardar su permiso.",
        },
        400,
      );
    }
    return response({ success: true, existingAccount: !created });
  } catch (error) {
    console.error("Para Legal user operation failed", {
      type: error instanceof Error ? error.name : "Unknown",
    });
    return response(
      { error: "No se pudo gestionar la cuenta. Reintenta." },
      500,
    );
  }
});
