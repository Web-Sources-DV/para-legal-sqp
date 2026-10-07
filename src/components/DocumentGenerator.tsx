import { SignatureStudio } from "./SignatureStudio";
import { useUnsavedChanges } from "../hooks/useUnsavedChanges";
import saveAs from "file-saver";
import React, { useState, useEffect, useRef } from "react";
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
} from "lucide-react";
import confetti from "canvas-confetti";
import {
  Client,
  Template,
  GeneratedDocument,
  PlaceholderDef,
  Idoneo,
  SignatureLayoutOptions,
} from "../types";
import {
  generateAndDownloadDocx,
  determineSexAgeCategory,
  buildComprehensiveReplacementMap,
} from "../services/docxService";
import {
  fieldDefault,
  documentTypeLabel,
  canonicalField,
} from "../services/fieldMapping";
import { saveDocumentLog } from "../services/storageService";
import { IDONEOS, DEFAULT_IDONEO, getIdoneoByName } from "../data/idoneos";

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
  const templateBaseId = (template?: Template | null) => {
    if (!template) return "";
    return (
      templates.find(
        (item) =>
          item.id === template.id ||
          template.id === `${item.id}-${getIdoneoByName(template.idoneo).id}`,
      )?.id || template.id
    );
  };

  const [selectedClientId, setSelectedClientId] = useState<string>(
    initialClient?.id || (clients[0]?.id ?? ""),
  );
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
    templateBaseId(initialTemplate) || (templates[0]?.id ?? ""),
  );

  // Selected Idoneo state
  const [selectedIdoneoId, setSelectedIdoneoId] = useState<string>(() => {
    if (initialTemplate?.idoneo) {
      return getIdoneoByName(initialTemplate.idoneo).id;
    }
    return DEFAULT_IDONEO.id;
  });

  const [sourceRevision, setSourceRevision] = useState("");
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [dirty, setDirty] = useState(false);
  useUnsavedChanges(dirty);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [customFileName, setCustomFileName] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [lastGeneratedDoc, setLastGeneratedDoc] =
    useState<GeneratedDocument | null>(null);
  const [generationSuccess, setGenerationSuccess] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showJsonInspector, setShowJsonInspector] = useState<boolean>(false);
  const [copiedJson, setCopiedJson] = useState<boolean>(false);

  const activeClient =
    clients.find((c) => c.id === selectedClientId) || initialClient || null;

  // Find active template (checking direct ID or base template ID)
  const activeTemplate =
    (templateBaseId(initialTemplate) === selectedTemplateId
      ? initialTemplate
      : null) ||
    templates.find((t) => t.id === selectedTemplateId) ||
    templates.find((t) => selectedTemplateId.startsWith(t.id)) ||
    initialTemplate ||
    templates[0] ||
    null;

  const activeIdoneo: Idoneo =
    IDONEOS.find((i) => i.id === selectedIdoneoId) || DEFAULT_IDONEO;

  useEffect(() => {
    if (!selectedClientId && clients.length) setSelectedClientId(clients[0].id);
    if (!selectedTemplateId && templates.length)
      setSelectedTemplateId(templates[0].id);
  }, [clients, templates, selectedClientId, selectedTemplateId]);

  // Signature positioning and alignment state (Antes de generar)
  const [sigAlignment, setSigAlignment] = useState<
    "column-left" | "center" | "column-right"
  >("column-left");
  const [sigEnabled, setSigEnabled] = useState(false);
  const [sigColumnOffset, setSigColumnOffset] = useState<number>(56); // 56% matching Image 2
  const [sigBlankLines, setSigBlankLines] = useState<number>(2);
  const [sigUseTable, setSigUseTable] = useState<boolean>(true);
  const [customSigClientName, setCustomSigClientName] = useState<string>("");
  const [customSigClientDoc, setCustomSigClientDoc] = useState<string>("");
  const [customSigLawyerTitle, setCustomSigLawyerTitle] = useState<string>("");
  const [customSigLawyerCedula, setCustomSigLawyerCedula] =
    useState<string>("");
  const [customSigLawyerIdoneidad, setCustomSigLawyerIdoneidad] =
    useState<string>("");
  const [simulatedNameLength, setSimulatedNameLength] = useState<
    "actual" | "short" | "medium" | "long" | "very_long"
  >("actual");
  const [showVerticalGuide, setShowVerticalGuide] = useState<boolean>(true);
  const [showSigAdvancedConfig, setShowSigAdvancedConfig] =
    useState<boolean>(false);

  // Synchronize client signature defaults when activeClient changes
  useEffect(() => {
    if (activeClient) {
      setCustomSigClientName(activeClient.fullName.toUpperCase());
      const docLabel = `${documentTypeLabel(activeClient.docType).toUpperCase()} No. `;
      const docVal = (
        activeClient.passportNumber ||
        activeClient.personalNumber ||
        ""
      ).toUpperCase();
      setCustomSigClientDoc(docVal ? `${docLabel}${docVal}` : "PASAPORTE No. ");
    } else {
      setCustomSigClientName("");
      setCustomSigClientDoc("");
    }
  }, [activeClient?.id]);

  // Synchronize lawyer signature defaults when activeIdoneo changes
  useEffect(() => {
    if (activeIdoneo) {
      setCustomSigLawyerTitle(activeIdoneo.formalTitle.toUpperCase());
      setCustomSigLawyerCedula(
        activeIdoneo.cedula
          ? `CÉDULA NO. ${activeIdoneo.cedula.toUpperCase()}`
          : "",
      );
      setCustomSigLawyerIdoneidad(
        activeIdoneo.idoneidad
          ? `IDONEIDAD ${activeIdoneo.idoneidad.toUpperCase()}`
          : "",
      );
    }
  }, [activeIdoneo.id]);

  // Simulated client name for testing short and long names
  const previewClientName = React.useMemo(() => {
    if (simulatedNameLength === "short") return "ANA LI";
    if (simulatedNameLength === "medium") return "CARLOS RESTREPO";
    if (simulatedNameLength === "long") return "GUSTAVO JOSE ACOSTA MUÑOZ";
    if (simulatedNameLength === "very_long")
      return "MARIA DE LOS ANGELES RESTREPO FERNANDEZ";
    return (
      customSigClientName ||
      (activeClient
        ? activeClient.fullName.toUpperCase()
        : "GUSTAVO JOSE ACOSTA MUÑOZ")
    );
  }, [simulatedNameLength, customSigClientName, activeClient]);

  const previewClientDoc = React.useMemo(() => {
    if (simulatedNameLength === "short") return "PASAPORTE No. P8829104";
    return (
      customSigClientDoc ||
      (activeClient?.passportNumber
        ? `PASAPORTE No. ${activeClient.passportNumber}`
        : "[número pendiente]")
    );
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
      setSelectedTemplateId(templateBaseId(initialTemplate));
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
      const def = activeTemplate.placeholderDefs?.find(
        (d) => d.key === placeholderKey,
      );
      const category = activeClient
        ? determineSexAgeCategory(activeClient.birthDate, activeClient.sex)
            .category
        : "";
      const val =
        fieldDefault(placeholderKey, activeClient, activeIdoneo, category) ||
        def?.defaultValue ||
        "";

      initialValues[placeholderKey] = val;
    });

    setSourceRevision(
      `${activeClient?.revision || 0}:${activeTemplate.revision || 0}:${activeIdoneo.revision || 0}`,
    );
    setDirty(false);
    setFormValues(initialValues);

    // Default download filename with Idóneo and Client
    if (activeTemplate && activeClient) {
      const cleanTplName = activeTemplate.name.replace(
        /[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]/g,
        "_",
      );
      const cleanCliName = activeClient.fullName.replace(
        /[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]/g,
        "_",
      );
      const cleanIdoneo = activeIdoneo.name.replace(
        /[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]/g,
        "_",
      );
      setCustomFileName(`${cleanTplName}_${cleanIdoneo}_${cleanCliName}.docx`);
    } else if (activeTemplate) {
      setCustomFileName(
        `${activeTemplate.name.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]/g, "_")}_${activeIdoneo.name.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]/g, "_")}.docx`,
      );
    }
  }, [activeTemplate?.id, activeClient?.id, activeIdoneo.id, refreshVersion]);

  const edited =
    <T,>(
      setter: React.Dispatch<React.SetStateAction<T>>,
    ): React.Dispatch<React.SetStateAction<T>> =>
    (value) => {
      setDirty(true);
      setter(value);
    };

  const handleFieldChange = (key: string, value: string) => {
    setDirty(true);
    setFormValues((prev) => ({ ...prev, [key]: value }));
  };

  const lastDownloadedBlob = useRef<Blob | null>(null);
  const pendingDocument = useRef<{ doc: GeneratedDocument; blob: Blob } | null>(
    null,
  );
  const generating = useRef(false);

  const handleGenerate = async () => {
    if (!activeTemplate) {
      setErrorMessage("Por favor selecciona una plantilla válida.");
      return;
    }

    if (generating.current) return;
    if (!activeClient) {
      setErrorMessage("Selecciona un cliente revisado antes de generar.");
      return;
    }
    const missing = activeTemplate.placeholders.filter(
      (key) => !formValues[key]?.trim(),
    );
    if (missing.length) {
      setErrorMessage(`Completa los campos: ${missing.join(", ")}`);
      return;
    }
    generating.current = true;
    setIsGenerating(true);
    setErrorMessage(null);
    setGenerationSuccess(false);

    try {
      if (pendingDocument.current) {
        const pending = pendingDocument.current;
        await saveDocumentLog(pending.doc);
        saveAs(pending.blob, pending.doc.fileName);
        lastDownloadedBlob.current = pending.blob;
        pendingDocument.current = null;
        setLastGeneratedDoc(pending.doc);
        setDirty(false);
        setGenerationSuccess(true);
        onDocumentGenerated?.(pending.doc);
        return;
      }
      const signatureOptions: SignatureLayoutOptions = {
        enabled: sigEnabled,
        alignment: sigAlignment,
        columnOffsetPercent: sigColumnOffset,
        signatureBlankLines: sigBlankLines,
        useTwoColumnTable: sigUseTable,
        clientSignatureName: customSigClientName,
        clientSignatureDoc: customSigClientDoc,
        lawyerSignatureTitle: customSigLawyerTitle,
        lawyerSignatureCedula: customSigLawyerCedula,
        lawyerSignatureIdoneidad: customSigLawyerIdoneidad,
      };

      const result = await generateAndDownloadDocx(
        activeTemplate,
        formValues,
        customFileName,
        activeClient,
        signatureOptions,
        false,
      );

      const newDoc: GeneratedDocument = {
        id: `doc-${crypto.randomUUID()}`,
        title: `${activeTemplate.name} - ${activeIdoneo.name} (${activeClient ? activeClient.fullName : "Cliente"})`,
        fileName: result.fileName,
        templateId: templateBaseId(activeTemplate),
        templateVersion: activeTemplate.version || 1,
        templateName: activeTemplate.name,
        clientId: activeClient ? activeClient.id : "sin-cliente",
        clientName: activeClient ? activeClient.fullName : "CLIENTE DIRECTO",
        passportNumber: activeClient ? activeClient.passportNumber : "",
        generatedAt: new Date().toISOString(),
        fileSizeFormatted: result.sizeFormatted,
        dataSnapshot: { ...formValues, _idoneo: activeIdoneo.name },
        signatureOptions,
        fileBase64: await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result).split(",")[1]);
          reader.onerror = () =>
            reject(new Error("No se pudo archivar el documento."));
          reader.readAsDataURL(result.blob);
        }),
      };

      pendingDocument.current = { doc: newDoc, blob: result.blob };
      await saveDocumentLog(newDoc);
      saveAs(result.blob, result.fileName);
      lastDownloadedBlob.current = result.blob;
      pendingDocument.current = null;
      // Trigger celebration confetti
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ["#f59e0b", "#d97706", "#10b981", "#3b82f6"],
        });
      } catch (cErr) {
        // Ignore confetti error
      }

      setLastGeneratedDoc(newDoc);
      setDirty(false);
      setGenerationSuccess(true);

      if (onDocumentGenerated) {
        onDocumentGenerated(newDoc);
      }
    } catch (err: any) {
      console.error("Error generating document:", err);
      setErrorMessage(
        pendingDocument.current
          ? `Documento preparado, pendiente de archivar. Reintenta para guardar y descargar el mismo archivo: ${err.message}`
          : `Error al preparar el Word: ${err.message || "Comprueba los marcadores de la plantilla"}`,
      );
    } finally {
      generating.current = false;
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
                      ? "bg-slate-900 text-white border-slate-900 shadow-sm ring-2 ring-amber-500/50"
                      : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-[11px] shrink-0 ${
                      isSelected
                        ? "bg-amber-500 text-slate-950"
                        : "bg-white text-slate-700 border border-slate-200"
                    }`}
                  >
                    {idoneo.initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <span
                      className={`font-serif font-bold text-xs block truncate ${isSelected ? "text-white" : "text-slate-900"}`}
                    >
                      {idoneo.name}
                    </span>
                    <span
                      className={`text-[10px] block truncate ${isSelected ? "text-amber-300" : "text-slate-500"}`}
                    >
                      {idoneo.colegiado.split("·")[0].trim()}
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
                <option value="">
                  (No hay clientes registrados - Escanea o agrega uno)
                </option>
              ) : (
                clients.map((cli) => (
                  <option key={cli.id} value={cli.id}>
                    👤 {cli.fullName} | {cli.nationality} · Pasaporte:{" "}
                    {cli.passportNumber || "N/A"}
                  </option>
                ))
              )}
            </select>

            {activeClient && (
              <div className="mt-2.5 p-2.5 rounded-lg bg-amber-50/60 border border-amber-200/70 text-xs flex flex-wrap items-center justify-between gap-2 text-slate-700">
                <span>
                  <strong className="text-slate-900">Doc:</strong>{" "}
                  {activeClient.passportNumber || "S/N"} (
                  {activeClient.nationality})
                </span>
                <span>
                  <strong className="text-slate-900">Nacimiento:</strong>{" "}
                  {activeClient.birthDate || "N/A"}
                </span>
                <span>
                  <strong className="text-slate-900">Condición:</strong>{" "}
                  {activeClient.sexAgeCategory || "Sin verificar"}
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
                <option value="">
                  (No hay plantillas .docx - Sube una en el menú Plantillas)
                </option>
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
                <span className="truncate max-w-xs">
                  {activeTemplate.description}
                </span>
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
                  <span>
                    {showJsonInspector ? "Ocultar JSON" : "Ver JSON (OCR)"}
                  </span>
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
                    onClick={async () => {
                      const jsonStr = JSON.stringify(
                        {
                          tipo_documento:
                            activeClient.docType === "cedula"
                              ? "Cédula de Identidad"
                              : "Pasaporte",
                          numero_identidad: (
                            activeClient.passportNumber ||
                            activeClient.personalNumber ||
                            ""
                          ).toUpperCase(),
                          nombre_completo: activeClient.fullName.toUpperCase(),
                          nacionalidad: activeClient.nationality.toUpperCase(),
                          pais_emisor: (
                            activeClient.issuingCountry ||
                            activeClient.nationality ||
                            ""
                          ).toUpperCase(),
                          fecha_nacimiento: activeClient.birthDate || "",
                          sexo: activeClient.sex || "",
                          condicion_juridica: determineSexAgeCategory(
                            activeClient.birthDate,
                            activeClient.sex,
                          ).category.toUpperCase(),
                          domicilio: (activeClient.address || "").toUpperCase(),
                          telefono: activeClient.phone || "",
                          abogado_designado: activeIdoneo.formalTitle,
                        },
                        null,
                        2,
                      );
                      try {
                        await navigator.clipboard.writeText(jsonStr);
                      } catch {
                        setErrorMessage(
                          "No se pudo copiar el JSON. Verifica los permisos del navegador.",
                        );
                        return;
                      }
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
                      tipo_documento:
                        activeClient.docType === "cedula"
                          ? "Cédula de Identidad"
                          : "Pasaporte",
                      numero_identidad: (
                        activeClient.passportNumber ||
                        activeClient.personalNumber ||
                        ""
                      ).toUpperCase(),
                      nombre_completo: activeClient.fullName.toUpperCase(),
                      nacionalidad: activeClient.nationality.toUpperCase(),
                      pais_emisor: (
                        activeClient.issuingCountry ||
                        activeClient.nationality ||
                        ""
                      ).toUpperCase(),
                      fecha_nacimiento: activeClient.birthDate || "",
                      sexo: activeClient.sex || "",
                      condicion_juridica: determineSexAgeCategory(
                        activeClient.birthDate,
                        activeClient.sex,
                      ).category.toUpperCase(),
                      domicilio: (activeClient.address || "").toUpperCase(),
                      telefono: activeClient.phone || "",
                      abogado_designado: activeIdoneo.formalTitle,
                    },
                    null,
                    2,
                  )}
                </pre>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2 text-xs">
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-[10px] text-slate-500 block font-mono">
                  (nombre) [MAYÚSCULAS/NEGRITA]
                </span>
                <strong className="text-slate-900 font-bold block truncate">
                  {activeClient.fullName.toUpperCase()}
                </strong>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-[10px] text-slate-500 block font-mono">
                  (numero de identidad)
                </span>
                <strong className="text-slate-900 font-bold block truncate">
                  {(
                    activeClient.passportNumber ||
                    activeClient.personalNumber ||
                    ""
                  ).toUpperCase()}
                </strong>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-[10px] text-slate-500 block font-mono">
                  (nacionalidad) [minúsculas]
                </span>
                <span className="text-slate-700 font-normal block truncate">
                  {activeClient.nationality.toLowerCase()}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-amber-50/70 border border-amber-300">
                <span className="text-[10px] text-amber-800 block font-mono font-bold">
                  (abogado_nombre)
                </span>
                <strong className="text-amber-950 font-extrabold block truncate">
                  {activeIdoneo.formalTitle}
                </strong>
              </div>
              <div className="p-2.5 rounded-lg bg-amber-50/70 border border-amber-300">
                <span className="text-[10px] text-amber-800 block font-mono font-bold">
                  (sexo/edad)
                </span>
                <strong className="text-amber-950 font-extrabold block truncate">
                  {determineSexAgeCategory(
                    activeClient.birthDate,
                    activeClient.sex,
                  ).category.toUpperCase()}
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
                Archivo:{" "}
                <span className="font-mono font-semibold">
                  {lastGeneratedDoc.fileName}
                </span>{" "}
                ({lastGeneratedDoc.fileSizeFormatted}) · Letrado:{" "}
                <span className="font-bold">
                  {lastGeneratedDoc.dataSnapshot._idoneo}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (lastDownloadedBlob.current)
                  saveAs(lastDownloadedBlob.current, lastGeneratedDoc.fileName);
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-slate-900 font-bold text-xs shadow-md hover:bg-emerald-50 transition-colors"
            >
              <Download className="w-4 h-4 text-emerald-700" />
              <span>Volver a Descargar .docx</span>
            </button>
          </div>
        </div>
      )}

      {sourceRevision &&
        sourceRevision !==
          `${activeClient?.revision || 0}:${activeTemplate?.revision || 0}:${activeIdoneo.revision || 0}` && (
          <div
            role="status"
            className="bg-amber-50 border rounded-xl p-4 text-sm"
          >
            Los datos de origen cambiaron. Tus correcciones se conservan. Revisa
            el cliente y la versión de plantilla antes de generar.{" "}
            <button
              disabled={isGenerating || !!pendingDocument.current}
              className="underline"
              onClick={() => {
                if (
                  !dirty ||
                  confirm(
                    "¿Reemplazar las correcciones por los datos actuales?",
                  )
                )
                  setRefreshVersion((value) => value + 1);
              }}
            >
              Cargar datos actuales
            </button>
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
                Campos y Variables del Documento (
                {activeTemplate.placeholders.length} marcadores)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Valores auto-rellenados con los datos del pasaporte y del
                letrado idóneo{" "}
                <strong className="text-slate-800">{activeIdoneo.name}</strong>.
                Puedes editarlos antes de compilar.
              </p>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <input
                type="text"
                value={customFileName}
                onChange={(e) => {
                  setDirty(true);
                  setCustomFileName(e.target.value);
                }}
                placeholder="Nombre_Del_Archivo.docx"
                className="text-xs p-2.5 rounded-xl border border-slate-300 w-full sm:w-64 font-mono font-semibold"
                title="Nombre del archivo Word que se descargará"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeTemplate.placeholders.map((placeholderKey) => {
              const def = activeTemplate.placeholderDefs?.find(
                (d) => d.key === placeholderKey,
              );
              const val = formValues[placeholderKey] || "";
              const cleanKey = placeholderKey.toLowerCase();
              const isIdoneoField =
                cleanKey.includes("abogado") ||
                cleanKey.includes("idoneo") ||
                cleanKey.includes("letrado") ||
                cleanKey.includes("colegiado");

              return (
                <div
                  key={placeholderKey}
                  className={`p-3.5 rounded-xl border transition-all ${
                    isIdoneoField
                      ? "bg-amber-50/40 border-amber-300/80 ring-1 ring-amber-400/20"
                      : "bg-slate-50/70 border-slate-200 focus-within:border-amber-500 focus-within:bg-white"
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

                  {def?.type === "textarea" ? (
                    <textarea
                      rows={3}
                      disabled={isGenerating || !!pendingDocument.current}
                      aria-label={def?.label || placeholderKey}
                      value={val}
                      onChange={(e) =>
                        handleFieldChange(placeholderKey, e.target.value)
                      }
                      className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                    />
                  ) : def?.type === "select" && def.options ? (
                    <select
                      disabled={isGenerating || !!pendingDocument.current}
                      aria-label={def?.label || placeholderKey}
                      value={val}
                      onChange={(e) =>
                        handleFieldChange(placeholderKey, e.target.value)
                      }
                      className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-amber-500 focus:outline-hidden font-semibold"
                    >
                      <option value="">Selecciona / verifica</option>
                      {def.options.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={def?.type === "date" ? "date" : "text"}
                      disabled={isGenerating || !!pendingDocument.current}
                      aria-label={def?.label || placeholderKey}
                      value={val}
                      onChange={(e) =>
                        handleFieldChange(placeholderKey, e.target.value)
                      }
                      className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-amber-500 focus:outline-hidden font-semibold"
                    />
                  )}
                </div>
              );
            })}
          </div>

          <SignatureStudio
            activeTemplate={activeTemplate}
            formValues={formValues}
            sigAlignment={sigAlignment}
            sigEnabled={sigEnabled}
            setSigEnabled={edited(setSigEnabled)}
            sigColumnOffset={sigColumnOffset}
            setSigColumnOffset={edited(setSigColumnOffset)}
            sigBlankLines={sigBlankLines}
            setSigBlankLines={edited(setSigBlankLines)}
            sigUseTable={sigUseTable}
            setSigUseTable={edited(setSigUseTable)}
            customSigClientName={customSigClientName}
            setCustomSigClientName={edited(setCustomSigClientName)}
            customSigClientDoc={customSigClientDoc}
            setCustomSigClientDoc={edited(setCustomSigClientDoc)}
            customSigLawyerTitle={customSigLawyerTitle}
            setCustomSigLawyerTitle={edited(setCustomSigLawyerTitle)}
            customSigLawyerCedula={customSigLawyerCedula}
            customSigLawyerIdoneidad={customSigLawyerIdoneidad}
            simulatedNameLength={simulatedNameLength}
            setSimulatedNameLength={setSimulatedNameLength}
            showVerticalGuide={showVerticalGuide}
            setShowVerticalGuide={setShowVerticalGuide}
            showSigAdvancedConfig={showSigAdvancedConfig}
            setShowSigAdvancedConfig={setShowSigAdvancedConfig}
            previewClientName={previewClientName}
            previewClientDoc={previewClientDoc}
            activeClient={activeClient}
          />
          <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-slate-500 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>
                Inyección de variables en tiempo real en archivo OpenXML .docx
              </span>
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
