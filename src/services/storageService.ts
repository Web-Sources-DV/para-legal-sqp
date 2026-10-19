import { normalizeSearchText as normalizeSearch } from "./search";
import { updateLawyers } from "../data/idoneos";
import type { Idoneo } from "../types";
import type {
  Client,
  Template,
  GeneratedDocument,
  DatabaseStats,
} from "../types";
import { publicSupabase as supabase } from "./publicSupabaseClient";

import {
  validateClient,
  validateBackup,
  parseCalendarDate,
} from "./validation";
import {
  uploadPrivateFile,
  downloadPrivateFile,
  blobBase64,
} from "./fileStorage";

export interface CloudSyncState {
  isConnected: boolean;
  isSyncing: boolean;
  lastSyncTime: string | null;
  cloudTemplatesCount: number;
  cloudClientsCount: number;
  cloudDocumentsCount: number;
  error: string | null;
  provider: "local" | "external";
}
let clients: Client[] = [],
  templates: Template[] = [],
  documents: GeneratedDocument[] = [];
let syncState: CloudSyncState = {
  isConnected: false,
  isSyncing: false,
  lastSyncTime: null,
  cloudTemplatesCount: 0,
  cloudClientsCount: 0,
  cloudDocumentsCount: 0,
  error: null,
  provider: "external",
};
type Data = {
  clients: Client[];
  templates: Template[];
  documents: GeneratedDocument[];
  stats: DatabaseStats;
  syncState: CloudSyncState;
};
const listeners = new Set<(data: Data) => void>();
const syncListeners = new Set<(state: CloudSyncState) => void>();
let generation = 0;
let cursor: number | null = null;
let documentAfter = "";
let documentQuery = "";
let documentRequest = 0;
let documentMatches: GeneratedDocument[] | null = null;
const matchesDocument = (document: GeneratedDocument, query: string) =>
  [
    document.title,
    document.clientName,
    document.templateName,
    document.passportNumber,
  ].some((value) =>
    normalizeSearch(value || "").includes(normalizeSearch(query)),
  );
async function scanDocumentMatches(query: string, request: number) {
  const matches: GeneratedDocument[] = [];
  let after = "";
  while (request === documentRequest) {
    const page = await rpc<Row[]>("pl_list_entities", {
      entity: "documents",
      after_id: after,
      page_size: 250,
      query: "",
    });
    if (request !== documentRequest) return [];
    matches.push(
      ...page
        .map((row) => decode<GeneratedDocument>(row))
        .filter((document) => matchesDocument(document, query)),
    );
    if (page.length < 250) break;
    const next = page.at(-1)?.sort_key;
    if (!next || next === after)
      throw new Error(
        "No se pudo avanzar en el historial. Reintenta la búsqueda.",
      );
    after = next;
  }
  return matches;
}
export function getClients() {
  return clients;
}
export function getTemplates() {
  return templates;
}
export function getGeneratedDocuments() {
  return documents;
}
export const getStoredClients = getClients,
  getStoredTemplates = getTemplates,
  getStoredDocuments = getGeneratedDocuments;
export function getDatabaseStats(): DatabaseStats {
  return {
    totalClients: syncState.cloudClientsCount,
    totalTemplates: syncState.cloudTemplatesCount,
    totalGeneratedDocs: syncState.cloudDocumentsCount,
    storageUsageEstimateKb: Math.round(
      JSON.stringify([clients, templates, documents]).length / 1024,
    ),
  };
}
function notify() {
  const data = {
    clients: getClients(),
    templates: getTemplates(),
    documents: getGeneratedDocuments(),
    stats: getDatabaseStats(),
    syncState,
  };
  listeners.forEach((fn) => fn(data));
  syncListeners.forEach((fn) => fn(syncState));
}
export function subscribeToDatabaseUpdates(fn: (data: Data) => void) {
  listeners.add(fn);
  notify();
  return () => {
    listeners.delete(fn);
  };
}
export function subscribeToSyncStatus(fn: (state: CloudSyncState) => void) {
  syncListeners.add(fn);
  fn(syncState);
  return () => {
    syncListeners.delete(fn);
  };
}
async function rpc<T>(
  name: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  const { data, error } = await supabase.rpc(
    name.replace(/^pl_/, "pl_public_"),
    args,
  );
  if (error) throw error;
  return data as T;
}
type Entity = "clients" | "templates" | "documents";
type Row = {
  sort_key?: string;
  id: string;
  payload: Record<string, unknown>;
  revision: number;
  archived: boolean;
  approved: boolean;
};
function decode<T>(row: Row): T {
  const payload = { ...row.payload };
  for (const key of [
    "fullName",
    "firstName",
    "lastName",
    "passportNumber",
    "nationality",
    "issuingCountry",
    "birthDate",
    "expiryDate",
    "sex",
    "title",
    "fileName",
    "clientName",
    "templateName",
    "generatedAt",
    "description",
  ]) {
    if (payload[key] === undefined) payload[key] = "";
    else if (typeof payload[key] !== "string")
      throw new Error(
        `Dato inválido en el registro ${row.id}: ${key}. Revisa el respaldo.`,
      );
  }
  return {
    ...payload,
    id: row.id,
    revision: row.revision,
    archived: row.archived,
    approved: row.approved,
  } as T;
}
async function rows<T>(entity: Entity, query = "", all = true): Promise<T[]> {
  const results: T[] = [];
  const request = documentRequest;
  let after = "";
  do {
    const page = await rpc<Row[]>("pl_list_entities", {
      entity,
      after_id: after,
      page_size: entity === "documents" ? 50 : 100,
      query,
    });
    results.push(...page.map((row) => decode<T>(row)));
    if (entity === "documents" && request === documentRequest && !documentQuery)
      documentAfter = page.at(-1)?.sort_key || page.at(-1)?.id || "";
    if (!all || page.length < 100) return results;
    const next = page.at(-1)!.id;
    if (next === after)
      throw new Error("La paginación no avanzó. Reintenta la carga de datos.");
    after = next;
  } while (true);
}
export async function getClientDocuments(
  clientId: string,
  signal?: AbortSignal,
): Promise<GeneratedDocument[]> {
  const documents: GeneratedDocument[] = [];
  let after = "";
  while (true) {
    if (signal?.aborted)
      throw new DOMException("Consulta cancelada", "AbortError");
    const page = await rpc<Row[]>("pl_list_entities", {
      entity: "documents",
      after_id: after,
      page_size: 250,
      query: "",
    });
    if (signal?.aborted)
      throw new DOMException("Consulta cancelada", "AbortError");
    documents.push(
      ...page
        .filter((row) => row.payload.clientId === clientId)
        .map((row) => decode<GeneratedDocument>(row)),
    );
    if (page.length < 250) return documents;
    const next = page.at(-1)?.sort_key;
    if (!next || next === after)
      throw new Error(
        "No se pudo avanzar en el historial del cliente. Reintenta.",
      );
    after = next;
  }
}
export async function searchClients(query: string) {
  const remote = await rows<Client>("clients", query, false);
  const known = new Map(
    clients
      .filter((client) =>
        [
          client.fullName,
          client.passportNumber,
          client.email,
          client.phone,
        ].some((value) =>
          normalizeSearch(value || "").includes(normalizeSearch(query)),
        ),
      )
      .map((client) => [client.id, client]),
  );
  remote.forEach((client) => known.set(client.id, client));
  return [...known.values()];
}
export async function loadMoreDocuments(query = "") {
  if (normalizeSearch(query) !== normalizeSearch(documentQuery)) return false;
  if (documentMatches) {
    const limit = documents.length + 50;
    documents = documentMatches.slice(0, limit);
    notify();
    return limit < documentMatches.length;
  }
  if (!documentAfter) return false;
  const request = documentRequest;
  const page = await rpc<Row[]>("pl_list_entities", {
    entity: "documents",
    after_id: documentAfter,
    page_size: 50,
    query: "",
  });
  if (request !== documentRequest) return false;
  documentAfter = page.at(-1)?.sort_key || page.at(-1)?.id || "";
  const known = new Set(documents.map((document) => document.id));
  documents = [
    ...documents,
    ...page
      .filter((row) => !known.has(row.id))
      .map((row) => decode<GeneratedDocument>(row)),
  ];
  notify();
  return page.length === 50;
}
export async function searchDocuments(query: string) {
  const request = ++documentRequest;
  documentQuery = query.trim();
  const result = documentQuery
    ? await scanDocumentMatches(documentQuery, request)
    : await rows<GeneratedDocument>("documents", "", false);
  if (request !== documentRequest) return documents;
  documentMatches = documentQuery ? result : null;
  documents = result.slice(0, 50);
  notify();
  return documents;
}

function merge<T extends { id: string }>(
  current: T[],
  updates: T[],
  removed: Set<string>,
): T[] {
  const map = new Map(current.map((item) => [item.id, item]));
  updates.forEach((item) => map.set(item.id, item));
  removed.forEach((id) => map.delete(id));
  return [...map.values()];
}
async function reload(full = false) {
  const ticket = ++generation;
  const historyRequest = documentRequest;
  syncState = { ...syncState, isSyncing: true };
  notify();
  try {
    let nextClients = clients,
      nextTemplates = templates,
      nextDocuments = documentMatches || documents,
      nextCursor = cursor;
    if (full || cursor === null) {
      nextCursor = await rpc<number>("pl_sync_cursor");
      [nextClients, nextTemplates, nextDocuments] = await Promise.all([
        rows<Client>("clients"),
        rows<Template>("templates"),
        documentQuery
          ? scanDocumentMatches(documentQuery, historyRequest)
          : rows<GeneratedDocument>("documents", "", false),
      ]);
    } else {
      type Change = {
        cursor: number;
        entity: Entity;
        id: string;
        record: Row | null;
      };
      let changes: Change[];
      do {
        changes = await rpc<Change[]>("pl_changes", {
          after_cursor: nextCursor,
        });
        for (const entity of ["clients", "templates", "documents"] as const) {
          const selected = changes.filter((change) => change.entity === entity);
          const removed = new Set(
            selected
              .filter((change) => !change.record || change.record.archived)
              .map((change) => change.id),
          );
          const updates = selected
            .filter((change) => change.record && !removed.has(change.id))
            .map((change) => decode<any>(change.record!));
          if (entity === "clients")
            nextClients = merge(nextClients, updates, removed);
          else if (entity === "templates")
            nextTemplates = merge(nextTemplates, updates, removed);
          else nextDocuments = merge(nextDocuments, updates, removed);
        }
        if (changes.length) nextCursor = changes.at(-1)!.cursor;
      } while (changes.length === 1000);
    }
    const staff = await rpc<Idoneo[]>("pl_list_lawyers");
    const counts = await rpc<{
      clients: number;
      templates: number;
      documents: number;
    }>("pl_entity_counts");
    if (ticket !== generation) return;
    if (Array.isArray(staff)) updateLawyers(staff);
    clients = nextClients;
    templates = nextTemplates;
    if (historyRequest === documentRequest) {
      const sorted = nextDocuments.sort((a, b) =>
        b.generatedAt.localeCompare(a.generatedAt),
      );
      documentMatches = documentQuery
        ? sorted.filter((document) => matchesDocument(document, documentQuery))
        : null;
      documents = documentMatches
        ? documentMatches.slice(0, Math.max(50, documents.length))
        : sorted;
    }
    cursor = nextCursor;
    syncState = {
      ...syncState,
      isConnected: true,
      isSyncing: false,
      lastSyncTime: new Date().toLocaleTimeString("es-PA", {
        timeZone: "America/Panama",
      }),
      error: null,
      cloudClientsCount: counts.clients,
      cloudTemplatesCount: counts.templates,
      cloudDocumentsCount: counts.documents,
    };
    notify();
  } catch (error: any) {
    if (ticket !== generation) return;
    syncState = {
      ...syncState,
      isConnected: false,
      isSyncing: false,
      error: error.message,
    };
    notify();
    throw error;
  }
}
export function initializeCloudSync() {
  documentRequest++;
  documentQuery = "";
  documentMatches = null;
  documentAfter = "";
  clients = [];
  templates = [];
  documents = [];
  cursor = null;
  syncState = {
    ...syncState,
    isConnected: false,
    isSyncing: false,
    error: null,
    lastSyncTime: null,
  };
  notify();
  const refresh = () => {
    if (!syncState.isSyncing) void reload().catch(() => {});
  };
  refresh();
  const timer = window.setInterval(refresh, 30000);
  window.addEventListener("focus", refresh);
  return () => {
    generation++;
    clearInterval(timer);
    window.removeEventListener("focus", refresh);
    clients = [];
    templates = [];
    documents = [];
    cursor = null;
    notify();
  };
}
export async function forceCloudSyncNow() {
  try {
    await reload(true);
    return { success: true, message: "Datos compartidos actualizados." };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}
// A confirmed write must not be reported as failed merely because refresh failed.
async function refreshAfterWrite() {
  await reload().catch(() => {});
}
export async function saveClient(client: Client) {
  validateClient(client);
  const payload = { ...client };
  for (const field of ["birthDate", "issueDate", "expiryDate"] as const)
    if (payload[field])
      payload[field] = parseCalendarDate(payload[field]!)!
        .toISOString()
        .slice(0, 10);
  if (payload.passportImageBase64) {
    payload.imagePath = await uploadPrivateFile(
      "clients",
      payload.passportImageBase64,
      crypto.randomUUID(),
    );
    delete payload.passportImageBase64;
  }
  payload.revision = await rpc<number>("pl_save_entity", {
    entity: "clients",
    document: payload,
    expected_revision: client.revision ?? null,
  });
  const previous = clients.findIndex((item) => item.id === payload.id);
  clients =
    previous < 0
      ? [payload, ...clients]
      : clients.map((item) => (item.id === payload.id ? payload : item));
  if (previous < 0)
    syncState = {
      ...syncState,
      cloudClientsCount: syncState.cloudClientsCount + 1,
    };
  notify();
  await refreshAfterWrite();
  return payload;
}
export async function saveTemplate(template: Template) {
  const payload = { ...template };
  if (payload.fileData) {
    payload.filePath = await uploadPrivateFile(
      "templates",
      payload.fileData,
      crypto.randomUUID(),
    );
    delete payload.fileData;
  }
  payload.version = (template.version || 0) + 1;
  payload.revision = await rpc<number>("pl_save_entity", {
    entity: "templates",
    document: payload,
    expected_revision: template.revision ?? null,
  });
  payload.approved = true;
  const previous = templates.findIndex((item) => item.id === payload.id);
  templates =
    previous < 0
      ? [payload, ...templates]
      : templates.map((item) => (item.id === payload.id ? payload : item));
  if (previous < 0)
    syncState = {
      ...syncState,
      cloudTemplatesCount: syncState.cloudTemplatesCount + 1,
    };
  notify();
  await refreshAfterWrite();
  return payload;
}
async function archive(entity: Entity, id: string) {
  const record = (entity === "clients" ? clients : templates).find(
    (item) => item.id === id,
  );
  if (!record?.revision)
    throw new Error("Actualiza el registro antes de archivar.");
  await rpc("pl_archive_entity", {
    entity,
    entity_id: id,
    expected_revision: record.revision,
  });
  await refreshAfterWrite();
}
export async function deleteClient(id: string) {
  await archive("clients", id);
}
export async function deleteTemplate(id: string) {
  await archive("templates", id);
}
export async function approveTemplate(template: Template) {
  await rpc("pl_approve_template", {
    entity_id: template.id,
    expected_revision: template.revision,
  });
  await refreshAfterWrite();
}
export async function saveDocumentLog(doc: GeneratedDocument) {
  if (!doc.filePath && doc.fileBase64)
    doc.filePath = await uploadPrivateFile("documents", doc.fileBase64, doc.id);
  const payload = { ...doc };
  if (payload.filePath) delete payload.fileBase64;
  await rpc("pl_record_document", { document: payload });
  await refreshAfterWrite();
}
export async function deleteDocumentLog(id: string) {
  await rpc("pl_delete_document", { entity_id: id });
  await refreshAfterWrite();
}
export async function updateDocumentLog(doc: GeneratedDocument) {
  await rpc("pl_update_document_title", {
    entity_id: doc.id,
    title: doc.title,
    expected_revision: doc.revision ?? 1,
  });
  await refreshAfterWrite();
}
export async function exportFullDatabaseJson(): Promise<string> {
  throw new Error(
    "Los respaldos se administran fuera de la aplicación pública.",
  );
}
export async function importDatabaseJson(_json: string) {
  return {
    success: false,
    message: "La restauración no está disponible en la aplicación pública.",
  };
}
export async function resetDatabaseToDefaults() {
  throw new Error("El vaciado global no está disponible.");
}
export const clearEntireDatabase = resetDatabaseToDefaults;
export async function downloadLegacyHtml(): Promise<string> {
  throw new Error("La versión HTML anterior fue retirada.");
}
export async function replaceLegacyHtml(_content: string) {
  throw new Error("La versión HTML anterior fue retirada.");
}
