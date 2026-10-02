import { Idoneo, IdoneoName, Template } from '../types';

export const IDONEOS: Idoneo[] = [
  {
    id: 'antony-talla',
    name: 'Antony Talla',
    formalTitle: 'Lcdo. Antony Nathanael Talla Copris',
    gender: 'M',
    role: 'Abogado Idóneo / Consultor Legal',
    colegiado: 'Idoneidad 30553 · Cédula 8-849-2485',
    cedula: '8-849-2485',
    idoneidad: '30553',
    email: 'antony.talla@sqplegal.com',
    phone: '+507 830-5220',
    initials: 'AT',
    color: 'rose',
    badgeBg: 'bg-rose-50 text-rose-800 border-rose-200',
    badgeText: 'text-rose-700',
    description: 'Especialista en Tramitación Notarial, Extranjería, Migración y Poderes de Representación.',
  },
  {
    id: 'susana-sabalza',
    name: 'Susana Sabalza',
    formalTitle: 'Licda. Susana Sabalza',
    gender: 'F',
    role: 'Abogada Idónea / Letrada Directora',
    colegiado: 'Idoneidad 29811 · Cédula 8-740-1290',
    cedula: '8-740-1290',
    idoneidad: '29811',
    email: 'susana.sabalza@sqplegal.com',
    phone: '+507 830-5221',
    initials: 'SS',
    color: 'emerald',
    badgeBg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    badgeText: 'text-emerald-700',
    description: 'Especialista en Poderes Notariales, Contratos de Asesoría Jurídica y Representación Legal.',
  },
  {
    id: 'marta-aparicio',
    name: 'Marta Aparicio',
    formalTitle: 'Licda. Marta Aparicio',
    gender: 'F',
    role: 'Abogada Idónea / Consultora Legal',
    colegiado: 'Idoneidad 31042 · Cédula 8-802-1455',
    cedula: '8-802-1455',
    idoneidad: '31042',
    email: 'marta.aparicio@sqplegal.com',
    phone: '+507 830-5222',
    initials: 'MA',
    color: 'blue',
    badgeBg: 'bg-blue-50 text-blue-800 border-blue-200',
    badgeText: 'text-blue-700',
    description: 'Especialista en Derecho Migratorio, Solicitudes de Residencia, Extranjería y Nacionalidad.',
  },
  {
    id: 'lizohar-godoy',
    name: 'Lizohar Godoy',
    formalTitle: 'Licda. Lizohar Godoy',
    gender: 'F',
    role: 'Abogada Idónea / Consultora Legal',
    colegiado: 'Idoneidad 28940 · Cédula 4-725-1903',
    cedula: '4-725-1903',
    idoneidad: '28940',
    email: 'lizohar.godoy@sqplegal.com',
    phone: '+507 830-5223',
    initials: 'LG',
    color: 'purple',
    badgeBg: 'bg-purple-50 text-purple-800 border-purple-200',
    badgeText: 'text-purple-700',
    description: 'Especialista en Contratos de Prestación de Servicios, Cláusulas Civiles y Defensa Jurídica.',
  },
  {
    id: 'martin-downer',
    name: 'Martín Downer',
    formalTitle: 'Lic. Martín Downer',
    gender: 'M',
    role: 'Abogado Idóneo / Consultor Legal',
    colegiado: 'Idoneidad 30114 · Cédula 8-780-2219',
    cedula: '8-780-2219',
    idoneidad: '30114',
    email: 'martin.downer@sqplegal.com',
    phone: '+507 830-5224',
    initials: 'MD',
    color: 'amber',
    badgeBg: 'bg-amber-50 text-amber-900 border-amber-200',
    badgeText: 'text-amber-700',
    description: 'Especialista en Derecho Corporativo, Poderes de Representación Notarial y Trámites Internacionales.',
  },
];

export const DEFAULT_IDONEO = IDONEOS[0]; // Susana Sabalza

export function getIdoneoByName(name?: string | null): Idoneo {
  if (!name) return DEFAULT_IDONEO;
  const clean = name.toLowerCase().trim();
  const found = IDONEOS.find(
    (i) =>
      i.name.toLowerCase() === clean ||
      i.formalTitle.toLowerCase().includes(clean) ||
      i.id.toLowerCase() === clean
  );
  return found || DEFAULT_IDONEO;
}

/**
 * Customizes any template for a specific Idóneo:
 * Adjusts lawyer name default values, colegiado, and creates a clean template copy
 */
export function customizeTemplateForIdoneo(template: Template, idoneo: Idoneo): Template {
  const updatedDefs = (template.placeholderDefs || []).map((def) => {
    const key = def.key.toLowerCase();
    if (key.includes('abogado_nombre') || key.includes('letrado') || key.includes('abogado') || key.includes('idoneo')) {
      return { ...def, defaultValue: idoneo.formalTitle };
    }
    if (key.includes('abogado_colegiado') || key.includes('colegiado') || key.includes('n_colegiado')) {
      return { ...def, defaultValue: idoneo.colegiado };
    }
    return def;
  });

  return {
    ...template,
    id: `${template.id}-${idoneo.id}`,
    idoneo: idoneo.name,
    placeholderDefs: updatedDefs,
  };
}
