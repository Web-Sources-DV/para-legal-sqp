import { Client, Template, GeneratedDocument, DatabaseStats } from '../types';

const STORAGE_KEYS = {
  CLIENTS: 'sqp_clients_v2',
  TEMPLATES: 'sqp_templates_v2',
  DOCUMENTS: 'sqp_generated_docs_v2',
  LAST_BACKUP: 'sqp_last_backup_v2',
};

// Known sample template IDs and client names to purge if present
const SAMPLE_TEMPLATE_IDS = new Set([
  'tpl-poder-especial',
  'tpl-contrato-servicios',
  'tpl-solicitud-residencia',
]);

const SAMPLE_CLIENT_NAMES = new Set([
  'ELENA MORALES VEGA',
  'CARLOS ANDRÉS RESTREPO GÓMEZ',
  'MARIANA SOFIA GONZÁLEZ CRUZ',
  'DAVID MILLER SMITH',
]);

// Initial in-memory & localStorage clean states
const INITIAL_CLIENTS: Client[] = [];
const INITIAL_TEMPLATES: Template[] = [];
const INITIAL_DOCUMENTS: GeneratedDocument[] = [];

// Track database connection status (Firebase removed; operating locally pending new database configuration)
export interface CloudSyncState {
  isConnected: boolean;
  isSyncing: boolean;
  lastSyncTime: string | null;
  cloudTemplatesCount: number;
  cloudClientsCount: number;
  cloudDocumentsCount: number;
  error: string | null;
  provider: 'local' | 'external';
}

let syncState: CloudSyncState = {
  isConnected: true,
  isSyncing: false,
  lastSyncTime: new Date().toLocaleTimeString(),
  cloudTemplatesCount: 0,
  cloudClientsCount: 0,
  cloudDocumentsCount: 0,
  error: null,
  provider: 'local',
};

type SyncListener = (state: CloudSyncState) => void;
const syncListeners: Set<SyncListener> = new Set();

export function subscribeToSyncStatus(listener: SyncListener): () => void {
  syncListeners.add(listener);
  listener(syncState);
  return () => {
    syncListeners.delete(listener);
  };
}

function updateSyncState(partial: Partial<CloudSyncState>) {
  syncState = { ...syncState, ...partial };
  syncListeners.forEach((fn) => {
    try {
      fn(syncState);
    } catch (e) {
      console.error('Error notifying sync listener:', e);
    }
  });
}

// Global data update subscribers (e.g. App component)
type DataUpdateListener = (data: {
  clients: Client[];
  templates: Template[];
  documents: GeneratedDocument[];
  stats: DatabaseStats;
  syncState: CloudSyncState;
}) => void;

const dataUpdateListeners: Set<DataUpdateListener> = new Set();

export function subscribeToDatabaseUpdates(listener: DataUpdateListener): () => void {
  dataUpdateListeners.add(listener);
  // Send current state immediately
  listener({
    clients: getStoredClients(),
    templates: getStoredTemplates(),
    documents: getStoredDocuments(),
    stats: getDatabaseStats(),
    syncState,
  });

  return () => {
    dataUpdateListeners.delete(listener);
  };
}

function notifyDataListeners() {
  const payload = {
    clients: getStoredClients(),
    templates: getStoredTemplates(),
    documents: getStoredDocuments(),
    stats: getDatabaseStats(),
    syncState,
  };
  dataUpdateListeners.forEach((fn) => {
    try {
      fn(payload);
    } catch (e) {
      console.error('Error notifying data update listener:', e);
    }
  });
}

// ----------------------------------------------------
// LOCAL CACHE GETTERS & SETTERS (FAST & OFFLINE-READY)
// ----------------------------------------------------

export function getStoredClients(): Client[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CLIENTS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.CLIENTS, JSON.stringify(INITIAL_CLIENTS));
      return [];
    }
    const parsed: Client[] = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (c) =>
        !c.id.startsWith('sample-') &&
        !SAMPLE_CLIENT_NAMES.has((c.fullName || '').trim().toUpperCase())
    );
  } catch (e) {
    console.error('Error reading clients from storage:', e);
    return [];
  }
}

export function saveClients(clients: Client[]): void {
  const filtered = clients.filter(
    (c) =>
      !c.id.startsWith('sample-') &&
      !SAMPLE_CLIENT_NAMES.has((c.fullName || '').trim().toUpperCase())
  );
  localStorage.setItem(STORAGE_KEYS.CLIENTS, JSON.stringify(filtered));
  updateSyncState({
    cloudClientsCount: filtered.length,
    lastSyncTime: new Date().toLocaleTimeString(),
  });
  notifyDataListeners();
}

export function saveClient(client: Client): Client {
  const clients = getStoredClients();
  const index = clients.findIndex((c) => c.id === client.id);
  const now = new Date().toISOString();

  let updatedClient: Client;
  if (index >= 0) {
    updatedClient = { ...client, updatedAt: now };
    clients[index] = updatedClient;
  } else {
    updatedClient = {
      ...client,
      createdAt: client.createdAt || now,
      updatedAt: now,
    };
    clients.unshift(updatedClient);
  }

  localStorage.setItem(STORAGE_KEYS.CLIENTS, JSON.stringify(clients));
  updateSyncState({
    cloudClientsCount: clients.length,
    lastSyncTime: new Date().toLocaleTimeString(),
  });
  notifyDataListeners();
  return updatedClient;
}

export function deleteClient(id: string): void {
  const clients = getStoredClients().filter((c) => c.id !== id);
  localStorage.setItem(STORAGE_KEYS.CLIENTS, JSON.stringify(clients));
  updateSyncState({
    cloudClientsCount: clients.length,
    lastSyncTime: new Date().toLocaleTimeString(),
  });
  notifyDataListeners();
}

export function clearAllClients(): void {
  localStorage.setItem(STORAGE_KEYS.CLIENTS, JSON.stringify([]));
  updateSyncState({
    cloudClientsCount: 0,
    lastSyncTime: new Date().toLocaleTimeString(),
  });
  notifyDataListeners();
}

export function getStoredTemplates(): Template[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TEMPLATES);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.TEMPLATES, JSON.stringify(INITIAL_TEMPLATES));
      return [];
    }
    const parsed: Template[] = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (tpl) => !tpl.isDefault && !SAMPLE_TEMPLATE_IDS.has(tpl.id)
    );
  } catch (e) {
    console.error('Error reading templates from storage:', e);
    return [];
  }
}

export function saveTemplates(templates: Template[]): void {
  const filtered = templates.filter(
    (tpl) => !tpl.isDefault && !SAMPLE_TEMPLATE_IDS.has(tpl.id)
  );
  localStorage.setItem(STORAGE_KEYS.TEMPLATES, JSON.stringify(filtered));
  updateSyncState({
    cloudTemplatesCount: filtered.length,
    lastSyncTime: new Date().toLocaleTimeString(),
  });
  notifyDataListeners();
}

export function saveTemplate(template: Template): Template {
  const templates = getStoredTemplates();
  const index = templates.findIndex((t) => t.id === template.id);
  const now = new Date().toISOString();

  let updatedTemplate: Template;
  if (index >= 0) {
    updatedTemplate = { ...template, updatedAt: now };
    templates[index] = updatedTemplate;
  } else {
    updatedTemplate = {
      ...template,
      createdAt: template.createdAt || now,
      updatedAt: now,
      usageCount: template.usageCount || 0,
    };
    templates.unshift(updatedTemplate);
  }

  localStorage.setItem(STORAGE_KEYS.TEMPLATES, JSON.stringify(templates));
  updateSyncState({
    cloudTemplatesCount: templates.length,
    lastSyncTime: new Date().toLocaleTimeString(),
  });
  notifyDataListeners();
  return updatedTemplate;
}

export function deleteTemplate(id: string): void {
  const templates = getStoredTemplates().filter((t) => t.id !== id);
  localStorage.setItem(STORAGE_KEYS.TEMPLATES, JSON.stringify(templates));
  updateSyncState({
    cloudTemplatesCount: templates.length,
    lastSyncTime: new Date().toLocaleTimeString(),
  });
  notifyDataListeners();
}

export function getStoredDocuments(): GeneratedDocument[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.DOCUMENTS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.DOCUMENTS, JSON.stringify(INITIAL_DOCUMENTS));
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('Error reading documents from storage:', e);
    return [];
  }
}

export function saveDocumentLog(docItem: GeneratedDocument): void {
  const docs = getStoredDocuments();
  docs.unshift(docItem);
  localStorage.setItem(STORAGE_KEYS.DOCUMENTS, JSON.stringify(docs));

  // Increment template usage locally
  const templates = getStoredTemplates();
  const tpl = templates.find((t) => t.id === docItem.templateId);
  if (tpl) {
    tpl.usageCount = (tpl.usageCount || 0) + 1;
    localStorage.setItem(STORAGE_KEYS.TEMPLATES, JSON.stringify(templates));
  }

  // Increment client document count locally
  const clients = getStoredClients();
  const cli = clients.find((c) => c.id === docItem.clientId);
  if (cli) {
    cli.documentCount = (cli.documentCount || 0) + 1;
    localStorage.setItem(STORAGE_KEYS.CLIENTS, JSON.stringify(clients));
  }

  updateSyncState({
    cloudDocumentsCount: docs.length,
    lastSyncTime: new Date().toLocaleTimeString(),
  });
  notifyDataListeners();
}

export function deleteDocumentLog(id: string): void {
  const docs = getStoredDocuments().filter((d) => d.id !== id);
  localStorage.setItem(STORAGE_KEYS.DOCUMENTS, JSON.stringify(docs));
  updateSyncState({
    cloudDocumentsCount: docs.length,
    lastSyncTime: new Date().toLocaleTimeString(),
  });
  notifyDataListeners();
}

export function clearAllDocuments(): void {
  localStorage.setItem(STORAGE_KEYS.DOCUMENTS, JSON.stringify([]));
  updateSyncState({
    cloudDocumentsCount: 0,
    lastSyncTime: new Date().toLocaleTimeString(),
  });
  notifyDataListeners();
}

export function getDatabaseStats(): DatabaseStats {
  const clients = getStoredClients();
  const templates = getStoredTemplates();
  const docs = getStoredDocuments();
  const lastBackup = localStorage.getItem(STORAGE_KEYS.LAST_BACKUP) || undefined;

  let totalBytes = 0;
  for (const key in localStorage) {
    if (key.startsWith('sqp_')) {
      totalBytes += (localStorage.getItem(key) || '').length * 2;
    }
  }

  return {
    totalClients: clients.length,
    totalTemplates: templates.length,
    totalGeneratedDocs: docs.length,
    lastBackupDate: lastBackup,
    storageUsageEstimateKb: Math.round(totalBytes / 1024),
  };
}

export function exportFullDatabaseJson(): string {
  const clients = getStoredClients();
  const templates = getStoredTemplates();
  const documents = getStoredDocuments();

  const exportObj = {
    appName: 'SQP Legal Consulting · Gestión Documental',
    version: '3.0.0',
    databaseStatus: 'local_storage_ready_for_migration',
    exportedAt: new Date().toISOString(),
    clients,
    templates,
    documents,
  };

  localStorage.setItem(STORAGE_KEYS.LAST_BACKUP, new Date().toISOString());
  return JSON.stringify(exportObj, null, 2);
}

export function importDatabaseJson(jsonString: string): { success: boolean; message: string } {
  try {
    const data = JSON.parse(jsonString);
    if (!data.clients && !data.templates && !data.documents) {
      return {
        success: false,
        message: 'El archivo JSON no contiene una estructura válida de respaldo de SQP Legal.',
      };
    }

    if (Array.isArray(data.clients)) {
      saveClients(data.clients);
    }
    if (Array.isArray(data.templates)) {
      saveTemplates(data.templates);
    }
    if (Array.isArray(data.documents)) {
      localStorage.setItem(STORAGE_KEYS.DOCUMENTS, JSON.stringify(data.documents));
    }

    notifyDataListeners();
    return {
      success: true,
      message: `Base de datos restaurada localmente: ${data.clients?.length || 0} clientes, ${data.templates?.length || 0} plantillas y ${data.documents?.length || 0} documentos.`,
    };
  } catch (err: any) {
    return { success: false, message: `Error al procesar el archivo JSON: ${err.message}` };
  }
}

export function resetDatabaseToDefaults(): void {
  clearEntireDatabase();
}

export function clearEntireDatabase(): void {
  // Clear local storage
  localStorage.setItem(STORAGE_KEYS.CLIENTS, JSON.stringify([]));
  localStorage.setItem(STORAGE_KEYS.TEMPLATES, JSON.stringify([]));
  localStorage.setItem(STORAGE_KEYS.DOCUMENTS, JSON.stringify([]));
  localStorage.removeItem(STORAGE_KEYS.LAST_BACKUP);

  updateSyncState({
    cloudClientsCount: 0,
    cloudTemplatesCount: 0,
    cloudDocumentsCount: 0,
    lastSyncTime: new Date().toLocaleTimeString(),
  });

  notifyDataListeners();
}

// ----------------------------------------------------
// SYNC HOOKS (STANDBY MODE WAITING FOR NEW DATABASE)
// ----------------------------------------------------

export function initializeCloudSync(): () => void {
  // Firebase removed; initialize in local mode and notify current stats
  const clients = getStoredClients();
  const templates = getStoredTemplates();
  const docs = getStoredDocuments();

  updateSyncState({
    isConnected: true,
    isSyncing: false,
    cloudClientsCount: clients.length,
    cloudTemplatesCount: templates.length,
    cloudDocumentsCount: docs.length,
    lastSyncTime: new Date().toLocaleTimeString(),
    error: null,
    provider: 'local',
  });

  notifyDataListeners();

  return () => {
    // No-op cleanup
  };
}

// Force sync method
export async function forceCloudSyncNow(): Promise<{ success: boolean; message: string }> {
  const clients = getStoredClients();
  const templates = getStoredTemplates();
  const docs = getStoredDocuments();

  updateSyncState({
    isConnected: true,
    isSyncing: false,
    cloudClientsCount: clients.length,
    cloudTemplatesCount: templates.length,
    cloudDocumentsCount: docs.length,
    lastSyncTime: new Date().toLocaleTimeString(),
    error: null,
    provider: 'local',
  });
  notifyDataListeners();

  return {
    success: true,
    message: `Almacenamiento local verificado y activo: ${templates.length} plantillas, ${clients.length} clientes y ${docs.length} documentos. Firebase ha sido desvinculado; listo para conectar tu nueva base de datos.`,
  };
}

// Aliases for backwards compatibility
export const getClients = getStoredClients;
export const getTemplates = getStoredTemplates;
export const getGeneratedDocuments = getStoredDocuments;
