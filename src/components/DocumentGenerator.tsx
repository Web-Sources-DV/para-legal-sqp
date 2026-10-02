import React, { useState, useEffect } from 'react';
import {
  FileText,
  Download,
  CheckCircle2,
  Sparkles,
  Users,
  Calendar,
  AlertCircle,
  FileCheck,
  Tag,
  Eye,
  Sliders,
  RefreshCw,
  FolderOpen,
  Scale,
  Award,
  UserCheck,
  Code,
  Copy,
  Check,
  PenTool,
  AlignLeft,
  AlignCenter,
  MoveHorizontal,
  ChevronDown,
  ChevronUp,
  Columns,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Client, Template, GeneratedDocument, PlaceholderDef, Idoneo, SignatureLayoutOptions } from '../types';
import { generateAndDownloadDocx, determineSexAgeCategory } from '../services/docxService';
import { saveDocumentLog } from '../services/storageService';
import { IDONEOS, DEFAULT_IDONEO, getIdoneoByName } from '../data/idoneos';

interface DocumentGeneratorProps {
  clients: Client[];
  templates: Template[];
  selectedClient?: Client | null;
  selectedTemplate?: Template | null;
  onSelectClient?: (client: Client) => void;
  onDocumentGenerated?: (doc: GeneratedDocument) => void;
  onOpenTemplatesTab?: () => void;
}

export const DocumentGenerator: React.FC<DocumentGeneratorProps> = ({
  clients,
  templates,
  selectedClient: initialClient,
  selectedTemplate: initialTemplate,
  onSelectClient,
  onDocumentGenerated,
  onOpenTemplatesTab,
}) => {
  const [selectedClientId, setSelectedClientId] = useState<string>(initialClient?.id || (clients[0]?.id ?? ''));
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
    initialTemplate?.id || (templates[0]?.id ?? '')
  );

  // Selected Idoneo state
  const [selectedIdoneoId, setSelectedIdoneoId] = useState<string>(() => {
    if (initialTemplate?.idoneo) {
      return getIdoneoByName(initialTemplate.idoneo).id;
    }
    return DEFAULT_IDONEO.id;
  });

  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [customFileName, setCustomFileName] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [lastGeneratedDoc, setLastGeneratedDoc] = useState<GeneratedDocument | null>(null);
  const [generationSuccess, setGenerationSuccess] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showJsonInspector, setShowJsonInspector] = useState<boolean>(false);
  const [copiedJson, setCopiedJson] = useState<boolean>(false);

  const activeClient = clients.find((c) => c.id === selectedClientId) || initialClient || null;
  
  // Find active template (checking direct ID or base template ID)
  const activeTemplate =
    templates.find((t) => t.id === selectedTemplateId) ||
    templates.find((t) => selectedTemplateId.startsWith(t.id)) ||
    initialTemplate ||
    templates[0] ||
    null;

  const activeIdoneo: Idoneo = IDONEOS.find((i) => i.id === selectedIdoneoId) || DEFAULT_IDONEO;

  // Signature positioning and alignment state (Antes de generar)
  const [sigAlignment, setSigAlignment] = useState<'column-left' | 'center' | 'column-right'>('column-left');
  const [sigColumnOffset, setSigColumnOffset] = useState<number>(56); // 56% matching Image 2
  const [sigBlankLines, setSigBlankLines] = useState<number>(2);
  const [sigUseTable, setSigUseTable] = useState<boolean>(true);
  const [customSigClientName, setCustomSigClientName] = useState<string>('');
  const [customSigClientDoc, setCustomSigClientDoc] = useState<string>('');
  const [customSigLawyerTitle, setCustomSigLawyerTitle] = useState<string>('');
  const [customSigLawyerCedula, setCustomSigLawyerCedula] = useState<string>('');
  const [customSigLawyerIdoneidad, setCustomSigLawyerIdoneidad] = useState<string>('');
  const [simulatedNameLength, setSimulatedNameLength] = useState<'actual' | 'short' | 'medium' | 'long' | 'very_long'>('actual');
  const [showVerticalGuide, setShowVerticalGuide] = useState<boolean>(true);
  const [showSigAdvancedConfig, setShowSigAdvancedConfig] = useState<boolean>(false);

  // Synchronize client signature defaults when activeClient changes
  useEffect(() => {
    if (activeClient) {
      setCustomSigClientName(activeClient.fullName.toUpperCase());
      const docLabel = activeClient.docType === 'cedula' ? 'CÉDULA No. ' : 'PASAPORTE No. ';
      const docVal = (activeClient.passportNumber || activeClient.personalNumber || '').toUpperCase();
      setCustomSigClientDoc(docVal ? `${docLabel}${docVal}` : 'PASAPORTE No. ');
    } else {
      setCustomSigClientName('GUSTAVO JOSE ACOSTA MUÑOZ');
      setCustomSigClientDoc('PASAPORTE No. 192629016');
    }
  }, [activeClient]);

  // Synchronize lawyer signature defaults when activeIdoneo changes
  useEffect(() => {
    if (activeIdoneo) {
      setCustomSigLawyerTitle(activeIdoneo.formalTitle.toUpperCase());
      setCustomSigLawyerCedula(activeIdoneo.cedula ? `CÉDULA NO. ${activeIdoneo.cedula.toUpperCase()}` : 'CÉDULA NO. 8-849-2485');
      setCustomSigLawyerIdoneidad(activeIdoneo.idoneidad ? `IDONEIDAD ${activeIdoneo.idoneidad.toUpperCase()}` : 'IDONEIDAD 30553');
    }
  }, [activeIdoneo]);

  // Simulated client name for testing short and long names
  const previewClientName = React.useMemo(() => {
    if (simulatedNameLength === 'short') return 'ANA LI';
    if (simulatedNameLength === 'medium') return 'CARLOS RESTREPO';
    if (simulatedNameLength === 'long') return 'GUSTAVO JOSE ACOSTA MUÑOZ';
    if (simulatedNameLength === 'very_long') return 'MARIA DE LOS ANGELES RESTREPO FERNANDEZ';
    return customSigClientName || (activeClient ? activeClient.fullName.toUpperCase() : 'GUSTAVO JOSE ACOSTA MUÑOZ');
  }, [simulatedNameLength, customSigClientName, activeClient]);

  const previewClientDoc = React.useMemo(() => {
    if (simulatedNameLength === 'short') return 'PASAPORTE No. P8829104';
    return customSigClientDoc || (activeClient?.passportNumber ? `PASAPORTE No. ${activeClient.passportNumber}` : 'PASAPORTE No. 192629016');
  }, [simulatedNameLength, customSigClientDoc, activeClient]);

  // Sync selected client if prop changes
  useEffect(() => {
    if (initialClient?.id) {
      setSelectedClientId(initialClient.id);
    }
  }, [initialClient]);

  // Sync selected template if prop changes
  useEffect(() => {
    if (initialTemplate?.id) {
      setSelectedTemplateId(initialTemplate.id);
      if (initialTemplate.idoneo) {
        setSelectedIdoneoId(getIdoneoByName(initialTemplate.idoneo).id);
      }
    }
  }, [initialTemplate]);

  // Populate mapped form values whenever activeClient, activeTemplate, or activeIdoneo changes
  useEffect(() => {
    if (!activeTemplate) return;

    const initialValues: Record<string, string> = {};

    activeTemplate.placeholders.forEach((placeholderKey) => {
      const cleanKey = placeholderKey.toLowerCase();

      // Find matching definition default if present
      const def = activeTemplate.placeholderDefs?.find((d) => d.key === placeholderKey);
      let val = def?.defaultValue || '';

      // Idóneo specific overrides
      if (
        cleanKey.includes('abogado_nombre') ||
        cleanKey.includes('nombre_abogado') ||
        cleanKey.includes('letrado_nombre') ||
        cleanKey.includes('abogado') ||
        cleanKey.includes('idoneo') ||
        cleanKey.includes('idóneo')
      ) {
        val = activeIdoneo.formalTitle;
      } else if (
        cleanKey.includes('abogado_colegiado') ||
        cleanKey.includes('colegiado') ||
        cleanKey.includes('n_colegiado')
      ) {
        val = activeIdoneo.colegiado;
      }

      if (activeClient) {
        if (cleanKey.includes('cedula/pasaporte') || cleanKey.includes('cédula/pasaporte') || cleanKey.includes('cedula_pasaporte') || cleanKey.includes('tipo_documento') || cleanKey.includes('tipo de documento')) {
          val = activeClient.docType === 'cedula' ? 'Cédula' : activeClient.docType === 'dni' ? 'DNI' : 'Pasaporte';
        } else if (cleanKey.includes('nombre_completo') || cleanKey.includes('fullname') || cleanKey === 'cliente' || cleanKey === 'nombre' || cleanKey === '(nombre)' || cleanKey.includes('nombre')) {
          if (!cleanKey.includes('abogado') && !cleanKey.includes('letrado') && !cleanKey.includes('idoneo')) {
            val = activeClient.fullName || `${activeClient.firstName} ${activeClient.lastName}`.trim();
          }
        } else if (cleanKey.includes('nombres') || cleanKey.includes('firstname')) {
          val = activeClient.firstName || '';
        } else if (cleanKey.includes('apellidos') || cleanKey.includes('lastname')) {
          val = activeClient.lastName || '';
        } else if (
          cleanKey.includes('identidad') ||
          cleanKey.includes('numero de identidad') ||
          cleanKey.includes('número de identidad') ||
          cleanKey.includes('numero_identidad') ||
          cleanKey.includes('pasaporte') ||
          cleanKey.includes('número de pasaporte') ||
          cleanKey.includes('numero de pasaporte') ||
          cleanKey.includes('cedula') ||
          cleanKey.includes('cédula') ||
          cleanKey.includes('documento') ||
          cleanKey.includes('passport') ||
          cleanKey.includes('dni') ||
          cleanKey.includes('nie')
        ) {
          val = activeClient.passportNumber || activeClient.personalNumber || '';
        } else if (cleanKey.includes('nacionalidad') || cleanKey.includes('nationality')) {
          val = activeClient.nationality || '';
        } else if (cleanKey.includes('pais_emisor') || cleanKey.includes('pais') || cleanKey.includes('país')) {
          val = activeClient.issuingCountry || activeClient.nationality || '';
        } else if (cleanKey.includes('fecha_nacimiento') || cleanKey.includes('nacimiento') || cleanKey.includes('birth')) {
          val = activeClient.birthDate || '';
        } else if (cleanKey.includes('vencimiento') || cleanKey.includes('caducidad') || cleanKey.includes('expiry')) {
          val = activeClient.expiryDate || '';
        } else if (
          cleanKey.includes('sexo/edad') ||
          cleanKey.includes('sexo_edad') ||
          cleanKey.includes('sexo-edad') ||
          cleanKey.includes('edad/sexo') ||
          cleanKey.includes('condicion') ||
          cleanKey.includes('condición') ||
          cleanKey.includes('sexo') ||
          cleanKey.includes('genero') ||
          cleanKey.includes('gender')
        ) {
          val = activeClient.sexAgeCategory || determineSexAgeCategory(activeClient.birthDate, activeClient.sex).category;
        } else if (cleanKey.includes('telefono') || cleanKey.includes('phone') || cleanKey.includes('movil')) {
          val = activeClient.phone || '';
        } else if (cleanKey.includes('email') || cleanKey.includes('correo')) {
          val = activeClient.email || '';
        } else if (cleanKey.includes('direccion') || cleanKey.includes('dirección') || cleanKey.includes('domicilio') || cleanKey.includes('address')) {
          val = activeClient.address || '';
        } else if (cleanKey.includes('ciudad') || cleanKey.includes('city')) {
          val = activeClient.city || val || 'Madrid';
        }
      }

      // Date defaults
      if (!val && (cleanKey.includes('fecha_firma') || cleanKey.includes('fecha_solicitud') || cleanKey.includes('fecha_declaracion') || cleanKey === 'fecha')) {
        val = new Date().toLocaleDateString('es-ES', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        });
      }

      if (!val && cleanKey.includes('ciudad')) {
        val = 'Madrid';
      }

      initialValues[placeholderKey] = val;
    });

    setFormValues(initialValues);

    // Default download filename with Idóneo and Client
    if (activeTemplate && activeClient) {
      const cleanTplName = activeTemplate.name.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]/g, '_');
      const cleanCliName = activeClient.fullName.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]/g, '_');
      const cleanIdoneo = activeIdoneo.name.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]/g, '_');
      setCustomFileName(`${cleanTplName}_${cleanIdoneo}_${cleanCliName}.docx`);
    } else if (activeTemplate) {
      setCustomFileName(`${activeTemplate.name.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]/g, '_')}_${activeIdoneo.name.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]/g, '_')}.docx`);
    }
  }, [activeTemplate, activeClient, activeIdoneo]);

  const handleFieldChange = (key: string, value: string) => {
    setFormValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleGenerate = async () => {
    if (!activeTemplate) {
      setErrorMessage('Por favor selecciona una plantilla válida.');
      return;
    }

    setIsGenerating(true);
    setErrorMessage(null);
    setGenerationSuccess(false);

    try {
      const signatureOptions: SignatureLayoutOptions = {
        alignment: sigAlignment,
        columnOffsetPercent: sigColumnOffset,
        signatureBlankLines: sigBlankLines,
        useTwoColumnTable: sigUseTable,
        clientSignatureName: previewClientName,
        clientSignatureDoc: previewClientDoc,
        lawyerSignatureTitle: customSigLawyerTitle,
        lawyerSignatureCedula: customSigLawyerCedula,
        lawyerSignatureIdoneidad: customSigLawyerIdoneidad,
      };

      const result = await generateAndDownloadDocx(
        activeTemplate,
        formValues,
        customFileName,
        activeClient,
        signatureOptions
      );

      // Trigger celebration confetti
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#f59e0b', '#d97706', '#10b981', '#3b82f6'],
        });
      } catch (cErr) {
        // Ignore confetti error
      }

      const newDoc: GeneratedDocument = {
        id: `doc-${Date.now()}`,
        title: `${activeTemplate.name} - ${activeIdoneo.name} (${activeClient ? activeClient.fullName : 'Cliente'})`,
        fileName: result.fileName,
        templateId: activeTemplate.id,
        templateName: activeTemplate.name,
        clientId: activeClient ? activeClient.id : 'sin-cliente',
        clientName: activeClient ? activeClient.fullName : 'CLIENTE DIRECTO',
        passportNumber: activeClient ? activeClient.passportNumber : '',
        generatedAt: new Date().toISOString(),
        fileSizeFormatted: result.sizeFormatted,
        dataSnapshot: { ...formValues, _idoneo: activeIdoneo.name },
      };

      saveDocumentLog(newDoc);
      setLastGeneratedDoc(newDoc);
      setGenerationSuccess(true);

      if (onDocumentGenerated) {
        onDocumentGenerated(newDoc);
      }
    } catch (err: any) {
      console.error('Error generating document:', err);
      setErrorMessage(`Error al generar el archivo Word: ${err.message || 'Comprueba los marcadores de la plantilla'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Selection Box */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-6">
        {/* Idóneo Selector Bar */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Scale className="w-4 h-4 text-amber-600" />
              1. Idóneo / Letrado Responsable del Documento *
            </label>
            <span className="text-[11px] text-amber-800 font-semibold bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
              {activeIdoneo.role}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {IDONEOS.map((idoneo) => {
              const isSelected = idoneo.id === activeIdoneo.id;
              return (
                <button
                  key={idoneo.id}
                  type="button"
                  onClick={() => setSelectedIdoneoId(idoneo.id)}
                  className={`p-2.5 rounded-xl border text-left flex items-center gap-2.5 transition-all ${
                    isSelected
                      ? 'bg-slate-900 text-white border-slate-900 shadow-sm ring-2 ring-amber-500/50'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-[11px] shrink-0 ${
                      isSelected
                        ? 'bg-amber-500 text-slate-950'
                        : 'bg-white text-slate-700 border border-slate-200'
                    }`}
                  >
                    {idoneo.initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className={`font-serif font-bold text-xs block truncate ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                      {idoneo.name}
                    </span>
                    <span className={`text-[10px] block truncate ${isSelected ? 'text-amber-300' : 'text-slate-500'}`}>
                      {idoneo.colegiado.split('·')[0].trim()}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 border-t border-slate-100">
          {/* Client Selector */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-amber-600" />
                2. Cliente Destinatario *
              </label>
              <span className="text-[11px] text-slate-500 font-medium">
                {clients.length} clientes registrados
              </span>
            </div>

            <select
              id="select-client-for-doc"
              value={selectedClientId}
              onChange={(e) => {
                setSelectedClientId(e.target.value);
                const cli = clients.find((c) => c.id === e.target.value);
                if (cli && onSelectClient) onSelectClient(cli);
              }}
              className="w-full text-sm font-semibold p-3 rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500 shadow-sm"
            >
              {clients.length === 0 ? (
                <option value="">(No hay clientes registrados - Escanea o agrega uno)</option>
              ) : (
                clients.map((cli) => (
                  <option key={cli.id} value={cli.id}>
                    👤 {cli.fullName} | {cli.nationality} · Pasaporte: {cli.passportNumber || 'N/A'}
                  </option>
                ))
              )}
            </select>

            {activeClient && (
              <div className="mt-2.5 p-2.5 rounded-lg bg-amber-50/60 border border-amber-200/70 text-xs flex flex-wrap items-center justify-between gap-2 text-slate-700">
                <span>
                  <strong className="text-slate-900">Doc:</strong> {activeClient.passportNumber || 'S/N'} ({activeClient.nationality})
                </span>
                <span>
                  <strong className="text-slate-900">Nacimiento:</strong> {activeClient.birthDate || 'N/A'}
                </span>
                <span>
                  <strong className="text-slate-900">Condición:</strong> {activeClient.sexAgeCategory || 'VARÓN'}
                </span>
              </div>
            )}
          </div>

          {/* Template Selector */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-amber-600" />
                3. Plantilla Word (.docx) *
              </label>
              {onOpenTemplatesTab && (
                <button
                  type="button"
                  onClick={onOpenTemplatesTab}
                  className="text-xs text-amber-700 hover:text-amber-800 font-semibold underline"
                >
                  + Gestionar / Subir Plantillas
                </button>
              )}
            </div>

            <select
              id="select-template-for-doc"
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
              className="w-full text-sm font-semibold p-3 rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500 shadow-sm"
            >
              {templates.length === 0 ? (
                <option value="">(No hay plantillas .docx - Sube una en el menú Plantillas)</option>
              ) : (
                templates.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    📄 {tpl.name} ({tpl.placeholders.length} marcadores)
                  </option>
                ))
              )}
            </select>

            {activeTemplate && (
              <div className="mt-2.5 p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-center justify-between">
                <span className="truncate max-w-xs">{activeTemplate.description}</span>
                <span className="font-mono text-[11px] bg-slate-200 text-slate-800 px-2 py-0.5 rounded font-semibold shrink-0">
                  {activeTemplate.placeholders.length} tags
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Real-time Replacement Inspector Banner */}
        {activeClient && activeTemplate && (
          <div className="pt-6 border-t border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                Vista Previa de Formato Notarial & Letrado Asignado
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-500">
                  Valores que se inyectarán en el documento Word:
                </span>
                <button
                  type="button"
                  onClick={() => setShowJsonInspector((prev) => !prev)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 text-[11px] font-bold border border-amber-300 transition-colors"
                >
                  <Code className="w-3.5 h-3.5 text-amber-600" />
                  <span>{showJsonInspector ? 'Ocultar JSON' : 'Ver JSON (OCR)'}</span>
                </button>
              </div>
            </div>

            {/* Collapsible JSON Viewer */}
            {showJsonInspector && (
              <div className="mb-3 p-3.5 bg-slate-950 rounded-xl border border-slate-800 text-white space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono text-amber-400 font-bold flex items-center gap-1.5">
                    <Code className="w-3.5 h-3.5" />
                    Objeto JSON que alimenta las variables del documento:
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const jsonStr = JSON.stringify(
                        {
                          tipo_documento: activeClient.docType === 'cedula' ? 'Cédula de Identidad' : 'Pasaporte',
                          numero_identidad: (activeClient.passportNumber || activeClient.personalNumber || '').toUpperCase(),
                          nombre_completo: activeClient.fullName.toUpperCase(),
                          nacionalidad: activeClient.nationality.toUpperCase(),
                          pais_emisor: (activeClient.issuingCountry || activeClient.nationality || '').toUpperCase(),
                          fecha_nacimiento: activeClient.birthDate || '',
                          sexo: activeClient.sex || 'M',
                          condicion_juridica: (activeClient.sexAgeCategory || determineSexAgeCategory(activeClient.birthDate, activeClient.sex).category).toUpperCase(),
                          domicilio: (activeClient.address || '').toUpperCase(),
                          telefono: activeClient.phone || '',
                          abogado_designado: activeIdoneo.formalTitle,
                        },
                        null,
                        2
                      );
                      navigator.clipboard.writeText(jsonStr);
                      setCopiedJson(true);
                      setTimeout(() => setCopiedJson(false), 2000);
                    }}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-mono border border-slate-700 transition-colors"
                  >
                    {copiedJson ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-300">¡Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3 text-slate-400" />
                        <span>Copiar JSON</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="text-[11px] font-mono text-amber-300 overflow-x-auto max-h-48 p-2 rounded bg-slate-900 border border-slate-800 leading-relaxed">
                  {JSON.stringify(
                    {
                      tipo_documento: activeClient.docType === 'cedula' ? 'Cédula de Identidad' : 'Pasaporte',
                      numero_identidad: (activeClient.passportNumber || activeClient.personalNumber || '').toUpperCase(),
                      nombre_completo: activeClient.fullName.toUpperCase(),
                      nacionalidad: activeClient.nationality.toUpperCase(),
                      pais_emisor: (activeClient.issuingCountry || activeClient.nationality || '').toUpperCase(),
                      fecha_nacimiento: activeClient.birthDate || '',
                      sexo: activeClient.sex || 'M',
                      condicion_juridica: (activeClient.sexAgeCategory || determineSexAgeCategory(activeClient.birthDate, activeClient.sex).category).toUpperCase(),
                      domicilio: (activeClient.address || '').toUpperCase(),
                      telefono: activeClient.phone || '',
                      abogado_designado: activeIdoneo.formalTitle,
                    },
                    null,
                    2
                  )}
                </pre>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2 text-xs">
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-[10px] text-slate-500 block font-mono">(nombre) [MAYÚSCULAS/NEGRITA]</span>
                <strong className="text-slate-900 font-bold block truncate">
                  {activeClient.fullName.toUpperCase()}
                </strong>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-[10px] text-slate-500 block font-mono">(numero de identidad)</span>
                <strong className="text-slate-900 font-bold block truncate">
                  {(activeClient.passportNumber || activeClient.personalNumber || '').toUpperCase()}
                </strong>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-[10px] text-slate-500 block font-mono">(nacionalidad) [minúsculas]</span>
                <span className="text-slate-700 font-normal block truncate">
                  {activeClient.nationality.toLowerCase()}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-amber-50/70 border border-amber-300">
                <span className="text-[10px] text-amber-800 block font-mono font-bold">(abogado_nombre)</span>
                <strong className="text-amber-950 font-extrabold block truncate">
                  {activeIdoneo.formalTitle}
                </strong>
              </div>
              <div className="p-2.5 rounded-lg bg-amber-50/70 border border-amber-300">
                <span className="text-[10px] text-amber-800 block font-mono font-bold">(sexo/edad)</span>
                <strong className="text-amber-950 font-extrabold block truncate">
                  {(activeClient.sexAgeCategory || determineSexAgeCategory(activeClient.birthDate, activeClient.sex).category).toUpperCase()}
                </strong>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Success notification banner after generation */}
      {generationSuccess && lastGeneratedDoc && (
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white rounded-2xl p-6 shadow-lg flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-md">
              <FileCheck className="w-7 h-7 text-white" />
            </div>
            <div>
              <h4 className="font-serif font-bold text-lg text-white">
                ¡Documento Word (.docx) generado y descargado exitosamente!
              </h4>
              <p className="text-xs text-emerald-100 mt-0.5">
                Archivo: <span className="font-mono font-semibold">{lastGeneratedDoc.fileName}</span> ({lastGeneratedDoc.fileSizeFormatted}) · Letrado: <span className="font-bold">{activeIdoneo.name}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleGenerate}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-slate-900 font-bold text-xs shadow-md hover:bg-emerald-50 transition-colors"
            >
              <Download className="w-4 h-4 text-emerald-700" />
              <span>Volver a Descargar .docx</span>
            </button>
          </div>
        </div>
      )}

      {/* Error alert */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-center gap-3 text-red-700 text-xs font-semibold">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Form Fields Editor for all Placeholders in Active Template */}
      {activeTemplate && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h3 className="font-serif font-bold text-slate-900 text-lg">
                Campos y Variables del Documento ({activeTemplate.placeholders.length} marcadores)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Valores auto-rellenados con los datos del pasaporte y del letrado idóneo <strong className="text-slate-800">{activeIdoneo.name}</strong>. Puedes editarlos antes de compilar.
              </p>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <input
                type="text"
                value={customFileName}
                onChange={(e) => setCustomFileName(e.target.value)}
                placeholder="Nombre_Del_Archivo.docx"
                className="text-xs p-2.5 rounded-xl border border-slate-300 w-full sm:w-64 font-mono font-semibold"
                title="Nombre del archivo Word que se descargará"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeTemplate.placeholders.map((placeholderKey) => {
              const def = activeTemplate.placeholderDefs?.find((d) => d.key === placeholderKey);
              const val = formValues[placeholderKey] || '';
              const cleanKey = placeholderKey.toLowerCase();
              const isIdoneoField = cleanKey.includes('abogado') || cleanKey.includes('idoneo') || cleanKey.includes('letrado') || cleanKey.includes('colegiado');

              return (
                <div
                  key={placeholderKey}
                  className={`p-3.5 rounded-xl border transition-all ${
                    isIdoneoField
                      ? 'bg-amber-50/40 border-amber-300/80 ring-1 ring-amber-400/20'
                      : 'bg-slate-50/70 border-slate-200 focus-within:border-amber-500 focus-within:bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-slate-800 truncate">
                      {def?.label || placeholderKey}
                    </label>
                    <span className="font-mono text-[10px] text-amber-800 bg-white px-1.5 py-0.5 rounded border border-slate-200 font-bold shrink-0">
                      {placeholderKey}
                    </span>
                  </div>

                  {def?.type === 'textarea' ? (
                    <textarea
                      rows={3}
                      value={val}
                      onChange={(e) => handleFieldChange(placeholderKey, e.target.value)}
                      className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                    />
                  ) : def?.type === 'select' && def.options ? (
                    <select
                      value={val}
                      onChange={(e) => handleFieldChange(placeholderKey, e.target.value)}
                      className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-amber-500 focus:outline-hidden font-semibold"
                    >
                      {def.options.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={def?.type === 'date' ? 'date' : 'text'}
                      value={val}
                      onChange={(e) => handleFieldChange(placeholderKey, e.target.value)}
                      className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-amber-500 focus:outline-hidden font-semibold"
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Signature Studio & Document Sheet Preview (Antes de Generar) */}
          <div className="pt-6 border-t border-slate-200">
            <div className="bg-slate-900 text-white rounded-2xl p-5 sm:p-7 border border-slate-800 shadow-xl mb-6">
              {/* Header */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-800">
                <div className="flex items-start gap-3.5">
                  <div className="w-11 h-11 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
                    <PenTool className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base sm:text-lg font-bold text-white">
                        Acomodo y Posición de Firma del Cliente
                      </h3>
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 inline-flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        Alineación Notarial Garantizada
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-1 max-w-2xl">
                      Revisa y acomoda el nombre del cliente en el área de la firma bajo <strong className="text-amber-400 font-bold">OTORGO PODER:</strong> antes de generar el Word. El sistema ajusta la alineación automáticamente para nombres tanto cortos como largos (idéntico al Ejemplo 2).
                    </p>
                  </div>
                </div>

                {/* Quick Toggle Controls */}
                <div className="flex items-center gap-2 self-start lg:self-center">
                  <button
                    type="button"
                    onClick={() => setShowVerticalGuide(!showVerticalGuide)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 ${
                      showVerticalGuide
                        ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                    }`}
                  >
                    <MoveHorizontal className="w-3.5 h-3.5" />
                    <span>{showVerticalGuide ? 'Ocultar Guía' : 'Ver Guía de Columna'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowSigAdvancedConfig(!showSigAdvancedConfig)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center gap-1.5 transition-all"
                  >
                    <Sliders className="w-3.5 h-3.5 text-amber-400" />
                    <span>Ajustes Finos</span>
                    {showSigAdvancedConfig ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Interactive Name Length Simulator */}
              <div className="mt-4 p-3.5 rounded-xl bg-slate-800/80 border border-slate-700/80">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                    <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Simulador de Nombres (Prueba de Acomodo Corto vs Largo):</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSimulatedNameLength('actual')}
                      className={`px-2.5 py-1 rounded-lg text-xs transition-all font-semibold ${
                        simulatedNameLength === 'actual'
                          ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/30 scale-105'
                          : 'bg-slate-700/80 hover:bg-slate-600 text-slate-300'
                      }`}
                      title="Nombre real del cliente seleccionado"
                    >
                      Actual ({activeClient ? activeClient.fullName.split(' ')[0] : 'Cliente'})
                    </button>
                    <button
                      type="button"
                      onClick={() => setSimulatedNameLength('short')}
                      className={`px-2.5 py-1 rounded-lg text-xs transition-all font-semibold ${
                        simulatedNameLength === 'short'
                          ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/30 scale-105'
                          : 'bg-slate-700/80 hover:bg-slate-600 text-slate-300'
                      }`}
                      title="Probar nombre muy corto (6 caracteres)"
                    >
                      Corto: ANA LI
                    </button>
                    <button
                      type="button"
                      onClick={() => setSimulatedNameLength('medium')}
                      className={`px-2.5 py-1 rounded-lg text-xs transition-all font-semibold ${
                        simulatedNameLength === 'medium'
                          ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/30 scale-105'
                          : 'bg-slate-700/80 hover:bg-slate-600 text-slate-300'
                      }`}
                      title="Probar nombre medio (15 caracteres)"
                    >
                      Medio: CARLOS RESTREPO
                    </button>
                    <button
                      type="button"
                      onClick={() => setSimulatedNameLength('long')}
                      className={`px-2.5 py-1 rounded-lg text-xs transition-all font-semibold ${
                        simulatedNameLength === 'long'
                          ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/30 scale-105'
                          : 'bg-slate-700/80 hover:bg-slate-600 text-slate-300'
                      }`}
                      title="Probar nombre largo del Ejemplo 2 (25 caracteres)"
                    >
                      Largo: GUSTAVO JOSE ACOSTA MUÑOZ
                    </button>
                    <button
                      type="button"
                      onClick={() => setSimulatedNameLength('very_long')}
                      className={`px-2.5 py-1 rounded-lg text-xs transition-all font-semibold ${
                        simulatedNameLength === 'very_long'
                          ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/30 scale-105'
                          : 'bg-slate-700/80 hover:bg-slate-600 text-slate-300'
                      }`}
                      title="Probar nombre muy largo/compuesto (39 caracteres)"
                    >
                      Muy Largo: MARIA DE LOS ANGELES...
                    </button>
                  </div>
                </div>
              </div>

              {/* Advanced Controls Accordion */}
              {showSigAdvancedConfig && (
                <div className="mt-4 p-4 rounded-xl bg-slate-800/90 border border-slate-700 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1.5">
                      Posición de Columna Derecha (Margen X):
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={45}
                        max={68}
                        value={sigColumnOffset}
                        onChange={(e) => setSigColumnOffset(Number(e.target.value))}
                        className="w-full accent-amber-500 cursor-pointer"
                      />
                      <span className="font-mono font-bold text-amber-400 text-xs w-9 text-right">
                        {sigColumnOffset}%
                      </span>
                    </div>
                    <div className="flex gap-1.5 mt-2">
                      {[
                        { label: '50%', val: 50 },
                        { label: '56% (Ejemplo 2)', val: 56 },
                        { label: '60%', val: 60 },
                        { label: '64%', val: 64 },
                      ].map((p) => (
                        <button
                          key={p.val}
                          type="button"
                          onClick={() => setSigColumnOffset(p.val)}
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                            sigColumnOffset === p.val
                              ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold'
                              : 'bg-slate-700 text-slate-300 border-slate-600 hover:bg-slate-600'
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1.5">
                      Espacio para Firma Manual:
                    </label>
                    <div className="flex gap-1.5">
                      {[
                        { label: '1 Línea', val: 1 },
                        { label: '2 Líneas (Recomendado)', val: 2 },
                        { label: '3 Líneas', val: 3 },
                        { label: '4 Líneas', val: 4 },
                      ].map((s) => (
                        <button
                          key={s.val}
                          type="button"
                          onClick={() => setSigBlankLines(s.val)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                            sigBlankLines === s.val
                              ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold'
                              : 'bg-slate-700 text-slate-300 border-slate-600 hover:bg-slate-600'
                          }`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1.5">
                      Espacio en blanco vertical para que el cliente y letrado firmen físicamente con bolígrafo.
                    </p>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1.5">
                      Estructura en Word (.docx):
                    </label>
                    <div className="flex flex-col gap-1">
                      <button
                        type="button"
                        onClick={() => setSigUseTable(true)}
                        className={`p-2 rounded-lg text-left text-xs font-semibold border transition-all ${
                          sigUseTable
                            ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
                            : 'bg-slate-700/60 border-slate-600 text-slate-300'
                        }`}
                      >
                        <div className="font-bold flex items-center gap-1.5">
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          Tabla Invisible de 2 Columnas
                        </div>
                        <div className="text-[10px] text-slate-400 font-normal">
                          100% inmune a saltos de línea y desfases (Recomendado)
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSigUseTable(false)}
                        className={`p-2 rounded-lg text-left text-xs font-semibold border transition-all ${
                          !sigUseTable
                            ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
                            : 'bg-slate-700/60 border-slate-600 text-slate-300'
                        }`}
                      >
                        <div className="font-bold">Tabulaciones Fijas</div>
                        <div className="text-[10px] text-slate-400 font-normal">
                          Párrafos con salto de tabulador normalizado
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Direct Signature Text Override Inputs */}
                  <div className="sm:col-span-2 lg:col-span-3 pt-2 border-t border-slate-700/80 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <div>
                      <span className="block text-[11px] text-slate-400 font-medium mb-1">
                        Nombre del Cliente en Firma:
                      </span>
                      <input
                        type="text"
                        value={customSigClientName}
                        onChange={(e) => setCustomSigClientName(e.target.value.toUpperCase())}
                        placeholder="Ej. GUSTAVO JOSE ACOSTA MUÑOZ"
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-amber-300 font-bold focus:ring-1 focus:ring-amber-500"
                      />
                    </div>
                    <div>
                      <span className="block text-[11px] text-slate-400 font-medium mb-1">
                        Documento del Cliente en Firma:
                      </span>
                      <input
                        type="text"
                        value={customSigClientDoc}
                        onChange={(e) => setCustomSigClientDoc(e.target.value.toUpperCase())}
                        placeholder="Ej. PASAPORTE No. 192629016"
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white font-medium focus:ring-1 focus:ring-amber-500"
                      />
                    </div>
                    <div>
                      <span className="block text-[11px] text-slate-400 font-medium mb-1">
                        Letrado Responsable en Firma:
                      </span>
                      <input
                        type="text"
                        value={customSigLawyerTitle}
                        onChange={(e) => setCustomSigLawyerTitle(e.target.value.toUpperCase())}
                        placeholder="Ej. LCDO. ANTONY NATHANAEL TALLA COPRIS"
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white font-medium focus:ring-1 focus:ring-amber-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Visual Document Sheet Replica (Exact Layout from Image 2) */}
              <div className="mt-5 bg-slate-950/60 p-3 sm:p-5 rounded-2xl border border-slate-800">
                <div className="text-center text-xs font-semibold text-slate-400 mb-3 flex items-center justify-center gap-2">
                  <Eye className="w-3.5 h-3.5 text-amber-400" />
                  <span>Vista Previa de la Hoja de Documento (Área Baja de Firmas)</span>
                </div>

                <div className="bg-white text-slate-900 rounded-xl p-6 sm:p-10 shadow-2xl border border-slate-300 font-serif relative overflow-hidden max-w-2xl mx-auto">
                  {/* Subtle top legal header */}
                  <div className="text-center font-sans uppercase font-extrabold tracking-widest text-slate-800 text-xs sm:text-sm mb-4 border-b border-slate-200 pb-2.5">
                    PODER ESPECIAL DE REPRESENTACIÓN LEGAL
                  </div>
                  <div className="text-center font-bold text-[11px] uppercase text-slate-700 mb-4 tracking-wide font-sans">
                    HONORABLE SEÑOR DIRECTOR GENERAL DEL SERVICIO NACIONAL DE MIGRACIÓN:
                  </div>

                  {/* Main legal paragraph */}
                  <p className="text-[11px] sm:text-xs leading-relaxed text-justify mb-3 text-slate-800">
                    Yo, <strong className="font-bold underline decoration-amber-500/50 uppercase">{previewClientName}</strong>, {activeClient?.sexAgeCategory || 'varón, mayor de edad'}, de nacionalidad <span className="font-semibold">{formValues['(nacionalidad)'] || activeClient?.nationality || 'venezolana'}</span>, con {previewClientDoc}, por este medio otorgo poder especial, amplio y suficiente al letrado <strong className="font-bold">{customSigLawyerTitle}</strong>, con {customSigLawyerCedula}, {customSigLawyerIdoneidad}, con oficinas ubicadas en la Calle 50 &amp; Elvira Méndez, Edificio El Ejecutivo, Piso 5 Oficina 2, tel. 830-5220, lugar en donde recibe notificaciones personales y judiciales, para que en mi nombre y representación tramite los trámites pertinentes ante esta honorable institución.
                  </p>

                  <p className="text-[11px] sm:text-xs leading-relaxed text-justify mb-6 text-slate-800">
                    El letrado queda debidamente facultado para recibir, desistir, sustituir, revocar, renunciar, reasumir y cuantas acciones considere necesarias para el mejor ejercicio del presente poder.
                    <br />
                    <span className="block mt-2 italic text-slate-600 font-sans text-[11px]">Del señor Director,</span>
                  </p>

                  {/* THE SIGNATURE AREA - EXACT REPLICA OF IMAGE 2 */}
                  <div className="relative pt-6 border-t-2 border-dashed border-slate-200 mt-6">
                    {/* Vertical Alignment Guide Line */}
                    {showVerticalGuide && (
                      <div
                        className="absolute top-0 bottom-0 border-l-2 border-emerald-500/70 z-20 pointer-events-none transition-all duration-300"
                        style={{ left: `${sigColumnOffset}%` }}
                      >
                        <span className="absolute -top-3 -left-3 bg-emerald-600 text-white text-[9px] font-sans font-bold px-1.5 py-0.5 rounded shadow whitespace-nowrap">
                          Guía Notarial ({sigColumnOffset}%)
                        </span>
                      </div>
                    )}

                    <div className="grid grid-cols-12 gap-3 sm:gap-4 font-sans text-xs">
                      {/* Columna Izquierda: Abogado Idóneo (ACEPTO PODER) */}
                      <div
                        className="space-y-1"
                        style={{
                          gridColumn: `span ${Math.max(4, Math.floor((sigColumnOffset / 100) * 12))}`,
                        }}
                      >
                        <div className="font-bold text-slate-950 uppercase tracking-wide text-xs sm:text-sm">
                          ACEPTO PODER
                        </div>

                        {/* Espacio para firma física manual */}
                        <div
                          style={{ height: `${sigBlankLines * 22}px` }}
                          className="flex items-center justify-start text-[10px] text-slate-400 italic"
                        >
                          <span className="opacity-40 select-none">{"(Espacio para firma física)"}</span>
                        </div>

                        <div className="font-bold text-slate-950 uppercase text-[11px] sm:text-xs">
                          {customSigLawyerTitle}
                        </div>
                        <div className="font-bold text-slate-950 uppercase text-[10px] sm:text-[11px]">
                          {customSigLawyerCedula}
                        </div>
                        <div className="font-bold text-slate-950 uppercase text-[10px] sm:text-[11px]">
                          {customSigLawyerIdoneidad}
                        </div>
                      </div>

                      {/* Columna Derecha: Cliente (OTORGO PODER:) */}
                      <div
                        className={`space-y-1 ${
                          sigAlignment === 'center' ? 'text-center' : 'text-left'
                        }`}
                        style={{
                          gridColumn: `${Math.max(5, Math.ceil((sigColumnOffset / 100) * 12) + 1)} / span ${
                            12 - Math.max(4, Math.floor((sigColumnOffset / 100) * 12))
                          }`,
                        }}
                      >
                        <div className="font-bold text-slate-950 uppercase tracking-wide text-xs sm:text-sm">
                          OTORGO PODER:
                        </div>

                        {/* Espacio para firma física manual */}
                        <div
                          style={{ height: `${sigBlankLines * 22}px` }}
                          className="flex items-center justify-start text-[10px] text-slate-400 italic"
                        >
                          <span className="opacity-40 select-none">{"(Espacio para firma física)"}</span>
                        </div>

                        <div className="font-bold text-slate-950 uppercase text-[11px] sm:text-xs bg-amber-100 px-1 py-0.5 rounded border border-amber-300 inline-block font-sans">
                          {previewClientName}
                        </div>
                        <div className="font-bold text-slate-950 uppercase text-[10px] sm:text-[11px] block">
                          {previewClientDoc}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400 px-2">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span>
                      Modo activo:{' '}
                      <strong className="text-emerald-300">
                        {sigUseTable ? 'Tabla Invisible OpenXML (Recomendado)' : 'Tabulaciones'}
                      </strong>
                    </span>
                  </div>
                  <div className="text-slate-400">
                    Posición de columna: <strong className="text-amber-400">{sigColumnOffset}%</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-slate-500 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Inyección de variables en tiempo real en archivo OpenXML .docx</span>
            </div>

            <button
              id="btn-generate-word-docx"
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/25 transition-all active:scale-95 disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                  <span>Compilando Documento Word...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 text-slate-950" />
                  <span>Generar y Descargar Word (.docx)</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
