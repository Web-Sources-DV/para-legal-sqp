import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  FileText,
  Users,
  Layers,
  Clock,
  Database,
  PlusCircle,
  ShieldAlert,
  HelpCircle,
  Upload,
  CheckCircle,
} from 'lucide-react';
import { Header } from './components/Header';
import { GenerationWizard } from './components/GenerationWizard';
import { DocumentGenerator } from './components/DocumentGenerator';
import { ClientManager } from './components/ClientManager';
import { TemplateManager } from './components/TemplateManager';
import { DocumentHistory } from './components/DocumentHistory';
import { DatabaseSettings } from './components/DatabaseSettings';
import { UserManual } from './components/UserManual';
import {
  getClients,
  getTemplates,
  getGeneratedDocuments,
  getDatabaseStats,
  initializeCloudSync,
  subscribeToDatabaseUpdates,
  CloudSyncState,
} from './services/storageService';
import { Client, Template, GeneratedDocument, DatabaseStats, ActiveTab } from './types';

export function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('wizard');
  const [wizardSession, setWizardSession] = useState(0);
  const [clients, setClients] = useState<Client[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [documents, setDocuments] = useState<GeneratedDocument[]>([]);
  const [stats, setStats] = useState<DatabaseStats>({
    totalClients: 0,
    totalTemplates: 0,
    totalGeneratedDocs: 0,
    storageUsageEstimateKb: 0,
    lastBackupDate: undefined,
  });
  const [syncState, setSyncState] = useState<CloudSyncState>({
    isConnected: true,
    isSyncing: false,
    lastSyncTime: null,
    cloudTemplatesCount: 0,
    cloudClientsCount: 0,
    cloudDocumentsCount: 0,
    error: null,
    provider: 'local',
  });

  const [selectedClientForGenerator, setSelectedClientForGenerator] = useState<Client | null>(null);
  const [selectedTemplateForGenerator, setSelectedTemplateForGenerator] = useState<Template | null>(null);

  // Fallback refresh data from storage
  const refreshData = () => {
    const loadedClients = getClients();
    const loadedTemplates = getTemplates();
    const loadedDocs = getGeneratedDocuments();
    const currentStats = getDatabaseStats();

    setClients(loadedClients);
    setTemplates(loadedTemplates);
    setDocuments(loadedDocs);
    setStats(currentStats);
  };

  useEffect(() => {
    // 1. Initialize storage synchronization and state
    const unsubscribeCloud = initializeCloudSync();

    // 2. Subscribe to storage updates (local cache, ready for new database)
    const unsubscribeUpdates = subscribeToDatabaseUpdates((data) => {
      setClients(data.clients);
      setTemplates(data.templates);
      setDocuments(data.documents);
      setStats(data.stats);
      setSyncState(data.syncState);
    });

    return () => {
      unsubscribeCloud();
      unsubscribeUpdates();
    };
  }, []);

  // Handler to jump to generator with specific client
  const handleGenerateForClient = (client: Client) => {
    setSelectedClientForGenerator(client);
    setActiveTab('generator');
  };

  // Handler to jump to wizard for new passport scanning
  const handleScanForNewClient = () => {
    setWizardSession(session => session + 1);
    setSelectedClientForGenerator(null);
    setActiveTab('wizard');
  };

  // Handler to use a specific template in generator
  const handleUseTemplate = (template: Template) => {
    setSelectedTemplateForGenerator(template);
    setActiveTab('generator');
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-800 antialiased selection:bg-amber-500 selection:text-slate-950">
      {/* Top Professional Legal Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        stats={stats}
        syncState={syncState}
        onStartNewDocument={() => {
          setSelectedClientForGenerator(null);
          setSelectedTemplateForGenerator(null);
          setWizardSession(session => session + 1);
          setActiveTab('wizard');
        }}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tab 1: Guided Wizard */}
        {activeTab === 'wizard' && (
          <GenerationWizard
            key={wizardSession}
            clients={clients}
            templates={templates}
            onClientsChange={refreshData}
            onDocumentGenerated={(doc) => {
              refreshData();
            }}
            onOpenTemplatesTab={() => setActiveTab('templates')}
            onOpenManualTab={() => setActiveTab('manual')}
          />
        )}

        {/* Tab 2: Quick Direct Generator */}
        {activeTab === 'generator' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h2 className="font-serif font-bold text-slate-900 text-xl">
                  Generador Directo de Documentos Word (.docx)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Selecciona un cliente del directorio o usa los datos cargados para generar y descargar inmediatamente cualquier plantilla.
                </p>
              </div>
              <button
                onClick={handleScanForNewClient}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs shadow-sm transition-all"
              >
                <Upload className="w-4 h-4 text-amber-400" />
                <span>Subir / Leer Pasaporte</span>
              </button>
            </div>

            <DocumentGenerator
              clients={clients}
              templates={templates}
              selectedClient={selectedClientForGenerator}
              selectedTemplate={selectedTemplateForGenerator}
              onSelectClient={(cli) => setSelectedClientForGenerator(cli)}
              onDocumentGenerated={() => refreshData()}
              onOpenTemplatesTab={() => setActiveTab('templates')}
            />
          </div>
        )}

        {/* Tab 3: Clients CRM */}
        {activeTab === 'clients' && (
          <ClientManager
            clients={clients}
            documents={documents}
            onClientsChange={refreshData}
            onGenerateForClient={handleGenerateForClient}
            onScanPassportForClient={handleScanForNewClient}
          />
        )}

        {/* Tab 4: Word Templates */}
        {activeTab === 'templates' && (
          <TemplateManager
            templates={templates}
            onTemplatesChange={refreshData}
            onUseTemplate={handleUseTemplate}
          />
        )}

        {/* Tab 5: Generated Documents History */}
        {activeTab === 'history' && (
          <DocumentHistory
            documents={documents}
            templates={templates}
            clients={clients}
            onDocumentsChange={refreshData}
            onSelectClientAndTemplate={(client, template) => {
              setSelectedClientForGenerator(client);
              setSelectedTemplateForGenerator(template);
              setActiveTab('generator');
            }}
          />
        )}

        {/* Tab 6: Local Database Storage & Backups */}
        {activeTab === 'database' && (
          <DatabaseSettings
            stats={stats}
            syncState={syncState}
            onDatabaseReload={refreshData}
          />
        )}

        {/* Tab 7: Comprehensive User Manual */}
        {activeTab === 'manual' && (
          <UserManual onNavigateTab={(tab) => setActiveTab(tab)} />
        )}
      </main>

      {/* Modern Legal Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="font-serif font-bold text-slate-900">
              SQP PARA LEGAL
            </span>
            <span>· Gestión Documental & OCR Pasaportes</span>
          </div>

          <div className="flex items-center gap-6">
            <button
              onClick={() => setActiveTab('manual')}
              className="text-[11px] text-amber-700 hover:text-amber-800 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>📖 Manual de Uso & Guía Paso a Paso</span>
            </button>
            <span className="text-[11px] text-slate-400">
              Datos guardados en <strong className="text-slate-700">este navegador</strong> · Exporta respaldos periódicamente
            </span>
            <span className="text-[11px] text-slate-400">
              Compatibilidad nativa con <strong className="text-slate-700">Microsoft Word (.docx)</strong>
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
