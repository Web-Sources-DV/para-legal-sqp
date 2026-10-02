import React, { useState } from 'react';
import {
  FolderOpen,
  Search,
  Download,
  Trash2,
  FileText,
  Calendar,
  User,
  Eye,
  X,
  FileCheck,
  RotateCw,
  Sparkles,
} from 'lucide-react';
import { GeneratedDocument, Template, Client } from '../types';
import { deleteDocumentLog } from '../services/storageService';
import { generateAndDownloadDocx } from '../services/docxService';

interface DocumentHistoryProps {
  documents: GeneratedDocument[];
  templates: Template[];
  clients: Client[];
  onDocumentsChange: () => void;
  onSelectClientAndTemplate: (client: Client, template: Template) => void;
}

export const DocumentHistory: React.FC<DocumentHistoryProps> = ({
  documents,
  templates,
  clients,
  onDocumentsChange,
  onSelectClientAndTemplate,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [viewingDoc, setViewingDoc] = useState<GeneratedDocument | null>(null);

  const filteredDocs = documents.filter((doc) => {
    return (
      doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.templateName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.passportNumber.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const handleDelete = (id: string, title: string) => {
    if (confirm(`¿Eliminar el registro del documento "${title}" del historial?`)) {
      deleteDocumentLog(id);
      onDocumentsChange();
      if (viewingDoc?.id === id) setViewingDoc(null);
    }
  };

  const handleRegenerateFromSnapshot = async (doc: GeneratedDocument) => {
    const tpl = templates.find((t) => t.id === doc.templateId);
    if (!tpl) {
      alert('La plantilla original ya no existe en el sistema.');
      return;
    }

    try {
      await generateAndDownloadDocx(tpl, doc.dataSnapshot, doc.fileName);
    } catch (err: any) {
      alert(`Error al regenerar documento: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-serif font-bold text-slate-900 text-xl">
              Historial de Documentos Generados
            </h3>
            <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2.5 py-0.5 rounded-full border border-amber-200">
              {documents.length} archivos registrados
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Registro auditable de todos los documentos Word (.docx) descargados con metadatos y valores reemplazados.
          </p>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por cliente, documento o plantilla..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-amber-500"
          />
        </div>
      </div>

      {/* History Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {filteredDocs.length === 0 ? (
          <div className="p-12 text-center">
            <FolderOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h4 className="font-semibold text-slate-700 text-sm">No hay documentos generados registrados</h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
              Cuando uses el Asistente o el Generador de Documentos, los archivos Word creados aparecerán listados aquí.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-700 uppercase font-bold text-[11px] border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4">Documento Generado</th>
                  <th className="px-6 py-4">Plantilla Base</th>
                  <th className="px-6 py-4">Cliente / Titular</th>
                  <th className="px-6 py-4">Fecha & Hora</th>
                  <th className="px-6 py-4">Tamaño</th>
                  <th className="px-6 py-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredDocs.map((doc) => (
                  <tr key={doc.id} className="hover:bg-amber-50/20 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-blue-50 text-blue-700 shrink-0 border border-blue-200">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div>
                          <div
                            onClick={() => setViewingDoc(doc)}
                            className="font-bold text-slate-900 hover:text-amber-700 cursor-pointer text-xs"
                          >
                            {doc.fileName}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            ID: {doc.id}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-800">
                      {doc.templateName}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900">{doc.clientName}</div>
                      {doc.passportNumber && (
                        <div className="text-[10px] text-slate-400 font-mono">
                          Doc: {doc.passportNumber}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-slate-500 font-mono text-[11px]">
                      {new Date(doc.generatedAt).toLocaleString('es-ES', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-6 py-4 font-mono text-[11px] text-slate-500">
                      {doc.fileSizeFormatted}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          title="Ver Valores y Variables Utilizadas"
                          onClick={() => setViewingDoc(doc)}
                          className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 transition-colors border border-slate-200"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          title="Re-descargar Documento Word (.docx)"
                          onClick={() => handleRegenerateFromSnapshot(doc)}
                          className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 transition-colors border border-amber-200"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          title="Eliminar del Registro"
                          onClick={() => handleDelete(doc.id, doc.fileName)}
                          className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition-colors border border-red-200"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: View Snapshot Details */}
      {viewingDoc && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500 text-slate-950 font-bold">
                  <FileCheck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-serif font-bold text-base text-white">{viewingDoc.title}</h4>
                  <p className="text-xs text-slate-400">{viewingDoc.fileName}</p>
                </div>
              </div>
              <button
                onClick={() => setViewingDoc(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-400 block font-semibold uppercase text-[10px]">Cliente</span>
                  <span className="font-bold text-slate-900">{viewingDoc.clientName}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold uppercase text-[10px]">Pasaporte</span>
                  <span className="font-mono font-bold text-red-700">{viewingDoc.passportNumber || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold uppercase text-[10px]">Fecha Generación</span>
                  <span className="font-bold text-slate-900">{new Date(viewingDoc.generatedAt).toLocaleDateString('es-ES')}</span>
                </div>
              </div>

              <div>
                <h5 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-2">
                  Instantánea de Variables y Valores Reemplazados:
                </h5>
                <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                  {Object.entries(viewingDoc.dataSnapshot).map(([k, v]) => (
                    <div key={k} className="p-2.5 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 bg-white hover:bg-slate-50">
                      <span className="font-mono text-amber-800 font-semibold">{`{{${k}}}`}</span>
                      <span className="font-medium text-slate-800 max-w-sm break-words">{v || '(Vacío)'}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-slate-200 pt-4 flex justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setViewingDoc(null)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50"
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  onClick={() => handleRegenerateFromSnapshot(viewingDoc)}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-sm"
                >
                  <Download className="w-4 h-4" />
                  <span>Descargar Archivo Word (.docx)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
