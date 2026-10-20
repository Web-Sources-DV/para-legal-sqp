import type { ExtractionResult } from "../types";

const labels = {
  passportNumber: "número de identidad",
  fullName: "nombre completo",
  birthDate: "fecha de nacimiento",
  expiryDate: "vencimiento",
  sex: "sexo",
  nationality: "nacionalidad",
} as const;

// Agreement between passes is evidence, not a guarantee of accuracy.
export function reconcileVisualReadings(readings: Partial<ExtractionResult>[]) {
  const ranked = [...readings].sort(
    (a, b) =>
      Object.keys(labels).filter((key) => b[key as keyof ExtractionResult])
        .length -
      Object.keys(labels).filter((key) => a[key as keyof ExtractionResult])
        .length,
  );
  const result: Partial<ExtractionResult> = { ...ranked[0] };
  const warnings: string[] = [];
  for (const key of Object.keys(labels) as (keyof typeof labels)[]) {
    const votes = new Map<
      string,
      { value: string; count: number; source: Partial<ExtractionResult> }
    >();
    for (const source of ranked) {
      const value = source[key];
      if (!value) continue;
      const normalized = value
        .normalize("NFD")
        .replace(/\p{M}/gu, "")
        .toUpperCase()
        .replace(/[\s.\-’']/g, "");
      const entry = votes.get(normalized);
      if (entry) entry.count++;
      else votes.set(normalized, { value, count: 1, source });
    }
    const winner = [...votes.values()].sort((a, b) => b.count - a.count)[0];
    if (winner) {
      result[key] = winner.value;
      if (key === "fullName") {
        // Keep names from one reading; never assemble a new identity from different passes.
        result.firstName = winner.source.firstName || "";
        result.lastName = winner.source.lastName || "";
      }
    }
    if (votes.size > 1)
      warnings.push(
        `Las lecturas ópticas difieren en ${labels[key]}. Verifica este dato en la imagen original.`,
      );
  }
  // Recover non-identity metadata only; identity fields above have explicit voting.
  for (const source of ranked)
    for (const key of [
      "docType",
      "documentType",
      "issuingCountry",
      "issueDate",
      "placeOfBirth",
    ] as const)
      if (!result[key] && source[key])
        Object.assign(result, { [key]: source[key] });
  return { result, warnings };
}
