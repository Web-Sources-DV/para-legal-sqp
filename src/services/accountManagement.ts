import { supabase } from "./supabaseClient";
import { AppUser } from "./accessPolicy";
export async function listAppUsers(): Promise<AppUser[]> {
  const { data, error } = await supabase
    .from("pl_profiles")
    .select("id,display_name,role,active")
    .order("display_name");
  if (error) throw error;
  return (data || []).map((p) => ({
    id: p.id,
    displayName: p.display_name,
    role: p.role,
    active: p.active,
  }));
}
export async function updateAppUser(user: AppUser) {
  const { error, data } = await supabase
    .from("pl_profiles")
    .update({
      display_name: user.displayName,
      role: user.role,
      active: user.active,
    })
    .eq("id", user.id)
    .select("id");
  if (error) throw error;
  if (!data?.length)
    throw new Error(
      "No se pudo modificar la cuenta. La cuenta principal está protegida.",
    );
}
export async function createAppUser(input: {
  email: string;
  displayName: string;
  password: string;
  role: "user" | "admin";
}) {
  const { data, error } = await supabase.functions.invoke("para-legal-users", {
    body: input,
  });
  if (error || data?.error)
    throw new Error(
      data?.error || error?.message || "No se pudo crear el usuario.",
    );
  return data as { success: boolean; existingAccount: boolean };
}
