import { buildComprehensiveReplacementMap } from "../services/docxService";
import { canonicalField } from "../services/fieldMapping";
import React from "react";
import type { Client, Idoneo, Template } from "../types";
import {
  PenTool,
  Check,
  MoveHorizontal,
  Sliders,
  ChevronUp,
  ChevronDown,
  Sparkles,
  Eye,
} from "lucide-react";

interface Props {
  activeTemplate: Template;
  formValues: Record<string, string>;
  sigAlignment: "column-left" | "center" | "column-right";
  sigEnabled: boolean;
  setSigEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  sigColumnOffset: number;
  setSigColumnOffset: React.Dispatch<React.SetStateAction<number>>;
  sigBlankLines: number;
  setSigBlankLines: React.Dispatch<React.SetStateAction<number>>;
  sigUseTable: boolean;
  setSigUseTable: React.Dispatch<React.SetStateAction<boolean>>;
  customSigClientName: string;
  setCustomSigClientName: React.Dispatch<React.SetStateAction<string>>;
  customSigClientDoc: string;
  setCustomSigClientDoc: React.Dispatch<React.SetStateAction<string>>;
  customSigLawyerTitle: string;
  setCustomSigLawyerTitle: React.Dispatch<React.SetStateAction<string>>;
  customSigLawyerCedula: string;
  customSigLawyerIdoneidad: string;
  simulatedNameLength: "actual" | "short" | "medium" | "long" | "very_long";
  setSimulatedNameLength: React.Dispatch<
    React.SetStateAction<"actual" | "short" | "medium" | "long" | "very_long">
  >;
  showVerticalGuide: boolean;
  setShowVerticalGuide: React.Dispatch<React.SetStateAction<boolean>>;
  showSigAdvancedConfig: boolean;
  setShowSigAdvancedConfig: React.Dispatch<React.SetStateAction<boolean>>;
  previewClientName: string;
  previewClientDoc: string;
  activeClient: Client | null;
}
export function SignatureStudio({
  activeTemplate,
  formValues,
  sigAlignment,
  sigEnabled,
  setSigEnabled,
  sigColumnOffset,
  setSigColumnOffset,
  sigBlankLines,
  setSigBlankLines,
  sigUseTable,
  setSigUseTable,
  customSigClientName,
  setCustomSigClientName,
  customSigClientDoc,
  setCustomSigClientDoc,
  customSigLawyerTitle,
  setCustomSigLawyerTitle,
  customSigLawyerCedula,
  customSigLawyerIdoneidad,
  simulatedNameLength,
  setSimulatedNameLength,
  showVerticalGuide,
  setShowVerticalGuide,
  showSigAdvancedConfig,
  setShowSigAdvancedConfig,
  previewClientName,
  previewClientDoc,
  activeClient,
}: Props) {
  return (
    <>
      {/* Signature Studio & Document Sheet Preview (Antes de Generar) */}
      <div className="pt-6 border-t border-slate-200">
        <label className="flex items-center gap-2 p-3 mb-3 bg-amber-50 rounded-xl text-sm">
          <input
            type="checkbox"
            checked={sigEnabled}
            onChange={(e) => setSigEnabled(e.target.checked)}
          />
          Aplicar este bloque de firmas al Word (requiere ACEPTO PODER y OTORGO
          PODER en una misma línea). Sin activarlo se conserva la plantilla
          original.
        </label>
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
                    Simulación de firmas
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-1 max-w-2xl">
                  Revisa y acomoda el nombre del cliente en el área de la firma
                  bajo{" "}
                  <strong className="text-amber-400 font-bold">
                    OTORGO PODER:
                  </strong>{" "}
                  antes de generar el Word. El sistema ajusta la alineación
                  automáticamente para nombres tanto cortos como largos
                  (idéntico al Ejemplo 2).
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
                    ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                    : "bg-slate-800 border-slate-700 text-slate-400 hover:text-white"
                }`}
              >
                <MoveHorizontal className="w-3.5 h-3.5" />
                <span>
                  {showVerticalGuide ? "Ocultar Guía" : "Ver Guía de Columna"}
                </span>
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
                <span>
                  Simulador de Nombres (Prueba de Acomodo Corto vs Largo):
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setSimulatedNameLength("actual")}
                  className={`px-2.5 py-1 rounded-lg text-xs transition-all font-semibold ${
                    simulatedNameLength === "actual"
                      ? "bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/30 scale-105"
                      : "bg-slate-700/80 hover:bg-slate-600 text-slate-300"
                  }`}
                  title="Nombre real del cliente seleccionado"
                >
                  Actual (
                  {activeClient
                    ? activeClient.fullName.split(" ")[0]
                    : "Cliente"}
                  )
                </button>
                <button
                  type="button"
                  onClick={() => setSimulatedNameLength("short")}
                  className={`px-2.5 py-1 rounded-lg text-xs transition-all font-semibold ${
                    simulatedNameLength === "short"
                      ? "bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/30 scale-105"
                      : "bg-slate-700/80 hover:bg-slate-600 text-slate-300"
                  }`}
                  title="Probar nombre muy corto (6 caracteres)"
                >
                  Corto: ANA LI
                </button>
                <button
                  type="button"
                  onClick={() => setSimulatedNameLength("medium")}
                  className={`px-2.5 py-1 rounded-lg text-xs transition-all font-semibold ${
                    simulatedNameLength === "medium"
                      ? "bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/30 scale-105"
                      : "bg-slate-700/80 hover:bg-slate-600 text-slate-300"
                  }`}
                  title="Probar nombre medio (15 caracteres)"
                >
                  Medio: CARLOS RESTREPO
                </button>
                <button
                  type="button"
                  onClick={() => setSimulatedNameLength("long")}
                  className={`px-2.5 py-1 rounded-lg text-xs transition-all font-semibold ${
                    simulatedNameLength === "long"
                      ? "bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/30 scale-105"
                      : "bg-slate-700/80 hover:bg-slate-600 text-slate-300"
                  }`}
                  title="Probar nombre largo del Ejemplo 2 (25 caracteres)"
                >
                  Largo: GUSTAVO JOSE ACOSTA MUÑOZ
                </button>
                <button
                  type="button"
                  onClick={() => setSimulatedNameLength("very_long")}
                  className={`px-2.5 py-1 rounded-lg text-xs transition-all font-semibold ${
                    simulatedNameLength === "very_long"
                      ? "bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/30 scale-105"
                      : "bg-slate-700/80 hover:bg-slate-600 text-slate-300"
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
                    { label: "50%", val: 50 },
                    { label: "56% (Ejemplo 2)", val: 56 },
                    { label: "60%", val: 60 },
                    { label: "64%", val: 64 },
                  ].map((p) => (
                    <button
                      key={p.val}
                      type="button"
                      onClick={() => setSigColumnOffset(p.val)}
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                        sigColumnOffset === p.val
                          ? "bg-amber-500 text-slate-950 border-amber-400 font-bold"
                          : "bg-slate-700 text-slate-300 border-slate-600 hover:bg-slate-600"
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
                    { label: "1 Línea", val: 1 },
                    { label: "2 Líneas (Recomendado)", val: 2 },
                    { label: "3 Líneas", val: 3 },
                    { label: "4 Líneas", val: 4 },
                  ].map((s) => (
                    <button
                      key={s.val}
                      type="button"
                      onClick={() => setSigBlankLines(s.val)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                        sigBlankLines === s.val
                          ? "bg-amber-500 text-slate-950 border-amber-400 font-bold"
                          : "bg-slate-700 text-slate-300 border-slate-600 hover:bg-slate-600"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-slate-400 mt-1.5">
                  Espacio en blanco vertical para que el cliente y letrado
                  firmen físicamente con bolígrafo.
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
                        ? "bg-emerald-950/60 border-emerald-500/50 text-emerald-300"
                        : "bg-slate-700/60 border-slate-600 text-slate-300"
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
                        ? "bg-emerald-950/60 border-emerald-500/50 text-emerald-300"
                        : "bg-slate-700/60 border-slate-600 text-slate-300"
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
                    onChange={(e) =>
                      setCustomSigClientName(e.target.value.toUpperCase())
                    }
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
                    onChange={(e) =>
                      setCustomSigClientDoc(e.target.value.toUpperCase())
                    }
                    placeholder="Ej. PASAPORTE No. TEST-001"
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
                    onChange={(e) =>
                      setCustomSigLawyerTitle(e.target.value.toUpperCase())
                    }
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
              <span>Vista de texto y simulación del bloque de firmas</span>
            </div>

            <div className="bg-white text-slate-900 rounded-xl p-6 sm:p-10 shadow-2xl border border-slate-300 font-serif relative overflow-hidden max-w-2xl mx-auto">
              <div className="text-center font-sans font-bold mb-4">
                Texto de la plantilla seleccionada · {activeTemplate.name}
              </div>
              <p className="whitespace-pre-wrap text-xs leading-relaxed text-slate-800">
                {activeTemplate.samplePreviewText
                  ? activeTemplate.samplePreviewText.replace(
                      /\{\{[^{}]+\}\}|\{[^{}]+\}|\([^()]+\)|\[[^\[\]]+\]/g,
                      (marker) => {
                        const map = buildComprehensiveReplacementMap(
                          formValues,
                          activeClient,
                        );
                        return (
                          map[marker] ??
                          Object.entries(map).find(
                            ([key]) =>
                              canonicalField(key) === canonicalField(marker),
                          )?.[1] ??
                          marker
                        );
                      },
                    )
                  : "Vista de texto no disponible para esta plantilla anterior. El documento Word conserva el contenido y formato del archivo cargado."}
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
                      <span className="opacity-40 select-none">
                        {"(Espacio para firma física)"}
                      </span>
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
                      sigAlignment === "center" ? "text-center" : "text-left"
                    }`}
                    style={{
                      gridColumn: `${Math.max(5, Math.ceil((sigColumnOffset / 100) * 12) + 1)} / span ${
                        12 -
                        Math.max(4, Math.floor((sigColumnOffset / 100) * 12))
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
                      <span className="opacity-40 select-none">
                        {"(Espacio para firma física)"}
                      </span>
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
                  Modo activo:{" "}
                  <strong className="text-emerald-300">
                    {sigUseTable
                      ? "Tabla Invisible OpenXML (Recomendado)"
                      : "Tabulaciones"}
                  </strong>
                </span>
              </div>
              <div className="text-slate-400">
                Posición de columna:{" "}
                <strong className="text-amber-400">{sigColumnOffset}%</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
