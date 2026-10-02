import React, { useState } from 'react';
import {
  Users,
  Search,
  UserPlus,
  Edit2,
  Trash2,
  FileText,
  Upload,
  Calendar,
  MapPin,
  Phone,
  Mail,
  FileCheck,
  Shield,
  Download,
  X,
  Plus,
} from 'lucide-react';
import { Client, GeneratedDocument } from '../types';
import { saveClient, deleteClient } from '../services/storageService';

interface ClientManagerProps {
  clients: Client[];
  documents: GeneratedDocument[];
  onClientsChange: () => void;
  onGenerateForClient: (client: Client) => void;
  onScanPassportForClient: () => void;
}

export const ClientManager: React.FC<ClientManagerProps> = ({
  clients,
  documents,
  onClientsChange,
  onGenerateForClient,
  onScanPassportForClient,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedNationality, setSelectedNationality] = useState<string>('all');
  const [editingClient, setEditingClient] = useState<Partial<Client> | null>(null);
  const [viewingClient, setViewingClient] = useState<Client | null>(null);
  const [isNewClientModalOpen, setIsNewClientModalOpen] = useState<boolean>(false);

  // Filter clients
  const filteredClients = clients.filter((c) => {
    const matchesSearch =
      c.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.passportNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.email && c.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (c.phone && c.phone.includes(searchTerm));

    const matchesNat =
      selectedNationality === 'all' ||
      c.nationality.toLowerCase() === selectedNationality.toLowerCase();

    return matchesSearch && matchesNat;
  });

  const nationalities = Array.from(new Set(clients.map((c) => c.nationality))).filter(Boolean);

  const handleSaveModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient?.fullName || !editingClient?.passportNumber) {
      alert('Por favor completa al menos el nombre y el número de pasaporte.');
      return;
    }

    const clientToSave: Client = {
      id: editingClient.id || `cli-${Date.now()}`,
      firstName: editingClient.firstName || editingClient.fullName.split(' ')[0] || '',
      lastName: editingClient.lastName || editingClient.fullName.split(' ').slice(1).join(' ') || '',
      fullName: editingClient.fullName.toUpperCase(),
      passportNumber: (editingClient.passportNumber || '').toUpperCase(),
      docType: editingClient.docType || 'pasaporte',
      nationality: (editingClient.nationality || 'ESPAÑOLA').toUpperCase(),
      issuingCountry: (editingClient.issuingCountry || editingClient.nationality || 'ESPAÑA').toUpperCase(),
      birthDate: editingClient.birthDate || '',
      expiryDate: editingClient.expiryDate || '',
      sex: editingClient.sex || 'M',
      phone: editingClient.phone || '',
      email: editingClient.email || '',
      address: editingClient.address || '',
      city: editingClient.city || 'Madrid',
      notes: editingClient.notes || '',
      createdAt: editingClient.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      documentCount: editingClient.documentCount || 0,
    };

    saveClient(clientToSave);
    onClientsChange();
    setEditingClient(null);
    setIsNewClientModalOpen(false);
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`¿Estás seguro de eliminar el cliente "${name}" de la base de datos local?`)) {
      deleteClient(id);
      onClientsChange();
      if (viewingClient?.id === id) setViewingClient(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Action Controls */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-serif font-bold text-slate-900 text-xl">
              Directorio y Gestión de Clientes
            </h3>
            <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2.5 py-0.5 rounded-full border border-amber-200">
              {clients.length} registrados
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Base de datos local permanente en el navegador para generación recurrente de contratos y poderes.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            id="btn-scan-new-client"
            onClick={onScanPassportForClient}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs shadow-md transition-all active:scale-95"
          >
            <Upload className="w-4 h-4 text-amber-400" />
            <span>Subir / Leer Pasaporte</span>
          </button>

          <button
            id="btn-manual-new-client"
            onClick={() => {
              setEditingClient({
                id: `cli-${Date.now()}`,
                fullName: '',
                passportNumber: '',
                nationality: 'ESPAÑOLA',
                docType: 'pasaporte',
                sex: 'M',
                city: 'Madrid',
              });
              setIsNewClientModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 transition-all active:scale-95"
          >
            <UserPlus className="w-4 h-4 text-slate-950" />
            <span>Nuevo Cliente Manual</span>
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por nombre, pasaporte o email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <label className="text-xs text-slate-500 font-medium whitespace-nowrap">Nacionalidad:</label>
          <select
            value={selectedNationality}
            onChange={(e) => setSelectedNationality(e.target.value)}
            className="text-xs p-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-amber-500 bg-white"
          >
            <option value="all">Todas las nacionalidades ({nationalities.length})</option>
            {nationalities.map((nat) => (
              <option key={nat} value={nat}>
                {nat}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Clients Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {filteredClients.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h4 className="font-semibold text-slate-700 text-sm">No se encontraron clientes</h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-4">
              Prueba con otro término de búsqueda o registra un nuevo cliente escaneando su pasaporte.
            </p>
            <button
              onClick={onScanPassportForClient}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 text-slate-950 font-bold text-xs shadow-sm"
            >
              <Upload className="w-4 h-4" />
              <span>Subir Foto del Pasaporte</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-700 uppercase font-bold text-[11px] border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4">Cliente / Titular</th>
                  <th className="px-6 py-4">Pasaporte / Doc</th>
                  <th className="px-6 py-4">Nacionalidad</th>
                  <th className="px-6 py-4">Contacto</th>
                  <th className="px-6 py-4 text-center">Docs</th>
                  <th className="px-6 py-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredClients.map((client) => (
                  <tr key={client.id} className="hover:bg-amber-50/20 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-slate-900 text-amber-400 font-bold flex items-center justify-center text-xs shrink-0 shadow-sm">
                          {client.fullName.charAt(0)}
                        </div>
                        <div>
                          <div
                            onClick={() => setViewingClient(client)}
                            className="font-bold text-slate-900 hover:text-amber-700 cursor-pointer text-sm"
                          >
                            {client.fullName}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            Nac: {client.birthDate || 'No registrada'} · Sexo: {client.sex || 'M'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        {client.passportNumber || 'SIN DOC'}
                      </span>
                      {client.expiryDate && (
                        <div className="text-[10px] text-slate-400 mt-1">
                          Vence: {client.expiryDate}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-semibold text-slate-800">
                        {client.nationality}
                      </span>
                      <div className="text-[10px] text-slate-400">
                        Emisor: {client.issuingCountry || client.nationality}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-0.5">
                        {client.phone && (
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-700">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span>{client.phone}</span>
                          </div>
                        )}
                        {client.email && (
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-700">
                            <Mail className="w-3 h-3 text-slate-400" />
                            <span>{client.email}</span>
                          </div>
                        )}
                        {!client.phone && !client.email && (
                          <span className="text-slate-400 italic">Sin datos</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                        {client.documentCount || 0}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          title="Generar documento para este cliente"
                          onClick={() => onGenerateForClient(client)}
                          className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 transition-colors border border-amber-200"
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                        <button
                          title="Editar Ficha"
                          onClick={() => {
                            setEditingClient(client);
                            setIsNewClientModalOpen(true);
                          }}
                          className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 transition-colors border border-slate-200"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          title="Eliminar Cliente"
                          onClick={() => handleDelete(client.id, client.fullName)}
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

      {/* Modal: New / Edit Client */}
      {isNewClientModalOpen && editingClient && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <h4 className="font-serif font-bold text-base flex items-center gap-2">
                <Users className="w-4 h-4 text-amber-400" />
                {editingClient.id && clients.some((c) => c.id === editingClient.id)
                  ? 'Editar Datos del Cliente'
                  : 'Registrar Nuevo Cliente'}
              </h4>
              <button
                onClick={() => {
                  setEditingClient(null);
                  setIsNewClientModalOpen(false);
                }}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveModal} className="p-6 overflow-y-auto space-y-4 flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Nombre Completo *
                  </label>
                  <input
                    type="text"
                    required
                    value={editingClient.fullName || ''}
                    onChange={(e) => setEditingClient({ ...editingClient, fullName: e.target.value })}
                    className="w-full text-sm font-bold p-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-amber-500"
                    placeholder="Ej. ELENA MORALES VEGA"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Nº de Pasaporte / Documento *
                  </label>
                  <input
                    type="text"
                    required
                    value={editingClient.passportNumber || ''}
                    onChange={(e) => setEditingClient({ ...editingClient, passportNumber: e.target.value })}
                    className="w-full text-sm font-mono font-bold text-red-700 p-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-amber-500"
                    placeholder="Ej. PAB492019"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Nacionalidad *
                  </label>
                  <input
                    type="text"
                    value={editingClient.nationality || ''}
                    onChange={(e) => setEditingClient({ ...editingClient, nationality: e.target.value })}
                    className="w-full text-sm p-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-amber-500"
                    placeholder="Ej. ESPAÑOLA"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Fecha de Nacimiento
                  </label>
                  <input
                    type="date"
                    value={editingClient.birthDate || ''}
                    onChange={(e) => setEditingClient({ ...editingClient, birthDate: e.target.value })}
                    className="w-full text-sm p-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Fecha de Vencimiento de Pasaporte
                  </label>
                  <input
                    type="date"
                    value={editingClient.expiryDate || ''}
                    onChange={(e) => setEditingClient({ ...editingClient, expiryDate: e.target.value })}
                    className="w-full text-sm p-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Sexo / Género
                  </label>
                  <select
                    value={editingClient.sex || 'M'}
                    onChange={(e) => setEditingClient({ ...editingClient, sex: e.target.value as any })}
                    className="w-full text-sm p-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-amber-500 bg-white"
                  >
                    <option value="M">M - Masculino</option>
                    <option value="F">F - Femenino</option>
                    <option value="X">X - Otro</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Teléfono
                  </label>
                  <input
                    type="text"
                    value={editingClient.phone || ''}
                    onChange={(e) => setEditingClient({ ...editingClient, phone: e.target.value })}
                    className="w-full text-sm p-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-amber-500"
                    placeholder="+34 600 000 000"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Correo Electrónico
                  </label>
                  <input
                    type="email"
                    value={editingClient.email || ''}
                    onChange={(e) => setEditingClient({ ...editingClient, email: e.target.value })}
                    className="w-full text-sm p-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-amber-500"
                    placeholder="cliente@ejemplo.com"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Domicilio
                  </label>
                  <input
                    type="text"
                    value={editingClient.address || ''}
                    onChange={(e) => setEditingClient({ ...editingClient, address: e.target.value })}
                    className="w-full text-sm p-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-amber-500"
                    placeholder="Calle, número, ciudad..."
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Notas y Observaciones
                  </label>
                  <textarea
                    rows={2}
                    value={editingClient.notes || ''}
                    onChange={(e) => setEditingClient({ ...editingClient, notes: e.target.value })}
                    className="w-full text-sm p-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="border-t border-slate-200 pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setEditingClient(null);
                    setIsNewClientModalOpen(false);
                  }}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-sm"
                >
                  Guardar Cliente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: View Client Profile */}
      {viewingClient && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-500 text-slate-950 font-bold flex items-center justify-center text-sm">
                  {viewingClient.fullName.charAt(0)}
                </div>
                <div>
                  <h4 className="font-serif font-bold text-base text-white">{viewingClient.fullName}</h4>
                  <p className="text-xs text-slate-400">Pasaporte: {viewingClient.passportNumber} ({viewingClient.nationality})</p>
                </div>
              </div>
              <button
                onClick={() => setViewingClient(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              {/* Info Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-400 block font-semibold uppercase text-[10px]">Pasaporte / ID</span>
                  <span className="font-mono font-bold text-red-700 text-sm">{viewingClient.passportNumber}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold uppercase text-[10px]">Nacionalidad</span>
                  <span className="font-bold text-slate-900">{viewingClient.nationality}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold uppercase text-[10px]">Sexo</span>
                  <span className="font-bold text-slate-900">{viewingClient.sex === 'M' ? 'Masculino' : 'Femenino'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold uppercase text-[10px]">Fecha Nacimiento</span>
                  <span className="font-bold text-slate-900">{viewingClient.birthDate || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold uppercase text-[10px]">Caducidad Pasaporte</span>
                  <span className="font-bold text-slate-900">{viewingClient.expiryDate || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold uppercase text-[10px]">País Emisor</span>
                  <span className="font-bold text-slate-900">{viewingClient.issuingCountry || viewingClient.nationality}</span>
                </div>
              </div>

              {/* Contact info */}
              <div className="space-y-2 border-t border-slate-100 pt-4">
                <h5 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Datos de Contacto & Domicilio</h5>
                <p><strong>Teléfono:</strong> {viewingClient.phone || 'No registrado'}</p>
                <p><strong>Email:</strong> {viewingClient.email || 'No registrado'}</p>
                <p><strong>Dirección:</strong> {viewingClient.address || 'No registrada'}</p>
                {viewingClient.notes && (
                  <div className="p-3 bg-amber-50/60 rounded-lg border border-amber-200/60 text-slate-700 mt-2">
                    <strong>Notas del Expediente:</strong> {viewingClient.notes}
                  </div>
                )}
              </div>

              {/* Generated Docs for this client */}
              <div className="border-t border-slate-100 pt-4">
                <h5 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-2">
                  Historial de Documentos Generados para este Cliente ({documents.filter((d) => d.clientId === viewingClient.id).length})
                </h5>
                {documents.filter((d) => d.clientId === viewingClient.id).length === 0 ? (
                  <p className="text-slate-400 italic">No se han generado documentos aún para este cliente.</p>
                ) : (
                  <div className="space-y-2">
                    {documents
                      .filter((d) => d.clientId === viewingClient.id)
                      .map((doc) => (
                        <div key={doc.id} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
                          <div>
                            <span className="font-semibold text-slate-900">{doc.templateName}</span>
                            <div className="text-[10px] text-slate-400 font-mono">{doc.fileName}</div>
                          </div>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {new Date(doc.generatedAt).toLocaleDateString('es-ES')}
                          </span>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              <div className="border-t border-slate-200 pt-4 flex justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setViewingClient(null)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50"
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const cli = viewingClient;
                    setViewingClient(null);
                    onGenerateForClient(cli);
                  }}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-sm"
                >
                  <FileText className="w-4 h-4" />
                  <span>Generar Documento con este Cliente</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
