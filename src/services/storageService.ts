import { Client, Template, GeneratedDocument, DatabaseStats } from '../types';
import { supabase } from './supabaseClient';
import { getActiveUser } from './authService';
import { canView, canManage } from './accessPolicy';

export interface CloudSyncState {
  isConnected: boolean; isSyncing: boolean; lastSyncTime: string | null;
  cloudTemplatesCount: number; cloudClientsCount: number; cloudDocumentsCount: number;
  error: string | null; provider: 'local' | 'external';
}
let clients: Client[] = [], templates: Template[] = [], documents: GeneratedDocument[] = [];
let syncState: CloudSyncState = { isConnected: false, isSyncing: false, lastSyncTime: null, cloudTemplatesCount: 0, cloudClientsCount: 0, cloudDocumentsCount: 0, error: null, provider: 'external' };
type Data = { clients: Client[]; templates: Template[]; documents: GeneratedDocument[]; stats: DatabaseStats; syncState: CloudSyncState };
const listeners = new Set<(data: Data) => void>();
const syncListeners = new Set<(state: CloudSyncState) => void>();
let generation = 0;
export function getClients() { return getActiveUser()?.active ? clients : []; }
export function getTemplates() { return getActiveUser()?.active ? templates : []; }
export function getGeneratedDocuments() { return canView(getActiveUser(), 'history') ? documents : []; }
export const getStoredClients = getClients, getStoredTemplates = getTemplates, getStoredDocuments = getGeneratedDocuments;
export function getDatabaseStats(): DatabaseStats { return { totalClients: getClients().length, totalTemplates: getTemplates().length, totalGeneratedDocs: getGeneratedDocuments().length, storageUsageEstimateKb: Math.round(JSON.stringify([clients,templates,documents]).length/1024) }; }
function notify() {
  const data = { clients: getClients(), templates: getTemplates(), documents: getGeneratedDocuments(), stats: getDatabaseStats(), syncState };
  listeners.forEach(fn => fn(data)); syncListeners.forEach(fn => fn(syncState));
}
export function subscribeToDatabaseUpdates(fn: (data: Data) => void) { listeners.add(fn); notify(); return () => { listeners.delete(fn); }; }
export function subscribeToSyncStatus(fn: (state: CloudSyncState) => void) { syncListeners.add(fn); fn(syncState); return () => { syncListeners.delete(fn); }; }
function requireOwner() { if (!canManage(getActiveUser(),'database')) throw new Error('Solo Daryl Villa puede modificar la base de datos o el historial.'); }
async function rows<T>(table: string): Promise<T[]> {
  const all: T[] = [];
  for (let page=0; ; page++) {
    const columns=table==='pl_clients'?'payload,document_count':table==='pl_templates'?'payload,usage_count':'payload';
    const { data,error }=await supabase.from(table).select(columns).order('id').range(page*1000,page*1000+999);
    if(error) throw error;
    all.push(...((data || []) as unknown as Array<{payload:object;document_count?:number;usage_count?:number}>).map(row => ({...row.payload,...(table==='pl_clients'?{documentCount:row.document_count}:table==='pl_templates'?{usageCount:row.usage_count}:{})}) as T));
    if ((data?.length || 0) < 1000) return all;
  }
}
async function reload() {
  const ticket = ++generation;
  const user = getActiveUser();
  if (!user?.active) { clients=[]; templates=[]; documents=[]; notify(); return; }
  syncState={...syncState,isSyncing:true}; notify();
  try {
    const [nextClients,nextTemplates,nextDocs]=await Promise.all([rows<Client>('pl_clients'),rows<Template>('pl_templates'),canView(user,'history') ? rows<GeneratedDocument>('pl_documents') : Promise.resolve([])]);
    if(ticket!==generation || getActiveUser()?.id!==user.id) return;
    clients=nextClients; templates=nextTemplates; documents=canView(getActiveUser(),'history') ? nextDocs.sort((a,b)=>b.generatedAt.localeCompare(a.generatedAt)) : [];
    syncState={...syncState,isConnected:true,isSyncing:false,lastSyncTime:new Date().toLocaleTimeString(),error:null,cloudClientsCount:clients.length,cloudTemplatesCount:templates.length,cloudDocumentsCount:documents.length};
    notify();
  } catch(error: any) {
    if(ticket!==generation) return;
    clients=[]; templates=[]; documents=[];
    syncState={...syncState,isConnected:false,isSyncing:false,error:error.message}; notify(); throw error;
  }
}
export function initializeCloudSync() {
  clients=[]; templates=[]; documents=[]; notify();
  const refresh = () => { void reload().catch(()=>{}); };
  refresh(); const timer=window.setInterval(refresh,30000); window.addEventListener('focus',refresh);
  return () => { generation++; clearInterval(timer); window.removeEventListener('focus',refresh); clients=[]; templates=[]; documents=[]; notify(); };
}
export async function forceCloudSyncNow() { try { await reload(); return {success:true,message:'Datos compartidos actualizados desde Supabase.'}; } catch(e: any) { return {success:false,message:e.message}; } }
async function save(table: string, payload: {id:string}) { const {error}=await supabase.from(table).upsert({id:payload.id,payload,updated_at:new Date().toISOString()}); if(error) throw error; await reload(); }
async function remove(table: string,id:string) { const {error}=await supabase.from(table).delete().eq('id',id); if(error) throw error; await reload(); }
export async function saveClient(client: Client) { await save('pl_clients',client); return client; }
export async function saveTemplate(template: Template) { await save('pl_templates',template); return template; }
export async function deleteClient(id:string) { await remove('pl_clients',id); }
export async function deleteTemplate(id:string) { await remove('pl_templates',id); }
export async function saveDocumentLog(doc: GeneratedDocument) {
  const {error}=await supabase.rpc('pl_record_document',{document:doc});
  if(error) throw error;
  await reload();
}
export async function deleteDocumentLog(id:string) { requireOwner(); await remove('pl_documents',id); }
export async function updateDocumentLog(doc: GeneratedDocument) {
  requireOwner();
  const {error,data}=await supabase.from('pl_documents').update({payload:doc}).eq('id',doc.id).select('id');
  if(error) throw error;
  if(!data?.length) throw new Error('El documento ya no existe.');
  await reload();
}
export function exportFullDatabaseJson() { requireOwner(); return JSON.stringify({version:'3.0',exportedAt:new Date().toISOString(),clients,templates,documents},null,2); }
export async function importDatabaseJson(json:string) {
  requireOwner();
  try {
    const backup=JSON.parse(json);
    const {error}=await supabase.rpc('pl_restore_database',{backup});
    if(error) throw error;
    await reload(); return {success:true,message:'Base de datos restaurada. Los usuarios y las estadísticas se conservaron.'};
  } catch(e: any) { return {success:false,message:e.message || 'Respaldo inválido'}; }
}
export async function resetDatabaseToDefaults() { requireOwner(); const result=await importDatabaseJson(JSON.stringify({clients:[],templates:[],documents:[]})); if(!result.success) throw new Error(result.message); }
export const clearEntireDatabase=resetDatabaseToDefaults;
export async function downloadLegacyHtml() {
  if(!canView(getActiveUser(),'legacy')) throw new Error('Acceso denegado');
  const {data,error}=await supabase.from('pl_resources').select('content').eq('id','legacy-html').single();
  if(error?.code === 'PGRST116') throw new Error('El archivo anterior todavía no se ha cargado. Daryl Villa puede cargarlo desde Base de Datos.');
  if(error) throw error;
  return data.content as string;
}
export async function replaceLegacyHtml(content: string) { requireOwner(); if(content.length>2*1024*1024 || !/<html[\s>]/i.test(content)) throw new Error('Selecciona un archivo HTML válido de hasta 2 MB.'); const {error}=await supabase.from('pl_resources').upsert({id:'legacy-html',content,updated_at:new Date().toISOString()}); if(error) throw error; }

