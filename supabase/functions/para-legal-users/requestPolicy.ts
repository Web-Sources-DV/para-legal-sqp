export function allowedOrigin(
  origin: string | null,
  configured: string,
): string | null {
  if (!origin) return null;
  const allowed = configured
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return allowed.includes(origin) ? origin : null;
}
export function validUserInput(
  input: unknown,
): input is {
  email: string;
  displayName: string;
  role: "user" | "admin";
  password: string;
} {
  if (!input || typeof input !== "object") return false;
  const value = input as Record<string, unknown>;
  return (
    typeof value.email === "string" &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email) &&
    value.email.length <= 254 &&
    typeof value.displayName === "string" &&
    !!value.displayName.trim() &&
    value.displayName.length <= 120 &&
    ["user", "admin"].includes(String(value.role)) &&
    typeof value.password === "string" &&
    value.password.length >= 12 &&
    value.password.length <= 128
  );
}
