import React, { useState } from "react";
import {
  Camera,
  CheckCircle2,
  FileText,
  Sparkles,
  ArrowLeft,
  ArrowRight,
  Shield,
  Layers,
  RotateCcw,
  Users,
  Search,
  PenTool,
  UserCheck,
  FileDown,
} from "lucide-react";
import {
  ExtractionResult,
  Client,
  Template,
  GeneratedDocument,
} from "../types";
import { PassportScanner } from "./PassportScanner";
import { DataReviewStep } from "./DataReviewStep";
import { DocumentGenerator } from "./DocumentGenerator";
import { saveClient } from "../services/storageService";
import { BookOpen } from "lucide-react";

interface GenerationWizardProps {
  clients: Client[];
  templates: Template[];
  onClientsChange: () => void;
  onDocumentGenerated: (doc: GeneratedDocument) => void;
  onOpenTemplatesTab: () => void;
  onOpenManualTab?: () => void;
}

export const GenerationWizard: React.FC<GenerationWizardProps> = ({
  clients,
  templates,
  onClientsChange,
  onDocumentGenerated,
  onOpenTemplatesTab,
  onOpenManualTab,
}) => {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [step1Mode, setStep1Mode] = useState<
    "scan" | "select_client" | "manual"
  >("scan");
  const [clientSearchQuery, setClientSearchQuery] = useState("");
  const [extractionResult, setExtractionResult] =
    useState<ExtractionResult | null>(null);
  const [activeClient, setActiveClient] = useState<Client | null>(null);

  // Handle completion of scanner
  const handleExtractionComplete = (result: ExtractionResult) => {
    setActiveClient(null);
    setExtractionResult(result);
    setCurrentStep(2);
  };

  // Handle selecting an existing client from Step 1
  const handleSelectExistingClient = (client: Client) => {
    setActiveClient(client);
    setExtractionResult({
      firstName: client.firstName,
      lastName: client.lastName,
      fullName: client.fullName,
      passportNumber: client.passportNumber,
      nationality: client.nationality,
      docType: client.docType,
      documentType: client.docType,
      issueDate: client.issueDate,
      personalNumber: client.personalNumber,
      placeOfBirth: client.placeOfBirth,
      sexAgeCategory: client.sexAgeCategory,
      issuingCountry: client.issuingCountry || client.nationality,
      birthDate: client.birthDate,
      expiryDate: client.expiryDate,
      sex: client.sex,
      method: "ocr",
      rawOcrText: "",
      confidenceScore: 100,
      imagePreview: client.passportImageBase64,
    });
    // Direct jump to template generation for maximum speed
    setCurrentStep(3);
  };

  // Handle manual input start
  const handleStartManual = () => {
    setActiveClient(null);
    setExtractionResult({
      firstName: "",
      lastName: "",
      fullName: "",
      passportNumber: "",
      nationality: "",
      documentType: "Pasaporte",
      issuingCountry: "",
      birthDate: "",
      expiryDate: "",
      sex: "",
      method: "manual",
      rawOcrText: "",
      confidenceScore: 100,
      notes: "Ingresado manualmente por el usuario.",
    });
    setCurrentStep(2);
  };

  // Handle confirmation in Data Review step
  const handleConfirmClient = async (
    client: Client,
    nextAction: "generate" | "save_only",
  ) => {
    const saved = await saveClient(client);
    onClientsChange();
    setActiveClient(saved);

    if (nextAction === "generate") {
      setCurrentStep(3);
    } else {
      alert(
        `Cliente "${client.fullName}" guardado exitosamente en el directorio.`,
      );
    }
  };

  const handleResetWizard = () => {
    setCurrentStep(1);
    setExtractionResult(null);
    setActiveClient(null);
    setStep1Mode("scan");
  };

  const filteredClients = clients.filter(
    (c) =>
      c.fullName.toLowerCase().includes(clientSearchQuery.toLowerCase()) ||
      c.passportNumber
        .toLowerCase()
        .includes(clientSearchQuery.toLowerCase()) ||
      c.nationality.toLowerCase().includes(clientSearchQuery.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      {/* Wizard Progress Steps Header */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-800 border border-amber-500/30 text-[11px] font-bold tracking-wide uppercase">
                Paso {currentStep} de 3
              </span>
              <h2 className="font-serif font-bold text-slate-900 text-xl">
                {currentStep === 1 &&
                  "Paso 1: Identificación y Lectura del Cliente"}
                {currentStep === 2 &&
                  "Paso 2: Validación y Edición de Datos Extraídos"}
                {currentStep === 3 &&
                  "Paso 3: Selección de Plantilla y Compilación Word (.docx)"}
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {currentStep === 1 &&
                "Elige leer un pasaporte o cédula con OCR local, seleccionar un cliente registrado o ingresar los datos manualmente."}
              {currentStep === 2 &&
                "Confirma que los nombres, número de pasaporte y nacionalidad sean correctos antes de compilar."}
              {currentStep === 3 &&
                "Elige la plantilla Word a rellenar y descarga el documento listo para firmar o imprimir."}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {onOpenManualTab && (
              <button
                onClick={onOpenManualTab}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-900 border border-amber-500/30 text-xs font-semibold transition-all"
                title="Ver Manual de Uso y Guía Paso a Paso"
              >
                <BookOpen className="w-3.5 h-3.5 text-amber-700" />
                <span className="hidden sm:inline">Manual de Uso</span>
              </button>
            )}

            {currentStep > 1 && (
              <button
                onClick={handleResetWizard}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-all shadow-xs"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reiniciar</span>
              </button>
            )}
          </div>
        </div>

        {/* Steps Indicators */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4 relative">
          {/* Step 1 */}
          <div
            onClick={() => setCurrentStep(1)}
            className={`p-3.5 rounded-xl border flex items-center gap-3 cursor-pointer transition-all ${
              currentStep === 1
                ? "bg-amber-500/15 border-amber-500 text-slate-950 shadow-sm ring-1 ring-amber-500/50"
                : currentStep > 1
                  ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                  : "bg-slate-50 border-slate-200 text-slate-400"
            }`}
          >
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 shadow-xs ${
                currentStep === 1
                  ? "bg-amber-500 text-slate-950 font-extrabold"
                  : currentStep > 1
                    ? "bg-emerald-500 text-white"
                    : "bg-slate-200 text-slate-600"
              }`}
            >
              {currentStep > 1 ? <CheckCircle2 className="w-5 h-5" /> : "1"}
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider block text-slate-500">
                Paso 1
              </span>
              <span className="font-bold text-xs block truncate text-slate-900">
                {activeClient ? activeClient.fullName : "Identificar Cliente"}
              </span>
            </div>
          </div>

          {/* Step 2 */}
          <div
            onClick={() => extractionResult && setCurrentStep(2)}
            className={`p-3.5 rounded-xl border flex items-center gap-3 transition-all ${
              !extractionResult
                ? "cursor-not-allowed opacity-60"
                : "cursor-pointer"
            } ${
              currentStep === 2
                ? "bg-amber-500/15 border-amber-500 text-slate-950 shadow-sm ring-1 ring-amber-500/50"
                : currentStep > 2
                  ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                  : "bg-slate-50 border-slate-200 text-slate-400"
            }`}
          >
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 shadow-xs ${
                currentStep === 2
                  ? "bg-amber-500 text-slate-950 font-extrabold"
                  : currentStep > 2
                    ? "bg-emerald-500 text-white"
                    : "bg-slate-200 text-slate-600"
              }`}
            >
              {currentStep > 2 ? <CheckCircle2 className="w-5 h-5" /> : "2"}
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider block text-slate-500">
                Paso 2
              </span>
              <span className="font-bold text-xs block truncate text-slate-900">
                Revisar Datos
              </span>
            </div>
          </div>

          {/* Step 3 */}
          <div
            onClick={() => activeClient && setCurrentStep(3)}
            className={`p-3.5 rounded-xl border flex items-center gap-3 transition-all ${
              !activeClient ? "cursor-not-allowed opacity-60" : "cursor-pointer"
            } ${
              currentStep === 3
                ? "bg-amber-500/15 border-amber-500 text-slate-950 shadow-sm ring-1 ring-amber-500/50"
                : "bg-slate-50 border-slate-200 text-slate-400"
            }`}
          >
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 shadow-xs ${
                currentStep === 3
                  ? "bg-amber-500 text-slate-950 font-extrabold"
                  : "bg-slate-200 text-slate-600"
              }`}
            >
              3
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider block text-slate-500">
                Paso 3
              </span>
              <span className="font-bold text-xs block truncate text-slate-900">
                Generar Word (.docx)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Step 1: Scanner & Choice Cards */}
      {currentStep === 1 && (
        <div className="space-y-6">
          {/* Quick Choice Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              onClick={() => setStep1Mode("scan")}
              className={`p-4 rounded-xl border text-left flex items-center gap-3.5 transition-all ${
                step1Mode === "scan"
                  ? "bg-white border-amber-500 ring-2 ring-amber-500/20 shadow-md"
                  : "bg-white/80 border-slate-200 hover:border-slate-300 hover:bg-white text-slate-600"
              }`}
            >
              <div
                className={`p-2.5 rounded-xl ${step1Mode === "scan" ? "bg-amber-500 text-slate-950" : "bg-slate-100 text-slate-600"}`}
              >
                <Camera className="w-5 h-5" />
              </div>
              <div>
                <span className="font-bold text-xs text-slate-900 block">
                  Escanear Pasaporte
                </span>
                <span className="text-[11px] text-slate-500 block">
                  Con OCR local Tesseract
                </span>
              </div>
            </button>

            <button
              onClick={() => setStep1Mode("select_client")}
              className={`p-4 rounded-xl border text-left flex items-center gap-3.5 transition-all ${
                step1Mode === "select_client"
                  ? "bg-white border-amber-500 ring-2 ring-amber-500/20 shadow-md"
                  : "bg-white/80 border-slate-200 hover:border-slate-300 hover:bg-white text-slate-600"
              }`}
            >
              <div
                className={`p-2.5 rounded-xl ${step1Mode === "select_client" ? "bg-amber-500 text-slate-950" : "bg-slate-100 text-slate-600"}`}
              >
                <Users className="w-5 h-5" />
              </div>
              <div>
                <span className="font-bold text-xs text-slate-900 block">
                  Clientes Guardados
                </span>
                <span className="text-[11px] text-slate-500 block">
                  {clients.length} clientes disponibles
                </span>
              </div>
            </button>

            <button
              onClick={handleStartManual}
              className={`p-4 rounded-xl border text-left flex items-center gap-3.5 transition-all ${
                step1Mode === "manual"
                  ? "bg-white border-amber-500 ring-2 ring-amber-500/20 shadow-md"
                  : "bg-white/80 border-slate-200 hover:border-slate-300 hover:bg-white text-slate-600"
              }`}
            >
              <div className="p-2.5 rounded-xl bg-slate-100 text-slate-600">
                <PenTool className="w-5 h-5" />
              </div>
              <div>
                <span className="font-bold text-xs text-slate-900 block">
                  Ingreso Manual Rápido
                </span>
                <span className="text-[11px] text-slate-500 block">
                  Escribir datos directamente
                </span>
              </div>
            </button>
          </div>

          {/* Mode 1: Passport Scanner */}
          {step1Mode === "scan" && (
            <PassportScanner onExtractionComplete={handleExtractionComplete} />
          )}

          {/* Mode 2: Pick Existing Client */}
          {step1Mode === "select_client" && (
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <h3 className="font-serif font-bold text-lg text-slate-900">
                    Selecciona un Cliente del Directorio
                  </h3>
                  <p className="text-xs text-slate-500">
                    Al seleccionar un cliente, saltarás directamente a elegir la
                    plantilla Word para generar el documento.
                  </p>
                </div>
                <div className="w-full sm:w-72 relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={clientSearchQuery}
                    onChange={(e) => setClientSearchQuery(e.target.value)}
                    placeholder="Buscar por nombre o pasaporte..."
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500/50"
                  />
                </div>
              </div>

              {clients.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200">
                  <Users className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-700">
                    Aún no hay clientes registrados.
                  </p>
                  <p className="text-xs text-slate-500 mt-1 mb-4">
                    Escanea un pasaporte para agregar el primer cliente o
                    ingrésalo manualmente.
                  </p>
                  <button
                    onClick={() => setStep1Mode("scan")}
                    className="px-4 py-2 rounded-lg bg-amber-500 text-slate-950 font-bold text-xs"
                  >
                    Escanear Pasaporte Ahora
                  </button>
                </div>
              ) : filteredClients.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-6">
                  No se encontraron clientes con esa búsqueda.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredClients.map((c) => (
                    <div
                      key={c.id}
                      onClick={() => handleSelectExistingClient(c)}
                      className="p-4 rounded-xl border border-slate-200 hover:border-amber-500 hover:bg-amber-50/20 cursor-pointer transition-all flex flex-col justify-between group shadow-xs hover:shadow-md"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="text-[10px] font-bold uppercase bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md">
                            {c.docType === "cedula" ? "Cédula" : "Pasaporte"}
                          </span>
                          <span className="text-[11px] font-semibold text-amber-700">
                            {c.nationality}
                          </span>
                        </div>
                        <h4 className="font-bold text-sm text-slate-900 group-hover:text-amber-800 transition-colors">
                          {c.fullName}
                        </h4>
                        <p className="text-xs text-slate-600 font-mono mt-0.5">
                          Doc: <strong>{c.passportNumber}</strong>
                        </p>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-amber-700 font-bold">
                        <span>⚡ Usar y Generar Word</span>
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Step 2: Data Review */}
      {currentStep === 2 && extractionResult && (
        <DataReviewStep
          extraction={
            activeClient
              ? {
                  ...extractionResult,
                  ...activeClient,
                  imagePreview: activeClient.passportImageBase64,
                }
              : extractionResult
          }
          existingClients={clients}
          selectedClient={activeClient}
          onConfirmClient={handleConfirmClient}
          onRescan={() => setCurrentStep(1)}
        />
      )}

      {/* Step 3: Document Generation */}
      {currentStep === 3 && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-xs text-xs gap-2">
            <div>
              <span className="text-slate-500 block">
                Cliente seleccionado para este documento:
              </span>
              <span className="text-sm font-bold text-slate-900">
                {activeClient?.fullName ||
                  extractionResult?.fullName ||
                  "Cliente Identificado"}
              </span>
              <span className="text-slate-600 ml-2 font-mono">
                ({activeClient?.docType === "cedula" ? "Cédula" : "Pasaporte"}:{" "}
                {activeClient?.passportNumber ||
                  extractionResult?.passportNumber}
                ) · {activeClient?.nationality || extractionResult?.nationality}
              </span>
            </div>

            <button
              onClick={() => setCurrentStep(2)}
              className="text-amber-800 hover:text-amber-900 font-bold text-xs flex items-center gap-1.5 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-lg border border-amber-200 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Modificar o Corregir Datos</span>
            </button>
          </div>

          <DocumentGenerator
            clients={clients}
            templates={templates}
            selectedClient={activeClient}
            onSelectClient={(c) => setActiveClient(c)}
            onDocumentGenerated={onDocumentGenerated}
            onOpenTemplatesTab={onOpenTemplatesTab}
          />
        </div>
      )}
    </div>
  );
};
