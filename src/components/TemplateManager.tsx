import React, { useState } from 'react';
import {
  FileText,
  Upload,
  Plus,
  Trash2,
  Download,
  CheckCircle2,
  Tag,
  Sparkles,
  Info,
  Layers,
  FileCode,
  ArrowRight,
  Eye,
  FileCheck,
  UserCheck,
  Award,
  Mail,
  Phone,
  Scale,
  Shield,
  Briefcase,
} from 'lucide-react';
import saveAs from 'file-saver';
import { Template, PlaceholderDef, Idoneo, IdoneoName } from '../types';
import { parseDocxFile } from '../services/docxService';
import { saveTemplate, deleteTemplate } from '../services/storageService';
import { IDONEOS, DEFAULT_IDONEO, getIdoneoByName, customizeTemplateForIdoneo } from '../data/idoneos';

interface TemplateManagerProps {
  templates: Template[];
  onTemplatesChange: () => void;
  onUseTemplate: (template: Template) => void;
}

export const TemplateManager: React.FC<TemplateManagerProps> = ({
  templates,
  onTemplatesChange,
  onUseTemplate,
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccessMessage, setUploadSuccessMessage] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  
  // Selected Idóneo tab (default: Susana Sabalza)
  const [selectedIdoneoId, setSelectedIdoneoId] = useState<string>(DEFAULT_IDONEO.id);
  const [viewingTemplate, setViewingTemplate] = useState<Template | null>(null);

  const activeIdoneo: Idoneo = IDONEOS.find((i) => i.id === selectedIdoneoId) || DEFAULT_IDONEO;

  // New Template Form State
  const [newTemplateData, setNewTemplateData] = useState<{
    name: string;
    description: string;
    category: Template['category'];
    targetIdoneo: string; // 'all' or specific Idoneo ID
    fileName: string;
    fileBase64: string;
    previewText: string;
    placeholders: string[];
    placeholderDefs: PlaceholderDef[];
  } | null>(null);

  const handleDocxUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) { setUploadError('La plantilla debe pesar menos de 3 MB para el almacenamiento local.'); return; }

    if (!file.name.toLowerCase().endsWith('.docx')) {
      setUploadError('Por favor selecciona un archivo con extensión .docx de Microsoft Word.');
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    setUploadSuccessMessage(null);

    try {
      const buffer = await file.arrayBuffer();
      const parsed = await parseDocxFile(buffer, file.name);

      const inferredName = file.name
        .replace(/\.docx$/i, '')
        .replace(/_/g, ' ')
        .replace(/-/g, ' ');

      setNewTemplateData({
        name: inferredName,
        description: `Plantilla subida con ${parsed.placeholders.length} marcadores {{tags}} detectados.`,
        category: 'General',
        targetIdoneo: activeIdoneo.id,
        fileName: file.name,
        fileBase64: parsed.fileBase64,
        previewText: parsed.previewText,
        placeholders: parsed.placeholders,
        placeholderDefs: parsed.placeholderDefs,
      });
    } catch (err: any) {
      console.error('Error parsing docx:', err);
      setUploadError(`Error al procesar el archivo Word .docx: ${err.message || 'Estructura no válida'}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveNewTemplate = async () => {
    if (!newTemplateData) return;

    const assignedIdoneoObj =
      newTemplateData.targetIdoneo === 'all'
        ? undefined
        : IDONEOS.find((i) => i.id === newTemplateData.targetIdoneo)?.name;

    const templateToSave: Template = {
      id: `tpl-${Date.now()}`,
      name: newTemplateData.name,
      description: newTemplateData.description,
      category: newTemplateData.category,
      idoneo: assignedIdoneoObj,
      fileName: newTemplateData.fileName,
      fileData: newTemplateData.fileBase64,
      samplePreviewText: newTemplateData.previewText,
      placeholders: newTemplateData.placeholders,
      placeholderDefs: newTemplateData.placeholderDefs,
      isDefault: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      usageCount: 0,
    };

    if (!templateToSave.name.trim()) { setUploadError('Escribe un nombre para la plantilla.'); return; }
    try { await saveTemplate(templateToSave); } catch (error: any) { setUploadError(error.message || 'No se pudo guardar la plantilla.'); return; }
    onTemplatesChange();
    setNewTemplateData(null);
    setUploadSuccessMessage(`¡Plantilla "${templateToSave.name}" guardada con éxito en la base de datos!`);
    setTimeout(() => setUploadSuccessMessage(null), 5000);
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`¿Estás seguro de eliminar la plantilla "${name}"?`)) {
      try { await deleteTemplate(id); } catch (error: any) { setUploadError(error.message || 'No se pudo eliminar la plantilla.'); return; }
      onTemplatesChange();
      if (viewingTemplate?.id === id) setViewingTemplate(null);
    }
  };

  const handleDownloadBlankTemplate = (template: Template, idoneo: Idoneo) => {
    if (!template.fileData) return;
    const binaryString = atob(template.fileData);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const blob = new Blob([bytes], {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    const safeName = `${template.name.replace(/[^a-zA-Z0-9]/g, '_')}_${idoneo.name.replace(/[^a-zA-Z0-9]/g, '_')}.docx`;
    saveAs(blob, safeName);
  };

  // Filter templates for the active Idóneo:
  // Shows templates specifically assigned to this Idoneo OR general templates (available for all idoneos)
  const templatesForActiveIdoneo = templates.filter((t) => {
    if (!t.idoneo) return true; // Available for all idoneos
    return t.idoneo.toLowerCase() === activeIdoneo.name.toLowerCase();
  });

  return (
    <div className="space-y-6">
      {/* Header & Uploader Banner */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h3 className="font-serif font-bold text-slate-900 text-xl sm:text-2xl">
                Plantillas por Idóneo / Letrado
              </h3>
              <span className="bg-amber-100 text-amber-900 text-xs font-bold px-2.5 py-0.5 rounded-full border border-amber-200">
                5 Idóneos Registrados
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
              Selecciona el Idóneo para acceder a todos los modelos de documentos Word (.docx) configurados con su nombre, número de colegiado y facultades de representación legal.
            </p>
          </div>
        </div>

        {/* Idóneo Tabs Bar (Replacing category tabs) */}
        <div className="pt-2">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
            Seleccionar Idóneo / Letrado Responsable:
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
            {IDONEOS.map((idoneo) => {
              const isSelected = idoneo.id === activeIdoneo.id;
              return (
                <button
                  key={idoneo.id}
                  id={`tab-idoneo-${idoneo.id}`}
                  type="button"
                  onClick={() => setSelectedIdoneoId(idoneo.id)}
                  className={`p-3 rounded-2xl border text-left flex items-center gap-3 transition-all ${
                    isSelected
                      ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-amber-500/50 scale-[1.02]'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 shadow-xs ${
                      isSelected
                        ? 'bg-amber-500 text-slate-950 font-extrabold'
                        : 'bg-white text-slate-800 border border-slate-200'
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

        {/* Selected Idóneo Profile Highlight Card */}
        <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 text-white border border-slate-800 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 font-serif font-extrabold text-xl flex items-center justify-center shrink-0 shadow-lg border-2 border-amber-300/40">
              {activeIdoneo.initials}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="font-serif font-bold text-lg text-slate-100">
                  {activeIdoneo.formalTitle}
                </h4>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[11px] font-semibold">
                  {activeIdoneo.role}
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[11px] font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Idóneo Activo
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                {activeIdoneo.description}
              </p>
              <div className="flex flex-wrap items-center gap-4 mt-2 text-[11px] text-slate-400">
                <span className="flex items-center gap-1 text-amber-300 font-mono">
                  <Award className="w-3.5 h-3.5" />
                  {activeIdoneo.colegiado}
                </span>
                <span className="flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  {activeIdoneo.email}
                </span>
                <span className="flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  {activeIdoneo.phone}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Upload Zone */}
        <div className="border-2 border-dashed border-slate-300 hover:border-amber-500 rounded-2xl p-6 sm:p-8 bg-slate-50 hover:bg-amber-50/20 transition-all text-center">
          <label htmlFor="docx-template-input" className="cursor-pointer block">
            <div className="w-12 h-12 rounded-2xl bg-white shadow-sm border border-slate-200 flex items-center justify-center mx-auto mb-2.5 text-amber-600">
              <Upload className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-slate-800 text-sm mb-1">
              {isUploading ? 'Analizando marcadores en el archivo .docx...' : 'Subir nueva plantilla Word (.docx)'}
            </h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto mb-3">
              Puedes asignar la plantilla a <strong className="text-slate-800">{activeIdoneo.name}</strong> o dejarla disponible para todos los Idóneos.
            </p>
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold shadow-sm hover:bg-slate-800 transition-colors">
              <FileText className="w-4 h-4 text-amber-400" />
              Seleccionar Archivo .docx
            </span>
            <input
              id="docx-template-input"
              type="file"
              accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={handleDocxUpload}
              className="hidden"
            />
          </label>
        </div>

        {/* Success / Error alerts */}
        {uploadSuccessMessage && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-3 text-emerald-800 text-xs font-semibold">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{uploadSuccessMessage}</span>
          </div>
        )}

        {uploadError && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
            {uploadError}
          </div>
        )}
      </div>

      {/* Detected Tags Confirmation Modal when file is uploaded */}
      {newTemplateData && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <h4 className="font-serif font-bold text-base flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                Configurar Nueva Plantilla Word
              </h4>
              <button
                onClick={() => setNewTemplateData(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1 text-xs">
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-slate-800">Archivo detectado: </span>
                  <span className="font-mono text-amber-900">{newTemplateData.fileName}</span>
                </div>
                <span className="bg-amber-500 text-slate-950 font-bold px-2 py-0.5 rounded-full text-[10px]">
                  {newTemplateData.placeholders.length} marcadores
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Nombre de la Plantilla *
                </label>
                <input
                  type="text"
                  value={newTemplateData.name}
                  onChange={(e) => setNewTemplateData({ ...newTemplateData, name: e.target.value })}
                  className="w-full text-sm font-bold p-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Asignación por Idóneo
                  </label>
                  <select
                    value={newTemplateData.targetIdoneo}
                    onChange={(e) => setNewTemplateData({ ...newTemplateData, targetIdoneo: e.target.value })}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-amber-500 bg-white font-semibold"
                  >
                    <option value="all">🌐 Disponible para todos los Idóneos</option>
                    {IDONEOS.map((i) => (
                      <option key={i.id} value={i.id}>
                        👤 {i.name} ({i.role})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Categoría Legal
                  </label>
                  <select
                    value={newTemplateData.category}
                    onChange={(e) => setNewTemplateData({ ...newTemplateData, category: e.target.value as any })}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-amber-500 bg-white"
                  >
                    <option value="Notarial">Notarial</option>
                    <option value="Contratos">Contratos</option>
                    <option value="Migratorio">Migratorio</option>
                    <option value="Judicial">Judicial</option>
                    <option value="Corporativo">Corporativo</option>
                    <option value="General">General</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Descripción Breve
                </label>
                <input
                  type="text"
                  value={newTemplateData.description}
                  onChange={(e) => setNewTemplateData({ ...newTemplateData, description: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Detected tags chips */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                  Marcadores Encontrados en el Documento:
                </label>
                {newTemplateData.placeholders.length === 0 ? (
                  <div className="p-3 bg-amber-50/60 rounded-lg text-amber-800 text-[11px]">
                    ⚠️ No se encontraron marcadores con formato <code className="font-mono">{`{{nombre}}`}</code> o <code className="font-mono">(nombre)</code>. La plantilla podrá usarse pero no reemplazará campos dinámicos automáticamente.
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5 p-3 bg-slate-50 rounded-xl border border-slate-200 max-h-40 overflow-y-auto">
                    {newTemplateData.placeholders.map((tag) => (
                      <span
                        key={tag}
                        className="font-mono text-[11px] bg-white text-slate-800 px-2 py-1 rounded border border-slate-300 font-semibold flex items-center gap-1 shadow-xs"
                      >
                        <Tag className="w-3 h-3 text-amber-600" />
                        {tag.startsWith('(') ? tag : tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t border-slate-200 pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setNewTemplateData(null)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveNewTemplate}
                  className="px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow-sm"
                >
                  Guardar Plantilla en Base de Datos
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Templates Cards Grid for Selected Idóneo */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-serif font-bold text-slate-900 text-base flex items-center gap-2">
            <Scale className="w-4 h-4 text-amber-600" />
            Documentos Disponibles para: <span className="text-amber-800">{activeIdoneo.name}</span>
          </h4>
          <span className="text-xs text-slate-500 font-medium">
            {templatesForActiveIdoneo.length} documentos listos para generar
          </span>
        </div>

        {templatesForActiveIdoneo.length === 0 ? (
          <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200/60 shadow-xs">
              <FileText className="w-7 h-7" />
            </div>
            <div className="max-w-md mx-auto">
              <h5 className="font-serif font-bold text-slate-900 text-base">
                No hay plantillas registradas para {activeIdoneo.name}
              </h5>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                El apartado de plantillas se encuentra limpio. Sube tus documentos oficiales en formato Word (.docx) arriba para asignarlos a este Idóneo o dejarlos disponibles para todo el despacho.
              </p>
            </div>
            <div>
              <label
                htmlFor="docx-template-input"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 cursor-pointer transition-all active:scale-95"
              >
                <Upload className="w-4 h-4" />
                <span>Subir Primera Plantilla .docx</span>
              </label>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {templatesForActiveIdoneo.map((template) => {
              const customizedTemplate = customizeTemplateForIdoneo(template, activeIdoneo);

              return (
                <div
                  key={`${template.id}-${activeIdoneo.id}`}
                  className="bg-white rounded-2xl border border-slate-200 hover:border-amber-400 shadow-sm hover:shadow-md transition-all p-6 flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 group-hover:bg-amber-100 group-hover:text-amber-900 transition-colors">
                        {template.category}
                      </span>
                      <span className="font-mono text-[10px] font-bold text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                        {template.placeholders.length} marcadores
                      </span>
                    </div>

                    <div className="flex items-start gap-3 mb-3">
                      <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600 shrink-0 border border-amber-200/60">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-serif font-bold text-slate-900 text-sm leading-snug group-hover:text-amber-900">
                          {template.name}
                        </h4>
                        <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                          {template.description}
                        </p>
                      </div>
                    </div>

                    {/* Idóneo Assignment Info Badge */}
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs mb-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                          Idóneo Asignado:
                        </span>
                        <span className="font-serif font-bold text-slate-900 text-[11px]">
                          {activeIdoneo.formalTitle}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono flex items-center justify-between">
                        <span>Nº Colegiado:</span>
                        <span className="text-amber-800 font-bold">{activeIdoneo.colegiado}</span>
                      </div>
                    </div>

                    {/* Tags preview snippet */}
                    <div className="pt-2 border-t border-slate-100">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1.5">
                        Marcadores Principales:
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {template.placeholders.slice(0, 4).map((tag) => (
                          <span
                            key={tag}
                            className="font-mono text-[10px] bg-slate-50 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200"
                          >
                            {tag.startsWith('(') ? tag : tag}
                          </span>
                        ))}
                        {template.placeholders.length > 4 && (
                          <span className="text-[10px] font-bold text-amber-700 self-center">
                            +{template.placeholders.length - 4} más
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Bottom Actions */}
                  <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        title="Descargar Plantilla Base en Word (.docx)"
                        onClick={() => handleDownloadBlankTemplate(template, activeIdoneo)}
                        className="p-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600 transition-colors border border-slate-200 text-xs flex items-center gap-1"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline text-[11px]">Base .docx</span>
                      </button>

                      <button
                        type="button"
                        title="Eliminar Plantilla"
                        onClick={() => handleDelete(template.id, template.name)}
                        className="p-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition-colors border border-red-200 text-xs"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => onUseTemplate(customizedTemplate)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-sm transition-all active:scale-95"
                    >
                      <span>⚡ Usar con {activeIdoneo.name.split(' ')[0]}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Helper Box: Guide for Lawyer / Admin */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 border border-slate-800 shadow-md">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-amber-500/20 text-amber-400 rounded-xl shrink-0 border border-amber-500/30">
            <Info className="w-6 h-6" />
          </div>
          <div>
            <h4 className="font-serif font-bold text-base text-slate-100 mb-1">
              ¿Cómo funcionan las pestañas por Idóneo en SQP PARA LEGAL?
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed max-w-3xl mb-3">
              Cada pestaña representa a uno de los letrados idóneos: <strong className="text-amber-300">Susana Sabalza</strong>, <strong className="text-amber-300">Marta Aparicio</strong>, <strong className="text-amber-300">Lizohar Godoy</strong>, <strong className="text-amber-300">Martín Downer</strong> y <strong className="text-amber-300">Antony Talla</strong>. Al seleccionar una plantilla desde cualquier pestaña, los campos <code className="text-amber-300 font-mono">(abogado_nombre)</code> y <code className="text-amber-300 font-mono">(abogado_colegiado)</code> se completan automáticamente con los datos del letrado elegido.
            </p>
            <p className="text-xs text-amber-200/90 leading-relaxed max-w-3xl mb-3 bg-amber-500/10 p-2.5 rounded-lg border border-amber-500/20">
              <strong className="text-amber-300">Reglas automáticas de formato:</strong> Todos los datos reemplazados se insertan en <strong>MAYÚSCULAS Y EN NEGRITA</strong>, excepto <code className="text-amber-300 font-mono">(nacionalidad)</code> que se mantiene en <em>minúsculas y sin negrita</em> según las normas notariales.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 font-mono text-[11px] text-amber-300 bg-slate-950/80 p-3 rounded-xl border border-slate-800">
              <div>• (nombre)</div>
              <div>• (numero de identidad)</div>
              <div>• (nacionalidad)</div>
              <div>• (cedula/pasaporte)</div>
              <div>• (fecha_nacimiento)</div>
              <div>• (pais_emisor)</div>
              <div>• (direccion)</div>
              <div>• (telefono)</div>
              <div>• (email)</div>
              <div>• (abogado_nombre)</div>
              <div>• (abogado_colegiado)</div>
              <div>• (ciudad_firma)</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

