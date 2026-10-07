import { parseCalendarDate } from "./validation";
import { calculateAgeFromBirthDate } from "./docxService";
export function evaluateIdentityDocument(
  birthDate: string | undefined,
  expiryDate: string | undefined,
  sex: string | undefined,
  now = new Date(),
) {
  const age = calculateAgeFromBirthDate(birthDate, now);
  const category =
    age === null
      ? ""
      : age < 14
        ? "MENOR"
        : age < 18
          ? "JOVEN"
          : sex === "F"
            ? "MUJER"
            : sex === "M"
              ? "VARÓN"
              : "ADULTO";
  const expiry = parseCalendarDate(expiryDate || "");
  const panamaToday = new Date(now.getTime() - 5 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const status = !expiry
    ? "desconocido"
    : expiry.toISOString().slice(0, 10) < panamaToday
      ? "vencido"
      : "vigente";
  return {
    age,
    category,
    isMinor: age === null ? null : age < 18,
    expiryStatus: status as "desconocido" | "vencido" | "vigente",
  };
}
