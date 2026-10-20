import { hasUnsavedChanges } from "../hooks/useUnsavedChanges";
import React, { useState } from "react";
import { ArrowRight, Users, Search } from "lucide-react";
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

  const goBack = (step: 1 | 2) => {
    if (
      hasUnsavedChanges() &&
      !confirm("¿Volver y descartar los cambios sin guardar de este paso?")
    )
      return;
    setCurrentStep(step);
  };

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
      <section className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
        <h2 className="font-serif font-bold text-slate-900 text-xl">
          Documento en 3 pasos
        </h2>
        <ol
          aria-label="Progreso del documento"
          className="grid grid-cols-3 gap-2 mt-4"
        >
          {(["Cliente", "Revisar", "Generar Word"] as const).map(
            (label, index) => (
              <li
                key={label}
                aria-current={currentStep === index + 1 ? "step" : undefined}
                className={`rounded-lg px-2 py-3 text-center text-xs sm:text-sm font-semibold ${currentStep === index + 1 ? "bg-teal-100 text-teal-900" : "bg-slate-50 text-slate-600"}`}
              >
                {index + 1}. {label}
              </li>
            ),
          )}
        </ol>
        {currentStep > 1 && (
          <button
            type="button"
            className="mt-3 text-sm text-teal-800 underline"
            onClick={() => goBack(currentStep === 3 ? 2 : 1)}
          >
            Volver al paso anterior
          </button>
        )}
      </section>

      {/* Step 1: Scanner & Choice Cards */}
      {currentStep === 1 && (
        <div className="space-y-6">
          <div
            className="flex flex-wrap gap-2"
            aria-label="Cómo identificar al cliente"
          >
            <button
              onClick={() => setStep1Mode("scan")}
              className={`px-3 py-2 rounded-lg text-sm ${step1Mode === "scan" ? "bg-slate-900 text-white" : "bg-white border"}`}
            >
              Leer documento
            </button>
            <button
              onClick={() => setStep1Mode("select_client")}
              className={`px-3 py-2 rounded-lg text-sm ${step1Mode === "select_client" ? "bg-slate-900 text-white" : "bg-white border"}`}
            >
              Cliente guardado
            </button>
            <button
              onClick={handleStartManual}
              className="px-3 py-2 rounded-lg text-sm bg-white border"
            >
              Ingreso Manual Rápido
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
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-500/50"
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
                    className="px-4 py-2 rounded-lg bg-teal-500 text-slate-950 font-bold text-xs"
                  >
                    Escanear Documento Ahora
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
                      className="p-4 rounded-xl border border-slate-200 hover:border-teal-500 hover:bg-teal-50/20 cursor-pointer transition-all flex flex-col justify-between group shadow-xs hover:shadow-md"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="text-[10px] font-bold uppercase bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md">
                            {c.docType === "cedula" ? "Cédula" : "Pasaporte"}
                          </span>
                          <span className="text-[11px] font-semibold text-teal-700">
                            {c.nationality}
                          </span>
                        </div>
                        <h4 className="font-bold text-sm text-slate-900 group-hover:text-teal-800 transition-colors">
                          {c.fullName}
                        </h4>
                        <p className="text-xs text-slate-600 font-mono mt-0.5">
                          Doc: <strong>{c.passportNumber}</strong>
                        </p>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-teal-700 font-bold">
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
          onRescan={() => goBack(1)}
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


          </div>

          <DocumentGenerator
            guided
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
