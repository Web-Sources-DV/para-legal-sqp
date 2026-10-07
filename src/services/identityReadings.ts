import type { ExtractionResult } from "../types";
import { buildStructuredDocumentJson } from "./ocrService";
import { evaluateIdentityDocument } from "./identityStatus";
import { determineSexAgeCategory } from "./docxService";
export function mergeIdentityReadings(
  front: ExtractionResult,
  reverse: ExtractionResult,
): ExtractionResult {
  const labels = {
    passportNumber: "número de identidad",
    birthDate: "fecha de nacimiento",
    sex: "sexo",
    expiryDate: "vencimiento",
  };
  for (const key of Object.keys(labels) as (keyof typeof labels)[])
    if (front[key] && reverse[key] && front[key] !== reverse[key])
      throw new Error(
        `El frente y reverso difieren en ${labels[key]}. Confirma que corresponden al mismo documento y vuelve a leer.`,
      );
  const name = (value: string) =>
    value
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .toUpperCase()
      .replace(/[^\p{L} ]/gu, " ")
      .split(/\s+/)
      .filter(Boolean)
      .sort()
      .join(" ");
  if (
    front.fullName &&
    reverse.fullName &&
    name(front.fullName) !== name(reverse.fullName)
  )
    throw new Error(
      "El frente y reverso contienen nombres distintos. Confirma que corresponden a la misma persona.",
    );
  const result = { ...front };
  for (const key of [
    "firstName",
    "lastName",
    "fullName",
    "passportNumber",
    "birthDate",
    "expiryDate",
    "sex",
    "issuingCountry",
    "nationality",
    "issueDate",
    "placeOfBirth",
    "personalNumber",
    "docType",
    "documentType",
    "mrzLine1",
    "mrzLine2",
    "mrzLine3",
  ] as const) {
    if (
      (!result[key] || (key === "docType" && result[key] === "otro")) &&
      reverse[key]
    )
      Object.assign(result, { [key]: reverse[key] });
  }
  result.rawOcrText = [front.rawOcrText, reverse.rawOcrText]
    .filter(Boolean)
    .join("\nREVERSO:\n");
  result.warnings = [
    ...new Set(
      [...(front.warnings || []), ...(reverse.warnings || [])].filter(
        (warning) =>
          !warning.startsWith("Lectura incompleta:") &&
          !warning.startsWith("Vencimiento no detectado:") &&
          !warning.startsWith("DOCUMENTO VENCIDO:"),
      ),
    ),
  ];
  const status = evaluateIdentityDocument(
    result.birthDate,
    result.expiryDate,
    result.sex,
  );
  result.age = status.age ?? undefined;
  result.sexAgeCategory = determineSexAgeCategory(
    result.birthDate,
    result.sex,
  ).category;
  if (
    !result.fullName ||
    !result.passportNumber ||
    !result.birthDate ||
    !result.sex
  )
    result.warnings.push(
      "Lectura incompleta: completa los campos de identidad que faltan antes de guardar.",
    );
  if (status.expiryStatus === "desconocido")
    result.warnings.push(
      "Vencimiento no detectado: comprueba si el documento tiene fecha de caducidad.",
    );
  if (status.expiryStatus === "vencido")
    result.warnings.push(
      "DOCUMENTO VENCIDO: revisa la fecha de vencimiento antes de registrarlo o utilizarlo.",
    );
  result.extractedJson = buildStructuredDocumentJson(result);
  return result;
}
