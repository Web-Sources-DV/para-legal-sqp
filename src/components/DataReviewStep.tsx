import { evaluateIdentityDocument } from "../services/identityStatus";
import { useUnsavedChanges } from "../hooks/useUnsavedChanges";
import { documentTypeLabel } from "../services/fieldMapping";
import { validateClient } from "../services/validation";
import React, { useState, useMemo, useEffect } from "react";
import {
  CheckCircle,
  UserCheck,
  ArrowRight,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  UserPlus,
  Save,
  Users,
  Info,
  Calendar,
  Code,
  Copy,
  Check,
  Download,
  FileText,
  Layers,
  Cpu,
  RefreshCw,
} from "lucide-react";
import { ExtractionResult, Client } from "../types";
import {
  determineSexAgeCategory,
  calculateAgeFromBirthDate,
} from "../services/docxService";
import { buildStructuredDocumentJson } from "../services/ocrService";

interface DataReviewStepProps {
  selectedClient?: Client | null;
  extraction: ExtractionResult;
  existingClients: Client[];
  onConfirmClient: (
    client: Client,
    nextAction: "generate" | "save_only",
  ) => void | Promise<void>;
  onRescan: () => void;
}

export const DataReviewStep: React.FC<DataReviewStepProps> = ({
  extraction,
  existingClients,
  onConfirmClient,
  onRescan,
  selectedClient,
}) => {
  const initialCategory = useMemo(() => {
    return determineSexAgeCategory(extraction.birthDate, extraction.sex)
      .category;
  }, [extraction.birthDate, extraction.sex]);

  const [newClientId] = useState(() => `cli-${crypto.randomUUID()}`);
  const [retainImage, setRetainImage] = useState(false);
  const [dirty, setDirty] = useState(false);
  useUnsavedChanges(dirty);
  const [saving, setSaving] = useState(false);
  const [identityConfirmed, setIdentityConfirmed] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"form" | "json">("form");

  const [formData, setFormData] = useState<Partial<Client>>({
    id: selectedClient?.id || newClientId,
    firstName: extraction.firstName || "",
    lastName: extraction.lastName || "",
    fullName:
      extraction.fullName ||
      `${extraction.firstName || ""} ${extraction.lastName || ""}`.trim(),
    passportNumber: extraction.passportNumber || "",
    docType: extraction.docType || "otro",
    nationality: extraction.nationality || "",
    issuingCountry: extraction.issuingCountry || "",
    birthDate: extraction.birthDate || "",
    expiryDate: extraction.expiryDate || "",
    issueDate: extraction.issueDate || "",
    personalNumber: extraction.personalNumber || "",
    placeOfBirth: extraction.placeOfBirth || "",
    sex: extraction.sex || "",
    sexAgeCategory: extraction.sexAgeCategory || initialCategory,
    email: selectedClient?.email || "",
    phone: selectedClient?.phone || "",
    address: selectedClient?.address || "",
    city: selectedClient?.city || "",
    notes:
      extraction.notes ||
      "Datos verificados mediante lectura óptica OCR de documento.",
    passportImageBase64: extraction.imagePreview,
  });

  const [associateMode, setAssociateMode] = useState<"new" | "existing">(
    selectedClient ? "existing" : "new",
  );
  const [selectedExistingId, setSelectedExistingId] = useState<string>(
    selectedClient?.id || "",
  );
  const [copiedJson, setCopiedJson] = useState(false);
  const [jsonEditText, setJsonEditText] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [jsonSaveSuccess, setJsonSaveSuccess] = useState(false);

  // Compute live structured JSON
  const currentStructuredJson = useMemo(() => {
    return buildStructuredDocumentJson({
      firstName: formData.firstName,
      lastName: formData.lastName,
      fullName: formData.fullName,
      passportNumber: formData.passportNumber,
      nationality: formData.nationality,
      issuingCountry: formData.issuingCountry,
      birthDate: formData.birthDate,
      expiryDate: formData.expiryDate,
      sex: formData.sex,
      sexAgeCategory: formData.sexAgeCategory,
      docType: formData.docType,
      documentType: documentTypeLabel(formData.docType),
      personalNumber: formData.personalNumber,
      issueDate: formData.issueDate,
      placeOfBirth: formData.placeOfBirth,
      mrzLine1: extraction.mrzLine1,
      mrzLine2: extraction.mrzLine2,
      mrzLine3: extraction.mrzLine3,
      confidenceScore: extraction.confidenceScore,
      method: extraction.method,
    });
  }, [formData, extraction]);

  // Keep JSON editor text updated when formData changes
  useEffect(() => {
    setJsonEditText(JSON.stringify(currentStructuredJson, null, 2));
  }, [currentStructuredJson]);

  // Update field
  const handleChange = (field: keyof Client, value: any) => {
    setDirty(true);
    setIdentityConfirmed(false);
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };
      if (field === "birthDate" || field === "sex")
        updated.sexAgeCategory = determineSexAgeCategory(
          updated.birthDate,
          updated.sex,
        ).category;
      if (field === "firstName" || field === "lastName") {
        const fn = field === "firstName" ? value : prev.firstName || "";
        const ln = field === "lastName" ? value : prev.lastName || "";
        updated.fullName = `${fn} ${ln}`.trim().toUpperCase();
      }
      return updated;
    });
  };

  // Select existing client
  const handleSelectExisting = (clientId: string) => {
    setDirty(true);
    setIdentityConfirmed(false);
    setSelectedExistingId(clientId);
    const existing = existingClients.find((c) => c.id === clientId);
    if (existing) {
      setFormData((prev) => ({
        ...prev,
        id: existing.id,
        phone: existing.phone || "",
        email: existing.email || "",
        address: existing.address || "",
        city: existing.city || "",
      }));
    }
  };

  // Copy JSON to clipboard
  const handleCopyJson = async () => {
    const textToCopy =
      jsonEditText || JSON.stringify(currentStructuredJson, null, 2);
    try {
      await navigator.clipboard.writeText(textToCopy);
    } catch {
      setJsonError("No se pudo copiar. Usa Descargar JSON.");
      return;
    }
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2500);
  };

  // Download JSON file
  const handleDownloadJson = () => {
    const jsonStr =
      jsonEditText || JSON.stringify(currentStructuredJson, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Documento_OCR_${formData.passportNumber || "Identidad"}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Apply JSON edits to formData
  const handleApplyJsonToForm = () => {
    try {
      setDirty(true);
      setIdentityConfirmed(false);
      setJsonError(null);
      const parsed = JSON.parse(jsonEditText);

      const fn = (parsed.nombres || "").toUpperCase().trim();
      const ln = (parsed.apellidos || "").toUpperCase().trim();
      const fullName = (parsed.nombre_completo || `${fn} ${ln}`)
        .toUpperCase()
        .trim();
      const docNum = (parsed.numero_identidad || "").toUpperCase().trim();
      const nat = (parsed.nacionalidad || "").toUpperCase().trim();
      const issuing = (parsed.pais_emisor || nat).toUpperCase().trim();
      const birth = parsed.fecha_nacimiento || "";
      const exp = parsed.fecha_vencimiento || "";
      const sexVal = (parsed.sexo || "").toUpperCase().trim();
      const condJuridica = (parsed.condicion_juridica || "")
        .toUpperCase()
        .trim();
      const docTypeLower = (parsed.tipo_documento || "").toLowerCase();
      const isCedula =
        docTypeLower.includes("cedula") ||
        docTypeLower.includes("cédula") ||
        docTypeLower.includes("dni") ||
        docTypeLower.includes("carnet");

      setFormData((prev) => ({
        ...prev,
        firstName: fn,
        lastName: ln,
        fullName: fullName,
        passportNumber: docNum,
        nationality: nat,
        issuingCountry: issuing,
        birthDate: birth,
        expiryDate: exp,
        sex: sexVal,
        sexAgeCategory: condJuridica,
        docType: docTypeLower.includes("dni")
          ? "dni"
          : docTypeLower.includes("nie")
            ? "nie"
            : isCedula
              ? "cedula"
              : docTypeLower.includes("pasaporte")
                ? "pasaporte"
                : "otro",
        personalNumber: String(parsed.numero_personal ?? ""),
        placeOfBirth: String(parsed.lugar_nacimiento ?? ""),
        issueDate: String(parsed.fecha_emision ?? ""),
      }));

      setJsonSaveSuccess(true);
      setTimeout(() => setJsonSaveSuccess(false), 3000);
    } catch (err: any) {
      setJsonError(`Error de sintaxis JSON: ${err.message}`);
    }
  };

  const handleContinue = async (nextAction: "generate" | "save_only") => {
    if (saving) return;
    if (!identityConfirmed) {
      setReviewError(
        "Confirma que revisaste nombre, identidad, nacimiento, vencimiento y país emisor.",
      );
      return;
    }
    setReviewError(null);
    if (!formData.fullName?.trim() || !formData.passportNumber?.trim()) {
      setReviewError(
        "Completa el nombre y el número de identidad con los datos reales.",
      );
      return;
    }
    if (associateMode === "existing" && !selectedExistingId) {
      setReviewError("Selecciona el cliente que deseas actualizar.");
      return;
    }
    const ageCalculated = calculateAgeFromBirthDate(formData.birthDate);
    const categoryInfo = determineSexAgeCategory(
      formData.birthDate,
      formData.sex,
      formData.sexAgeCategory,
    );

    const finalClient: Client = {
      ...existingClients.find(
        (c) => associateMode === "existing" && c.id === selectedExistingId,
      ),
      id: associateMode === "existing" ? selectedExistingId : newClientId,
      firstName: (formData.firstName || "").toUpperCase(),
      lastName: (formData.lastName || "").toUpperCase(),
      fullName: (
        formData.fullName ||
        `${formData.firstName || ""} ${formData.lastName || ""}`
      )
        .trim()
        .toUpperCase(),
      passportNumber: (formData.passportNumber || "").toUpperCase(),
      docType: formData.docType || "pasaporte",
      nationality: (formData.nationality || "").toUpperCase(),
      issuingCountry: (formData.issuingCountry || "").toUpperCase(),
      birthDate: formData.birthDate || "",
      expiryDate: formData.expiryDate || "",
      sex: formData.sex || "",
      sexAgeCategory: categoryInfo.category,
      age: ageCalculated ?? undefined,
      email: formData.email || "",
      phone: formData.phone || "",
      address: formData.address || "",
      city: formData.city || "",
      notes: formData.notes || "",
      passportImageBase64: retainImage
        ? formData.passportImageBase64
        : undefined,
      issueDate: formData.issueDate,
      personalNumber: formData.personalNumber,
      placeOfBirth: formData.placeOfBirth,
      createdAt:
        existingClients.find(
          (c) => associateMode === "existing" && c.id === selectedExistingId,
        )?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      documentCount:
        existingClients.find(
          (c) => associateMode === "existing" && c.id === selectedExistingId,
        )?.documentCount || 0,
    };

    setSaving(true);
    try {
      validateClient(finalClient);
      await onConfirmClient(finalClient, nextAction);
      setDirty(false);
    } catch (error: any) {
      setReviewError(error.message || "No se pudo guardar el cliente.");
    } finally {
      setSaving(false);
    }
  };

  const documentStatus = evaluateIdentityDocument(
    formData.birthDate,
    formData.expiryDate,
    formData.sex,
  );
  return (
    <div className="space-y-6">
      {documentStatus.expiryStatus === "vencido" && (
        <div
          role="alert"
          className="border border-red-300 rounded-xl bg-red-50 text-red-900 p-4"
        >
          <strong>DOCUMENTO VENCIDO</strong>
          <p>
            Venció el {formData.expiryDate}. Puedes conservar el registro;
            verifica su validez antes de realizar trámites.
          </p>
        </div>
      )}
      {documentStatus.expiryStatus === "desconocido" && (
        <p role="status" className="bg-amber-50 text-amber-900 rounded-xl p-3">
          Vencimiento no confirmado. Revisa el documento; algunas cédulas no
          tienen fecha de caducidad.
        </p>
      )}
      <div className="bg-slate-50 border rounded-xl p-3 text-sm">
        Edad:{" "}
        {documentStatus.age === null
          ? "por confirmar"
          : `${documentStatus.age} años`}{" "}
        · Condición: {documentStatus.category || "por confirmar"}
        {documentStatus.isMinor === true ? " (menor de 18 años)" : ""} ·
        Documento:{" "}
        {documentStatus.expiryStatus === "vigente"
          ? "vigente"
          : documentStatus.expiryStatus === "vencido"
            ? "vencido"
            : "por confirmar"}
      </div>
      {reviewError && (
        <p role="alert" className="p-3 text-red-700 bg-red-50 rounded-xl">
          {reviewError}
        </p>
      )}
      {extraction.warnings
        ?.filter(
          (warning) =>
            !warning.startsWith("DOCUMENTO VENCIDO:") &&
            !warning.startsWith("Vencimiento no detectado:"),
        )
        .map((warning) => (
          <p
            key={warning}
            role="alert"
            className="bg-amber-50 p-3 text-amber-900"
          >
            {warning}
          </p>
        ))}
      <label className="flex items-start gap-3 bg-white border rounded-xl p-4">
        <input
          type="checkbox"
          checked={identityConfirmed}
          onChange={(e) => setIdentityConfirmed(e.target.checked)}
        />
        He revisado nombre, número de identidad, nacimiento, vencimiento y país
        emisor contra el documento original.
      </label>
      <label className="flex gap-3 bg-white border rounded-xl p-3">
        <input
          type="checkbox"
          checked={retainImage}
          onChange={(e) => setRetainImage(e.target.checked)}
        />
        Guardar también la imagen de identidad en el almacenamiento privado
        compartido. Sin marcar, se guardan únicamente los datos revisados.
      </label>
      {/* Top Banner */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-500 text-white flex items-center justify-center shadow-sm">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-serif font-bold text-slate-900 text-base">
                Revisa los datos del documento
              </h4>
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                JSON Listo
              </span>
            </div>
            <p className="text-xs text-slate-600">
              Revisa los campos leídos por OCR o edita directamente la
              estructura JSON que se plasmará en el documento Word.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1 bg-white rounded-lg border border-emerald-200 text-xs font-semibold text-emerald-800">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Confianza del motor: {extraction.confidenceScore ?? 0}%</span>
          </div>
          <button
            type="button"
            onClick={onRescan}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Volver a Escanear</span>
          </button>
        </div>
      </div>

      {/* Main Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Scanned Document & Extraction Info */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-slate-900 text-white rounded-xl p-4 border border-slate-800 shadow-md">
            <h5 className="font-semibold text-xs tracking-wider uppercase text-slate-400 mb-3 flex items-center gap-2">
              <Cpu className="w-3.5 h-3.5 text-amber-400" />
              Documento Leído por OCR
            </h5>

            {/* Scanned Image Preview */}
            {extraction.imagePreview ? (
              <div className="w-full aspect-[1.4] rounded-lg overflow-hidden border border-slate-700 bg-slate-950 mb-3">
                <img
                  src={extraction.imagePreview}
                  alt="Documento escaneado"
                  className="w-full h-full object-contain"
                />
              </div>
            ) : (
              <div className="w-full aspect-[1.4] rounded-lg border border-dashed border-slate-700 flex items-center justify-center text-xs text-slate-500 mb-3">
                Sin vista previa de imagen
              </div>
            )}

            {/* Extraction Metadata */}
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Método de Lectura:</span>
                <span className="font-medium text-amber-400 uppercase">
                  {extraction.method === "tesseract"
                    ? "OCR Tesseract (Local)"
                    : extraction.method === "ocr"
                      ? "OCR Alta Resolución"
                      : "OCR Óptico"}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Tipo de Documento:</span>
                <span className="font-semibold text-slate-200">
                  {formData.docType === "cedula"
                    ? "Cédula / Carnet de Identidad"
                    : "Pasaporte Oficial"}
                </span>
              </div>
              {extraction.mrzLine1 && (
                <div className="pt-1">
                  <span className="text-slate-400 block mb-1">
                    Zona MRZ de Lectura Mecánica:
                  </span>
                  <div className="p-2 bg-slate-950 rounded font-mono text-[10px] text-amber-300 break-all leading-tight border border-slate-800 space-y-0.5">
                    <div>{extraction.mrzLine1}</div>
                    {extraction.mrzLine2 && <div>{extraction.mrzLine2}</div>}
                    {extraction.mrzLine3 && <div>{extraction.mrzLine3}</div>}
                  </div>
                </div>
              )}
            </div>

            {/* JSON Quick Action Button */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setActiveTab("json")}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-xs font-semibold transition-all"
              >
                <Code className="w-3.5 h-3.5" />
                <span>Ver Datos en JSON (OCR)</span>
              </button>
            </div>
          </div>

          {/* Client Linking Card */}
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm space-y-3">
            <h5 className="font-semibold text-slate-800 text-xs tracking-wider uppercase flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-600" />
              Asociación con Clientes
            </h5>

            <div className="space-y-2">
              <label className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer text-xs">
                <input
                  type="radio"
                  name="assocMode"
                  checked={associateMode === "new"}
                  onChange={() => setAssociateMode("new")}
                  className="text-amber-600 focus:ring-amber-500"
                />
                <span className="font-medium text-slate-800">
                  Registrar como Nuevo Cliente
                </span>
              </label>

              <label className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer text-xs">
                <input
                  type="radio"
                  name="assocMode"
                  checked={associateMode === "existing"}
                  onChange={() => setAssociateMode("existing")}
                  className="text-amber-600 focus:ring-amber-500"
                />
                <span className="font-medium text-slate-800">
                  Actualizar Cliente Existente ({existingClients.length})
                </span>
              </label>
            </div>

            {associateMode === "existing" && (
              <div className="pt-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Seleccionar Cliente del Directorio:
                </label>
                <select
                  value={selectedExistingId}
                  onChange={(e) => handleSelectExisting(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-white"
                >
                  <option value="">-- Elige un cliente existente --</option>
                  {existingClients.map((cli) => (
                    <option key={cli.id} value={cli.id}>
                      {cli.fullName} ({cli.passportNumber || "Sin documento"})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Editable Form & JSON Viewer */}
        <div className="lg:col-span-8 bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-6">
          {/* Top Tabs: Formulario vs JSON */}
          <div className="flex flex-wrap items-center justify-between border-b border-slate-200 pb-3 gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab("form")}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                  activeTab === "form"
                    ? "bg-amber-500 text-slate-950 shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Formulario Visual</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("json")}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                  activeTab === "json"
                    ? "bg-amber-500 text-slate-950 shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <Code className="w-3.5 h-3.5" />
                <span>Estructura JSON (OCR)</span>
                <span className="px-1.5 py-0.2 rounded text-[10px] bg-slate-900 text-amber-300">
                  Directo
                </span>
              </button>
            </div>

            <span className="text-xs text-slate-500 font-medium">
              {activeTab === "form"
                ? "Edita los campos directamente"
                : "Formato JSON exacto para plasmar en Word"}
            </span>
          </div>

          {/* VIEW 1: Visual Form */}
          {activeTab === "form" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Nombres */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Nombres de Pila *
                  </label>
                  <input
                    type="text"
                    value={formData.firstName || ""}
                    onChange={(e) => handleChange("firstName", e.target.value)}
                    className="w-full text-sm font-medium p-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 uppercase"
                    placeholder="Ej. CARLOS ANDRÉS"
                  />
                </div>

                {/* Apellidos */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Apellidos *
                  </label>
                  <input
                    type="text"
                    value={formData.lastName || ""}
                    onChange={(e) => handleChange("lastName", e.target.value)}
                    className="w-full text-sm font-medium p-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 uppercase"
                    placeholder="Ej. RESTREPO GÓMEZ"
                  />
                </div>

                {/* Nombre Completo */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Nombre Completo (Variable: (nombre)) *
                  </label>
                  <input
                    type="text"
                    value={formData.fullName || ""}
                    onChange={(e) => handleChange("fullName", e.target.value)}
                    className="w-full text-sm font-bold text-slate-900 bg-slate-50 p-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 uppercase"
                  />
                </div>

                {/* Tipo de Documento */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Tipo de Documento ((cedula/pasaporte)) *
                  </label>
                  <select
                    value={formData.docType || "pasaporte"}
                    onChange={(e) => handleChange("docType", e.target.value)}
                    className="w-full text-sm font-medium p-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-white"
                  >
                    <option value="pasaporte">Pasaporte</option>
                    <option value="cedula">Cédula de Identidad / C.C.</option>
                    <option value="dni">DNI</option>
                    <option value="nie">Carnet de Extranjería / NIE</option>
                  </select>
                </div>

                {/* Número de Identidad */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Número de Documento ((numero de identidad)) *
                  </label>
                  <input
                    type="text"
                    value={formData.passportNumber || ""}
                    onChange={(e) =>
                      handleChange("passportNumber", e.target.value)
                    }
                    className="w-full text-sm font-mono font-bold text-amber-900 bg-amber-50/50 p-2.5 rounded-lg border border-amber-300 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 uppercase"
                    placeholder="Ej. 8-765-4321 o PA1234567"
                  />
                </div>

                {/* Nacionalidad */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Nacionalidad ((nacionalidad)) *
                  </label>
                  <input
                    type="text"
                    value={formData.nationality || ""}
                    onChange={(e) =>
                      handleChange("nationality", e.target.value)
                    }
                    className="w-full text-sm font-medium p-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 uppercase"
                    placeholder="Ej. PANAMEÑA o ESPAÑOLA"
                  />
                </div>

                {/* País Emisor */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    País Emisor ((pais_emisor))
                  </label>
                  <input
                    type="text"
                    value={formData.issuingCountry || ""}
                    onChange={(e) =>
                      handleChange("issuingCountry", e.target.value)
                    }
                    className="w-full text-sm font-medium p-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 uppercase"
                    placeholder="Ej. PANAMÁ o ESPAÑA"
                  />
                </div>

                {/* Fecha Nacimiento */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Fecha de Nacimiento ((fecha_nacimiento)) *
                  </label>
                  <input
                    type="date"
                    value={formData.birthDate || ""}
                    onChange={(e) => handleChange("birthDate", e.target.value)}
                    className="w-full text-sm font-medium p-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  />
                </div>

                {/* Sexo Biológico */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Sexo Registrado (M / F) *
                  </label>
                  <select
                    value={formData.sex || ""}
                    onChange={(e) => handleChange("sex", e.target.value)}
                    className="w-full text-sm font-medium p-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-white"
                  >
                    <option value="">Sin leer / verificar</option>
                    <option value="X">Otro (X)</option>
                    <option value="M">Masculino (M)</option>
                    <option value="F">Femenino (F)</option>
                  </select>
                </div>

                {/* Condición Legal Sexo/Edad */}
                <div className="sm:col-span-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Condición Legal en Documento ((sexo) / (sexo/edad))
                    </label>
                    <span className="text-[11px] text-amber-700 font-semibold">
                      Automático según edad y sexo
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {["VARÓN", "MUJER", "JOVEN", "MENOR"].map((cat) => {
                      const isSelected =
                        (formData.sexAgeCategory || initialCategory) === cat;
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => handleChange("sexAgeCategory", cat)}
                          className={`py-2 px-3 rounded-lg text-xs font-bold text-center transition-all ${
                            isSelected
                              ? "bg-slate-900 text-amber-400 shadow-sm border border-slate-900"
                              : "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50"
                          }`}
                        >
                          {isSelected && "✓ "}
                          {cat}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Fecha Vencimiento */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Fecha de Vencimiento
                  </label>
                  <input
                    type="date"
                    value={formData.expiryDate || ""}
                    onChange={(e) => handleChange("expiryDate", e.target.value)}
                    className="w-full text-sm font-medium p-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  />
                </div>

                {/* Teléfono */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Teléfono de Contacto
                  </label>
                  <input
                    type="text"
                    value={formData.phone || ""}
                    onChange={(e) => handleChange("phone", e.target.value)}
                    className="w-full text-sm p-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                    placeholder="+34 600 000 000"
                  />
                </div>

                {/* Correo Electrónico */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Correo Electrónico
                  </label>
                  <input
                    type="email"
                    value={formData.email || ""}
                    onChange={(e) => handleChange("email", e.target.value)}
                    className="w-full text-sm p-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                    placeholder="cliente@ejemplo.com"
                  />
                </div>

                {/* Domicilio */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Domicilio / Dirección Legal ((direccion))
                  </label>
                  <input
                    type="text"
                    value={formData.address || ""}
                    onChange={(e) => handleChange("address", e.target.value)}
                    className="w-full text-sm p-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                    placeholder="Calle, Número, Piso, Código Postal, Ciudad"
                  />
                </div>
              </div>
            </div>
          )}

          {/* VIEW 2: Interactive JSON Structure (OCR) */}
          {activeTab === "json" && (
            <div className="space-y-4">
              <div className="bg-slate-900 rounded-xl p-4 text-white space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Code className="w-4 h-4 text-amber-400" />
                    <span className="font-semibold text-xs tracking-wider uppercase text-slate-300">
                      Estructura JSON Oficial Extraída por OCR
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopyJson}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium border border-slate-700 transition-colors"
                    >
                      {copiedJson ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-300 font-bold">
                            ¡Copiado!
                          </span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-slate-300" />
                          <span>Copiar JSON</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={handleDownloadJson}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium border border-slate-700 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5 text-amber-400" />
                      <span>Descargar .json</span>
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <textarea
                    rows={15}
                    value={jsonEditText}
                    onChange={(e) => setJsonEditText(e.target.value)}
                    className="w-full bg-slate-950 text-amber-300 font-mono text-xs p-3.5 rounded-lg border border-slate-800 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 leading-relaxed outline-none"
                    spellCheck={false}
                  />
                </div>

                {jsonError && (
                  <div className="p-2.5 rounded-lg bg-red-950/80 border border-red-800 text-red-300 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                    <span>{jsonError}</span>
                  </div>
                )}

                {jsonSaveSuccess && (
                  <div className="p-2.5 rounded-lg bg-emerald-950/80 border border-emerald-800 text-emerald-300 text-xs flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>
                      ¡Campos actualizados correctamente desde el JSON!
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between pt-1">
                  <p className="text-[11px] text-slate-400">
                    Puedes editar cualquier clave o valor en el JSON y
                    sincronizarlo.
                  </p>
                  <button
                    type="button"
                    onClick={handleApplyJsonToForm}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all shadow-sm"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Validar y Aplicar Cambios al Formulario</span>
                  </button>
                </div>
              </div>

              {/* Document Mapping Guide */}
              <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 space-y-2">
                <h5 className="font-bold text-xs text-amber-950 uppercase tracking-wider flex items-center gap-2">
                  <Layers className="w-4 h-4 text-amber-700" />
                  Correspondencia Directa: Del JSON a tu Documento Word (.docx)
                </h5>
                <p className="text-xs text-amber-900 leading-relaxed">
                  Los valores leídos por el OCR se sustituyen automáticamente en
                  las siguientes variables de tu plantilla:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 text-xs">
                  <div className="p-2 bg-white rounded-lg border border-amber-200 flex justify-between items-center">
                    <code className="text-slate-800 font-bold">(nombre)</code>
                    <span className="text-amber-800 font-mono text-[11px]">
                      {currentStructuredJson.nombre_completo || "NOMBRE"}
                    </span>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-amber-200 flex justify-between items-center">
                    <code className="text-slate-800 font-bold">
                      (numero de identidad)
                    </code>
                    <span className="text-amber-800 font-mono text-[11px]">
                      {currentStructuredJson.numero_identidad || "NUMERO"}
                    </span>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-amber-200 flex justify-between items-center">
                    <code className="text-slate-800 font-bold">
                      (cedula/pasaporte)
                    </code>
                    <span className="text-amber-800 font-mono text-[11px]">
                      {currentStructuredJson.tipo_documento}
                    </span>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-amber-200 flex justify-between items-center">
                    <code className="text-slate-800 font-bold">
                      (nacionalidad)
                    </code>
                    <span className="text-amber-800 font-mono text-[11px]">
                      {currentStructuredJson.nacionalidad?.toLowerCase()}
                    </span>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-amber-200 flex justify-between items-center">
                    <code className="text-slate-800 font-bold">(sexo)</code>
                    <span className="text-amber-800 font-mono text-[11px]">
                      {currentStructuredJson.condicion_juridica}
                    </span>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-amber-200 flex justify-between items-center">
                    <code className="text-slate-800 font-bold">
                      (fecha_nacimiento)
                    </code>
                    <span className="text-amber-800 font-mono text-[11px]">
                      {currentStructuredJson.fecha_nacimiento || "YYYY-MM-DD"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Action Footer Buttons */}
          <div className="border-t border-slate-200 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <button
              type="button"
              id="btn-save-client-only"
              disabled={saving || !identityConfirmed}
              onClick={() => handleContinue("save_only")}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-sm transition-colors"
            >
              <Save className="w-4 h-4 text-slate-600" />
              <span>Guardar en Directorio de Clientes</span>
            </button>

            <button
              type="button"
              id="btn-confirm-and-generate"
              disabled={saving || !identityConfirmed}
              onClick={() => handleContinue("generate")}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/20 active:scale-95 transition-all"
            >
              <span>Continuar a Plasmar en Documento Word</span>
              <ArrowRight className="w-4 h-4 text-slate-950" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
