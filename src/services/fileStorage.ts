import { publicSupabase as supabase } from "./publicSupabaseClient";

const bucket = "para-legal-private";
export function base64Blob(data: string, type: string): Blob {
  const raw = data.includes(",") ? data.slice(data.indexOf(",") + 1) : data;
  return new Blob(
    [Uint8Array.from(atob(raw), (character) => character.charCodeAt(0))],
    { type },
  );
}
export async function blobBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let text = "";
  for (let i = 0; i < bytes.length; i += 8192)
    text += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(text);
}
export async function uploadPrivateFile(
  entity: "clients" | "templates" | "documents",
  data: string,
  id: string,
): Promise<string> {
  const mime =
    entity === "clients"
      ? data.match(/^data:([^;]+);base64,/)?.[1] || "image/jpeg"
      : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  const blob = base64Blob(data, mime);
  if (blob.size > 15 * 1024 * 1024) throw new Error("El archivo supera 15 MB.");
  const path = `shared/${entity}/${id}`;
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, blob, { contentType: mime, upsert: false });
  if (error) {
    // A retry may follow a committed upload whose response was lost. Never overwrite.
    if (
      !["409", "Duplicate"].includes(
        String(
          (error as { statusCode?: string; error?: string }).statusCode ||
            (error as { error?: string }).error,
        ),
      )
    )
      throw error;
    const existing = await downloadPrivateFile(path);
    const digest = async (value: Blob) =>
      Array.from(
        new Uint8Array(
          await crypto.subtle.digest("SHA-256", await value.arrayBuffer()),
        ),
      ).join(",");
    if ((await digest(existing)) !== (await digest(blob)))
      throw new Error("El archivo existente no coincide. No se sobrescribió.");
  }
  return path;
}
export async function downloadPrivateFile(path: string): Promise<Blob> {
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error) throw error;
  return data;
}
export async function entityFile(
  entity: "clients" | "templates" | "documents",
  id: string,
): Promise<Blob> {
  const { data, error } = await supabase.rpc("pl_public_entity_file", {
    entity,
    entity_id: id,
  });
  if (error) throw error;
  if (data?.path) return downloadPrivateFile(data.path);
  if (!data?.data) throw new Error("El archivo no está disponible.");
  return base64Blob(
    data.data,
    entity === "clients"
      ? "image/jpeg"
      : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  );
}
