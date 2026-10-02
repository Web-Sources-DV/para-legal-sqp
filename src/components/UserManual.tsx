import React, { useState } from 'react';
import {
  BookOpen,
  Upload,
  Camera,
  FileCheck,
  FileDown,
  Database,
  Layers,
  Sparkles,
  HelpCircle,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Code2,
  Copy,
  Check,
  Users,
  FolderOpen,
  FileText,
  Shield,
  Search,
  ExternalLink,
  ChevronRight,
  HardDrive,
  Laptop,
  Scale,
  Cloud,
} from 'lucide-react';
import { ActiveTab } from '../types';

interface UserManualProps {
  onNavigateTab: (tab: ActiveTab) => void;
}

export const UserManual: React.FC<UserManualProps> = ({ onNavigateTab }) => {
  const [activeSection, setActiveSection] = useState<
    'workflow' | 'upload' | 'save' | 'generate' | 'templates' | 'database' | 'faq'
  >('workflow');
  const [copiedTag, setCopiedTag] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const handleCopy = async (tag: string) => {
    try { await navigator.clipboard.writeText(tag); } catch { alert('No se pudo copiar. Selecciona el marcador y cópialo manualmente.'); return; }
    setCopiedTag(tag);
    setTimeout(() => setCopiedTag(null), 2000);
  };

  const coreVariables = [
    { tag: '(nombre)', desc: 'Nombre completo del cliente', example: 'CARLOS ANDRÉS PÉREZ GÓMEZ', cat: 'Cliente' },
    { tag: '(sexo)', desc: 'Condición legal según sexo y edad (VARÓN, MUJER, JOVEN, MENOR)', example: 'VARÓN / MUJER / JOVEN / MENOR', cat: 'Pasaporte' },
    { tag: '(sexo/edad)', desc: 'Condición jurídica y rango de edad', example: 'VARÓN / MUJER / JOVEN / MENOR', cat: 'Pasaporte' },
    { tag: '(numero de identidad)', desc: 'Número de identidad (Cédula o Pasaporte)', example: '8-765-4321 / PA84729104', cat: 'Pasaporte' },
    { tag: '(nacionalidad)', desc: 'Nacionalidad oficial en mayúsculas', example: 'ESPAÑOLA / MEXICANA / COLOMBIANA', cat: 'Pasaporte' },
    { tag: '(cedula/pasaporte)', desc: 'Tipo de documento legal', example: 'Pasaporte / Cédula / DNI / NIE', cat: 'Pasaporte' },
    { tag: '(fecha_nacimiento)', desc: 'Fecha de nacimiento', example: '1985-06-14 o 14/06/1985', cat: 'Pasaporte' },
    { tag: '(pais_emisor)', desc: 'País emisor del documento', example: 'ESPAÑA / ESTADOS UNIDOS / COLOMBIA', cat: 'Pasaporte' },
    { tag: '(direccion)', desc: 'Dirección o domicilio fiscal/legal', example: 'Calle Gran Vía 45, 3ºB, Madrid', cat: 'Cliente' },
    { tag: '(telefono)', desc: 'Número telefónico de contacto', example: '+34 612 345 678', cat: 'Cliente' },
    { tag: '(email)', desc: 'Correo electrónico', example: 'cliente@ejemplo.com', cat: 'Cliente' },
    { tag: '(ciudad_firma)', desc: 'Ciudad donde se otorga el acto', example: 'Madrid / Barcelona / Valencia', cat: 'Fechas' },
    { tag: '(fecha_firma)', desc: 'Fecha de firma del documento', example: '19 de agosto de 2026', cat: 'Fechas' },
    { tag: '(abogado_nombre)', desc: 'Nombre del letrado o apoderado', example: 'Lic. Sergio Quintana Pulido', cat: 'Legal' },
    { tag: '(abogado_colegiado)', desc: 'Número de colegiación profesional', example: 'ICAM 48.912', cat: 'Legal' },
    { tag: '(objeto_servicio)', desc: 'Descripción del encargo legal', example: 'Tramitación de residencia por arraigo', cat: 'Legal' },
    { tag: '(honorarios)', desc: 'Monto y divisa de honorarios', example: '1.200,00 € (IVA no incluido)', cat: 'Legal' },
  ];

  const filteredVariables = coreVariables.filter(
    (v) =>
      v.tag.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.desc.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.cat.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold">
              <BookOpen className="w-3.5 h-3.5" />
              <span>Manual Oficial de Operaciones & Guía Paso a Paso</span>
            </div>
            <h1 className="font-serif font-bold text-2xl sm:text-3xl text-slate-50 tracking-tight">
              Manual Completo de Uso del Sistema
            </h1>
            <p className="text-slate-300 text-sm max-w-2xl leading-relaxed">
              Guía exhaustiva para la extracción OCR/IA de pasaportes, administración de clientes,
              creación de plantillas Word y generación automatizada de documentos notariales y legales.
            </p>
          </div>

          {/* Quick Access Action */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => onNavigateTab('wizard')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm shadow-lg shadow-amber-500/20 transition-all"
            >
              <Sparkles className="w-4 h-4 text-slate-950" />
              <span>Iniciar Asistente Ahora</span>
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Navigation Menu */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2">
        <button
          onClick={() => setActiveSection('workflow')}
          className={`flex items-center justify-center gap-2 px-3 py-3 rounded-2xl text-xs font-bold transition-all border ${
            activeSection === 'workflow'
              ? 'bg-slate-900 text-amber-400 border-slate-900 shadow-md ring-2 ring-amber-500/30'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900'
          }`}
        >
          <Sparkles className="w-4 h-4 shrink-0" />
          <span className="truncate">Flujo Global</span>
        </button>

        <button
          onClick={() => setActiveSection('upload')}
          className={`flex items-center justify-center gap-2 px-3 py-3 rounded-2xl text-xs font-bold transition-all border ${
            activeSection === 'upload'
              ? 'bg-slate-900 text-amber-400 border-slate-900 shadow-md ring-2 ring-amber-500/30'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900'
          }`}
        >
          <Upload className="w-4 h-4 shrink-0" />
          <span className="truncate">1. Subir y Escanear</span>
        </button>

        <button
          onClick={() => setActiveSection('save')}
          className={`flex items-center justify-center gap-2 px-3 py-3 rounded-2xl text-xs font-bold transition-all border ${
            activeSection === 'save'
              ? 'bg-slate-900 text-amber-400 border-slate-900 shadow-md ring-2 ring-amber-500/30'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900'
          }`}
        >
          <FileCheck className="w-4 h-4 shrink-0" />
          <span className="truncate">2. Revisar y Guardar</span>
        </button>

        <button
          onClick={() => setActiveSection('generate')}
          className={`flex items-center justify-center gap-2 px-3 py-3 rounded-2xl text-xs font-bold transition-all border ${
            activeSection === 'generate'
              ? 'bg-slate-900 text-amber-400 border-slate-900 shadow-md ring-2 ring-amber-500/30'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900'
          }`}
        >
          <FileDown className="w-4 h-4 shrink-0" />
          <span className="truncate">3. Generar Word</span>
        </button>

        <button
          onClick={() => setActiveSection('templates')}
          className={`flex items-center justify-center gap-2 px-3 py-3 rounded-2xl text-xs font-bold transition-all border ${
            activeSection === 'templates'
              ? 'bg-slate-900 text-amber-400 border-slate-900 shadow-md ring-2 ring-amber-500/30'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900'
          }`}
        >
          <Code2 className="w-4 h-4 shrink-0" />
          <span className="truncate">4. Plantillas y Variables</span>
        </button>

        <button
          onClick={() => setActiveSection('database')}
          className={`flex items-center justify-center gap-2 px-3 py-3 rounded-2xl text-xs font-bold transition-all border ${
            activeSection === 'database'
              ? 'bg-slate-900 text-amber-400 border-slate-900 shadow-md ring-2 ring-amber-500/30'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900'
          }`}
        >
          <Database className="w-4 h-4 shrink-0" />
          <span className="truncate">5. Base de Datos</span>
        </button>

        <button
          onClick={() => setActiveSection('faq')}
          className={`flex items-center justify-center gap-2 px-3 py-3 rounded-2xl text-xs font-bold transition-all border ${
            activeSection === 'faq'
              ? 'bg-slate-900 text-amber-400 border-slate-900 shadow-md ring-2 ring-amber-500/30'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900'
          }`}
        >
          <HelpCircle className="w-4 h-4 shrink-0" />
          <span className="truncate">Preguntas FAQ</span>
        </button>
      </div>

      {/* SECTION 1: WORKFLOW OVERVIEW */}
      {activeSection === 'workflow' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
            <div>
              <h2 className="font-serif font-bold text-xl sm:text-2xl text-slate-900">
                Arquitectura del Flujo de Trabajo en 3 Pasos
              </h2>
              <p className="text-sm text-slate-600 mt-1">
                El sistema está diseñado para que cualquier documento legal o notarial pueda emitirse en menos de 30 segundos.
              </p>
            </div>

            {/* Visual Step Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Step 1 Card */}
              <div className="p-6 rounded-2xl bg-gradient-to-b from-slate-50 to-white border border-slate-200 relative group hover:border-amber-400 transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="w-8 h-8 rounded-xl bg-amber-500 text-slate-950 font-bold flex items-center justify-center text-sm shadow-sm">
                      1
                    </span>
                    <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                      Entrada / OCR
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-900 text-base mb-2">
                    Subir o Escanear Pasaporte
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed mb-4">
                    Arrastra una foto, selecciónala desde tu equipo o tómala con la cámara web. Tesseract lee el texto y la zona MRZ en tu navegador. Revisa y corrige los campos detectados antes de generar el documento.
                  </p>
                </div>
                <button
                  onClick={() => onNavigateTab('wizard')}
                  className="w-full py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs transition-colors flex items-center justify-center gap-1.5"
                >
                  <span>Ir al Escáner</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Step 2 Card */}
              <div className="p-6 rounded-2xl bg-gradient-to-b from-slate-50 to-white border border-slate-200 relative group hover:border-amber-400 transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="w-8 h-8 rounded-xl bg-slate-900 text-white font-bold flex items-center justify-center text-sm shadow-sm">
                      2
                    </span>
                    <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                      Auditoría y CRM
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-900 text-base mb-2">
                    Verificar y Guardar Cliente
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed mb-4">
                    Revisa los nombres, número de pasaporte, nacionalidad y la condición <code className="text-amber-800 bg-amber-50 px-1 py-0.5 rounded font-mono font-bold">(sexo/edad)</code>. Al confirmar, el cliente queda guardado permanentemente en el directorio.
                  </p>
                </div>
                <button
                  onClick={() => onNavigateTab('clients')}
                  className="w-full py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs transition-colors flex items-center justify-center gap-1.5"
                >
                  <span>Ver Directorio de Clientes</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Step 3 Card */}
              <div className="p-6 rounded-2xl bg-gradient-to-b from-slate-50 to-white border border-slate-200 relative group hover:border-amber-400 transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="w-8 h-8 rounded-xl bg-emerald-600 text-white font-bold flex items-center justify-center text-sm shadow-sm">
                      3
                    </span>
                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      Salida .docx
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-900 text-base mb-2">
                    Generar y Descargar Word (.docx)
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed mb-4">
                    Elige la plantilla deseada (Poder Notarial, Contrato de Servicios o Solicitud de Residencia). El motor inyecta todas las variables y descarga un archivo Word nativo 100% editable.
                  </p>
                </div>
                <button
                  onClick={() => onNavigateTab('generator')}
                  className="w-full py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs transition-colors flex items-center justify-center gap-1.5"
                >
                  <span>Ir al Generador Directo</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Key Advantages Matrix */}
            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
              <h4 className="font-bold text-slate-900 text-sm uppercase tracking-wider">
                Características Clave del Sistema
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs text-slate-600">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-slate-900 block font-semibold">Doble Motor OCR</strong>
                    <span>OCR local Tesseract sin IA generativa. La primera carga del motor y los idiomas requiere internet.</span>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-slate-900 block font-semibold">Word Real (.docx)</strong>
                    <span>Archivos binarios OpenXML compatibles con Microsoft Word, Google Docs y LibreOffice.</span>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-slate-900 block font-semibold">Privacidad & Persistencia</strong>
                    <span>Tus datos se almacenan de forma local en tu navegador con copias de seguridad en JSON.</span>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-slate-900 block font-semibold">Etiquetas Flexibles</strong>
                    <span>Soporta sintaxis de variables con paréntesis <code className="font-mono">(nombre)</code> y llaves <code className="font-mono">{`{{nombre}}`}</code>.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: SUBIR Y ESCANEAR ARCHIVOS */}
      {activeSection === 'upload' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-6">
              <div>
                <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200 uppercase tracking-wider">
                  Módulo 1: Entrada de Documentos
                </span>
                <h2 className="font-serif font-bold text-xl sm:text-2xl text-slate-900 mt-2">
                  Guía para Subir y Escanear Pasaportes o Documentos
                </h2>
                <p className="text-sm text-slate-600 mt-1">
                  Cómo utilizar el sistema de escaneo mediante arrastre, archivo o cámara web.
                </p>
              </div>
              <button
                onClick={() => onNavigateTab('wizard')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs shrink-0"
              >
                <Upload className="w-3.5 h-3.5 text-amber-400" />
                <span>Probar Escáner Ahora</span>
              </button>
            </div>

            {/* Methods list */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-700 flex items-center justify-center border border-amber-500/20 font-bold">
                  <Upload className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">
                  Método A: Arrastrar o Cargar Archivo
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Haz clic en el área punteada o arrastra directamente cualquier imagen de pasaporte en formato <strong>JPG, PNG o WEBP</strong> desde tu explorador de archivos.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-700 flex items-center justify-center border border-blue-500/20 font-bold">
                  <Camera className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">
                  Método B: Captura con Cámara Web
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Activa la pestaña <strong>"Usar Cámara"</strong>, concede permisos al navegador, coloca el documento frente a la lente y pulsa <strong>"Capturar Foto y Analizar"</strong>.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-700 flex items-center justify-center border border-emerald-500/20 font-bold">
                  <Users className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">
                  Método C: Seleccionar Cliente Existente
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Si el cliente ya fue escaneado anteriormente, pulsa <strong>"Seleccionar Cliente Guardado"</strong> para reutilizar instantáneamente todos sus datos sin volver a escanear.
                </p>
              </div>
            </div>

            {/* Best practices for Passport Scanning */}
            <div className="p-6 rounded-2xl bg-amber-50/50 border border-amber-200 space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0" />
                <h4 className="font-bold text-slate-900 text-sm">
                  Consejos para Obtener 100% de Precisión en la Lectura
                </h4>
              </div>
              <ul className="text-xs text-slate-700 space-y-2 list-disc list-inside">
                <li>
                  <strong>Enfocar la Zona MRZ Inferior:</strong> Asegúrate de que las dos líneas inferiores con símbolos <code>&lt;&lt;&lt;&lt;</code> se vean nítidas y sin cortes.
                </li>
                <li>
                  <strong>Evitar Reflejos de Luz:</strong> Si el pasaporte tiene cubierta plastificada brillante, inclina ligeramente la luz para evitar brillos sobre el texto.
                </li>
                <li>
                  <strong>Plano Frontal Recto:</strong> Procura que la foto esté tomada de frente y no en ángulo diagonal excesivo.
                </li>
                <li>
                  <strong>Resolución Mínima:</strong> Se recomienda una imagen de al menos 800x600 píxeles para garantizar lectura correcta de fechas y números de identificación.
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: REVISAR Y GUARDAR CLIENTES */}
      {activeSection === 'save' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-6">
              <div>
                <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200 uppercase tracking-wider">
                  Módulo 2: Validación y Almacenamiento
                </span>
                <h2 className="font-serif font-bold text-xl sm:text-2xl text-slate-900 mt-2">
                  Cómo Revisar, Validar y Guardar Fichas de Clientes
                </h2>
                <p className="text-sm text-slate-600 mt-1">
                  Paso 2 del asistente: auditoría de campos extraídos y persistencia en el CRM.
                </p>
              </div>
              <button
                onClick={() => onNavigateTab('clients')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs shrink-0"
              >
                <Users className="w-3.5 h-3.5 text-amber-400" />
                <span>Explorar Directorio CRM</span>
              </button>
            </div>

            {/* Field breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Campos Clave Auditados</span>
                </h3>
                <div className="space-y-3 text-xs text-slate-600">
                  <div className="p-3 rounded-xl bg-white border border-slate-200">
                    <strong className="text-slate-900 block font-semibold mb-0.5">Nombres y Apellidos</strong>
                    <span>Separación automática entre nombre de pila y apellidos para redactar correctamente en contratos.</span>
                  </div>
                  <div className="p-3 rounded-xl bg-white border border-slate-200">
                    <strong className="text-slate-900 block font-semibold mb-0.5">Condición Legal (sexo/edad)</strong>
                    <span>Selector obligatorio para determinar la categoría civil: <strong>VARÓN</strong>, <strong>MUJER</strong>, <strong>JOVEN</strong> o <strong>MENOR</strong>.</span>
                  </div>
                  <div className="p-3 rounded-xl bg-white border border-slate-200">
                    <strong className="text-slate-900 block font-semibold mb-0.5">Pasaporte y Nacionalidad</strong>
                    <span>Número alfanumérico del documento, país de emisión, fecha de nacimiento y fecha de caducidad.</span>
                  </div>
                </div>
              </div>

              <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Database className="w-4 h-4 text-blue-600" />
                  <span>Persistencia Automática en CRM</span>
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Al presionar <strong>"Guardar y Continuar a Generación"</strong>, ocurren las siguientes acciones automáticas:
                </p>
                <ol className="text-xs text-slate-700 space-y-2 list-decimal list-inside">
                  <li>El cliente se registra en la base de datos local con identificador único.</li>
                  <li>Se almacena una miniatura optimizada de la fotografía del pasaporte.</li>
                  <li>Se actualiza el contador de clientes en la barra superior.</li>
                  <li>El cliente queda disponible inmediatamente para generar cualquier otro documento en el futuro con un solo clic.</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 4: GENERAR DOCUMENTOS WORD */}
      {activeSection === 'generate' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-6">
              <div>
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 uppercase tracking-wider">
                  Módulo 3: Generación y Descarga .docx
                </span>
                <h2 className="font-serif font-bold text-xl sm:text-2xl text-slate-900 mt-2">
                  Cómo Generar y Descargar Documentos Word Oficiales
                </h2>
                <p className="text-sm text-slate-600 mt-1">
                  Selección de plantillas, sustitución de variables en tiempo real y descarga nativa.
                </p>
              </div>
              <button
                onClick={() => onNavigateTab('generator')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs shrink-0"
              >
                <FileDown className="w-3.5 h-3.5 text-amber-400" />
                <span>Abrir Generador Directo</span>
              </button>
            </div>

            {/* Step-by-step flow */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <span className="text-xs font-bold text-slate-500 uppercase">Paso 3.1</span>
                <h3 className="font-bold text-slate-900 text-sm">Seleccionar Plantilla</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Elige entre las plantillas legales disponibles: Poder Notarial, Contrato de Asesoría o Solicitud de Residencia.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <span className="text-xs font-bold text-slate-500 uppercase">Paso 3.2</span>
                <h3 className="font-bold text-slate-900 text-sm">Revisar Campos Específicos</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Los datos del cliente se auto-completan. Solo debes completar campos opcionales como honorarios, letrado apoderado o ciudad de firma.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <span className="text-xs font-bold text-slate-500 uppercase">Paso 3.3</span>
                <h3 className="font-bold text-slate-900 text-sm">Descargar Word (.docx)</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Pulsa <strong>"Descargar Documento Word (.docx)"</strong>. El archivo se genera en milisegundos en tu carpeta de descargas.
                </p>
              </div>
            </div>

            {/* Compatibility Banner */}
            <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <FileCheck className="w-6 h-6 text-emerald-700 shrink-0" />
                <div>
                  <h4 className="font-bold text-emerald-950 text-sm">
                    Garantía de Compatibilidad Total (.docx)
                  </h4>
                  <p className="text-xs text-emerald-800 mt-0.5">
                    Los archivos generados son 100% compatibles con Microsoft Word 2013-2024, Office 365, Google Docs, Apple Pages y LibreOffice Writer.
                  </p>
                </div>
              </div>
              <button
                onClick={() => onNavigateTab('history')}
                className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs shrink-0 transition-colors shadow-sm"
              >
                Ver Historial de Documentos
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 5: PLANTILLAS Y VARIABLES */}
      {activeSection === 'templates' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-6">
              <div>
                <span className="text-xs font-bold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-full border border-purple-200 uppercase tracking-wider">
                  Módulo 4: Plantillas Word & Pestañas por Idóneo
                </span>
                <h2 className="font-serif font-bold text-xl sm:text-2xl text-slate-900 mt-2">
                  Gestión de Plantillas por Idóneo y Guía de Variables
                </h2>
                <p className="text-sm text-slate-600 mt-1">
                  Acceso directo a todos los documentos notariales y legales personalizados por cada letrado idóneo de la firma.
                </p>
              </div>
              <button
                onClick={() => onNavigateTab('templates')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs shrink-0"
              >
                <Code2 className="w-3.5 h-3.5 text-amber-400" />
                <span>Gestor de Plantillas</span>
              </button>
            </div>

            {/* Idóneos Panel Guide */}
            <div className="p-6 rounded-2xl bg-amber-50/50 border border-amber-200 space-y-3">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Scale className="w-4 h-4 text-amber-600" />
                <span>Pestañas Organizadas por Letrado Idóneo</span>
              </h3>
              <p className="text-xs text-slate-700 leading-relaxed">
                En el apartado de plantillas, las categorías han sido reemplazadas por pestañas dedicadas a cada profesional idóneo de la firma:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 pt-1">
                <div className="p-3 bg-white rounded-xl border border-amber-200 text-xs shadow-2xs">
                  <strong className="text-slate-900 block font-serif font-bold">Susana Sabalza</strong>
                  <span className="text-[11px] text-amber-800 font-mono block">Idónea Nº 101</span>
                  <span className="text-[10px] text-slate-500 block mt-1">Poderes Notariales & Contratos Civiles</span>
                </div>
                <div className="p-3 bg-white rounded-xl border border-amber-200 text-xs shadow-2xs">
                  <strong className="text-slate-900 block font-serif font-bold">Marta Aparicio</strong>
                  <span className="text-[11px] text-amber-800 font-mono block">Idónea Nº 102</span>
                  <span className="text-[10px] text-slate-500 block mt-1">Extranjería & Residencias</span>
                </div>
                <div className="p-3 bg-white rounded-xl border border-amber-200 text-xs shadow-2xs">
                  <strong className="text-slate-900 block font-serif font-bold">Lizohar Godoy</strong>
                  <span className="text-[11px] text-amber-800 font-mono block">Idónea Nº 103</span>
                  <span className="text-[10px] text-slate-500 block mt-1">Contratos de Prestación & Defensa</span>
                </div>
                <div className="p-3 bg-white rounded-xl border border-amber-200 text-xs shadow-2xs">
                  <strong className="text-slate-900 block font-serif font-bold">Martín Downer</strong>
                  <span className="text-[11px] text-amber-800 font-mono block">Idóneo Nº 104</span>
                  <span className="text-[10px] text-slate-500 block mt-1">Corporativo & Representación</span>
                </div>
                <div className="p-3 bg-white rounded-xl border border-amber-200 text-xs shadow-2xs">
                  <strong className="text-slate-900 block font-serif font-bold">Antony Talla</strong>
                  <span className="text-[11px] text-amber-800 font-mono block">Idóneo Nº 105</span>
                  <span className="text-[10px] text-slate-500 block mt-1">Notarial, Visados & Recursos</span>
                </div>
              </div>
              <p className="text-[11px] text-slate-600 italic mt-2">
                En cada pestaña están disponibles los mismos modelos oficiales, pero con los campos de letrado, colegiado y apoderado pre-configurados para el idóneo seleccionado.
              </p>
            </div>

            {/* How to create a template instruction */}
            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
              <h3 className="font-bold text-slate-900 text-sm">
                ¿Cómo Crear una Plantilla Word (.docx) Compatible?
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
                <div className="p-4 rounded-xl bg-white border border-slate-200">
                  <span className="w-6 h-6 rounded-lg bg-slate-900 text-white font-bold flex items-center justify-center text-xs mb-2">1</span>
                  <strong className="text-slate-900 block font-semibold mb-1">Abre Word</strong>
                  <span>Crea un documento nuevo en Microsoft Word o abre uno existente.</span>
                </div>
                <div className="p-4 rounded-xl bg-white border border-slate-200">
                  <span className="w-6 h-6 rounded-lg bg-slate-900 text-white font-bold flex items-center justify-center text-xs mb-2">2</span>
                  <strong className="text-slate-900 block font-semibold mb-1">Inserta Etiquetas</strong>
                  <span>Escribe las variables entre paréntesis, ej: <code className="font-mono text-amber-800">(nombre)</code> o <code className="font-mono text-amber-800">(numero de identidad)</code>.</span>
                </div>
                <div className="p-4 rounded-xl bg-white border border-slate-200">
                  <span className="w-6 h-6 rounded-lg bg-slate-900 text-white font-bold flex items-center justify-center text-xs mb-2">3</span>
                  <strong className="text-slate-900 block font-semibold mb-1">Guarda en .docx</strong>
                  <span>Guarda tu archivo con formato estándar de Word <strong>.docx</strong>.</span>
                </div>
                <div className="p-4 rounded-xl bg-white border border-slate-200">
                  <span className="w-6 h-6 rounded-lg bg-slate-900 text-white font-bold flex items-center justify-center text-xs mb-2">4</span>
                  <strong className="text-slate-900 block font-semibold mb-1">Sube al Sistema</strong>
                  <span>Ve a la pestaña <strong>"Plantillas Word (.docx)"</strong> y sube el archivo asignándolo al idóneo correspondiente o a todos.</span>
                </div>
              </div>
            </div>

            {/* Variables Dictionary with search and copy */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h3 className="font-bold text-slate-900 text-sm">
                  Diccionario de Variables Oficiales Soportadas
                </h3>
                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar variable..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                      <tr>
                        <th className="py-3 px-4">Etiqueta Exacta</th>
                        <th className="py-3 px-4">Categoría</th>
                        <th className="py-3 px-4">Descripción</th>
                        <th className="py-3 px-4">Ejemplo Sustituido</th>
                        <th className="py-3 px-4 text-right">Copiar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredVariables.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-amber-900">
                            {item.tag}
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-semibold">
                              {item.cat}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-700">{item.desc}</td>
                          <td className="py-3 px-4 text-slate-500 font-sans italic">{item.example}</td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => handleCopy(item.tag)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-semibold transition-colors"
                              title="Copiar etiqueta al portapapeles"
                            >
                              {copiedTag === item.tag ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-600" />
                                  <span className="text-emerald-700">Copiado</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3 text-slate-500" />
                                  <span>Copiar</span>
                                </>
                              )}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 6: BASE DE DATOS Y RESPALDOS */}
      {activeSection === 'database' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-6">
              <div>
                <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200 uppercase tracking-wider">
                  Módulo 5: Base de Datos y Backups
                </span>
                <h2 className="font-serif font-bold text-xl sm:text-2xl text-slate-900 mt-2">
                  Gestión de Almacenamiento, Copias de Seguridad y Migración
                </h2>
                <p className="text-sm text-slate-600 mt-1">
                  Cómo respaldar todos tus clientes, plantillas e historial o transferirlos a otro equipo.
                </p>
              </div>
              <button
                onClick={() => onNavigateTab('database')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs shrink-0"
              >
                <Database className="w-3.5 h-3.5 text-amber-400" />
                <span>Panel de Base de Datos</span>
              </button>
            </div>

            {/* 3 cards of backup actions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200 font-bold mb-3">
                    <FileDown className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-slate-900 text-sm mb-1">
                    Exportar Copia de Seguridad JSON
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed mb-4">
                    Descarga en 1 clic un archivo comprimido <code className="font-mono">Legal_Backup_Completo_YYYY-MM-DD.json</code> que contiene todos tus clientes registrados, plantillas personalizadas e historial.
                  </p>
                </div>
                <button
                  onClick={() => onNavigateTab('database')}
                  className="w-full py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition-colors"
                >
                  Exportar Respaldo
                </button>
              </div>

              <div className="p-6 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-3 flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center border border-amber-300 font-bold mb-3">
                    <Database className="w-5 h-5 text-amber-700" />
                  </div>
                  <h3 className="font-bold text-slate-900 text-sm mb-1">
                    Almacenamiento Local & Migración de BD
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed mb-4">
                    La base de datos Firebase ha sido desvinculada según tu solicitud. Tus plantillas, clientes y registros permanecen resguardados de forma local en el navegador, listos para conectarse a tu nueva base de datos en cuanto la indiques.
                  </p>
                </div>
                <button
                  onClick={() => onNavigateTab('database')}
                  className="w-full py-2 px-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs transition-colors shadow-xs"
                >
                  Ver Panel de Base de Datos
                </button>
              </div>

              <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-red-50 text-red-700 flex items-center justify-center border border-red-200 font-bold mb-3">
                    <HardDrive className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-slate-900 text-sm mb-1">
                    Preparación para Producción
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed mb-4">
                    Si necesitas reiniciar los datos de prueba, puedes utilizar la función de limpieza total para dejar la base de datos limpia en 0 clientes y 0 documentos generados.
                  </p>
                </div>
                <button
                  onClick={() => onNavigateTab('database')}
                  className="w-full py-2 px-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-xs transition-colors"
                >
                  Ir a Limpieza
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 7: FAQ & TROUBLESHOOTING */}
      {activeSection === 'faq' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
            <div>
              <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200 uppercase tracking-wider">
                Soporte & Resolución de Dudas
              </span>
              <h2 className="font-serif font-bold text-xl sm:text-2xl text-slate-900 mt-2">
                Preguntas Frecuentes & Solución de Problemas
              </h2>
            </div>

            <div className="space-y-4">
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-amber-600" />
                  <span>¿Qué sucede si una foto de pasaporte es de baja calidad o la IA está ocupada?</span>
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  El sistema cuenta con un <strong>motor inteligente de reintentos y respaldo</strong>: si la IA experimenta alta demanda, reintenta automáticamente con modelos alternativos y finalmente recurre al motor local <strong>Tesseract OCR</strong>. Además, en el Paso 2 de revisión siempre puedes corregir o escribir manualmente cualquier campo en segundos.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-amber-600" />
                  <span>¿Por qué es importante el campo (sexo/edad)?</span>
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  En el derecho notarial e internacional es imprescindible definir la condición legal del otorgante (VARÓN, MUJER, JOVEN o MENOR) para redactar correctamente fórmulas como <em>"Don/Doña"</em>, <em>"el compareciente"</em> o <em>"la otorgante"</em>. El sistema lo calcula a partir de la fecha de nacimiento y sexo, permitiendo su ajuste manual si fuese necesario.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-amber-600" />
                  <span>¿Puedo abrir los documentos generados en Microsoft Word de escritorio?</span>
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Sí, 100%. Todos los archivos descargados son archivos nativos <code className="font-mono font-bold">.docx</code> con formato OpenXML, totalmente editables, imprimibles y firmables digitalmente.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-amber-600" />
                  <span>¿Dónde se guardan los datos de mis clientes y pasaportes?</span>
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Todos los registros se almacenan dentro del almacenamiento seguro de tu navegador web (<code className="font-mono">localStorage</code>). Ningún dato confidencial de clientes queda guardado en servidores externos. Recuerda realizar copias de seguridad periódicas en la pestaña <strong>Base de Datos</strong>.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
