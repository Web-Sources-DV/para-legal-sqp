import type { Client, Template, GeneratedDocument, Idoneo } from "../types";

export function parseCalendarDate(value: string): Date | null {
  const iso = value.trim().match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  const local = value.trim().match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (!iso && !local) return null;
  const [year, month, day] = iso
    ? [Number(iso[1]), Number(iso[2]), Number(iso[3])]
    : [Number(local![3]), Number(local![2]), Number(local![1])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
    ? date
    : null;
}

export function validateClient(client: Client) {
  if (!client.id || !client.fullName?.trim() || !client.passportNumber?.trim())
    throw new Error("Completa nombre y número de identidad.");
  if (!["pasaporte", "cedula", "dni", "nie", "otro"].includes(client.docType))
    throw new Error("Tipo de documento inválido.");
  for (const field of ["birthDate", "expiryDate", "issueDate"] as const) {
    if (client[field] && !parseCalendarDate(client[field]!))
      throw new Error(`Fecha inválida: ${field}.`);
  }
  if (client.birthDate && +parseCalendarDate(client.birthDate)! > Date.now())
    throw new Error("El nacimiento no puede estar en el futuro.");
  if (
    client.issueDate &&
    client.expiryDate &&
    +parseCalendarDate(client.issueDate)! >
      +parseCalendarDate(client.expiryDate)!
  )
    throw new Error("La emisión debe ser anterior al vencimiento.");
}

export interface Backup {
  lawyers?: Idoneo[];
  version?: string;
  clients: Client[];
  templates: Template[];
  documents: GeneratedDocument[];
}
export function validateBackup(value: unknown): Backup {
  if (!value || typeof value !== "object")
    throw new Error("Respaldo inválido.");
  const backup = value as Backup;
  if (backup.version && !["3.0", "3.0.0", "4.0"].includes(backup.version))
    throw new Error("Versión de respaldo no compatible.");
  for (const key of ["clients", "templates", "documents"] as const) {
    if (!Array.isArray(backup[key])) throw new Error(`Falta la lista ${key}.`);
    const ids = new Set<string>();
    for (const row of backup[key]) {
      if (!row || typeof row.id !== "string" || !row.id || ids.has(row.id))
        throw new Error(`Identificador inválido o repetido en ${key}.`);
      ids.add(row.id);
    }
  }
  backup.clients.forEach(validateClient);
  for (const template of backup.templates) {
    if (
      !template.name?.trim() ||
      !template.fileData ||
      !Array.isArray(template.placeholders)
    )
      throw new Error("Plantilla inválida en el respaldo.");
  }
  for (const document of backup.documents) {
    if (!document.fileName?.trim())
      throw new Error("Documento inválido en el respaldo.");
  }
  if (backup.lawyers !== undefined) {
    if (!Array.isArray(backup.lawyers) || !backup.lawyers.length)
      throw new Error("Lista de letrados inválida.");
    const ids = new Set<string>();
    for (const lawyer of backup.lawyers) {
      if (
        !lawyer.id ||
        ids.has(lawyer.id) ||
        !lawyer.name?.trim() ||
        !lawyer.formalTitle?.trim()
      )
        throw new Error("Letrado inválido o repetido.");
      ids.add(lawyer.id);
    }
  }
  return backup;
}
