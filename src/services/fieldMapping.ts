import type { Client, Idoneo } from '../types';

export function normalizeField(key: string): string {
  return key.replace(/^[({\[\s]+|[)}\]\s]+$/g, '').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[\s_-]+/g, '_');
}

export const FIELD_ALIASES: Record<string, string[]> = {
  fullName: ['nombre', 'nombre_completo', 'fullname', 'cliente', 'nombre_cliente'],
  firstName: ['nombres', 'firstname', 'first_name'],
  lastName: ['apellidos', 'lastname', 'last_name'],
  passportNumber: ['numero_de_identidad', 'numero_identidad', 'identidad', 'numero_de_pasaporte', 'numero_pasaporte', 'pasaporte', 'passport', 'passportnumber', 'passport_number', 'cedula', 'dni', 'nie', 'documento', 'numero_documento', 'numero_de_documento'],
  docType: ['cedula/pasaporte', 'cedula_/_pasaporte', 'cedula_pasaporte', 'tipo_documento', 'tipo_de_documento', 'document_type'],
  nationality: ['nacionalidad', 'nationality', 'nacionalidad_cliente'],
  issuingCountry: ['pais_emisor', 'pais', 'issuingcountry'],
  birthDate: ['fecha_nacimiento', 'fecha_de_nacimiento', 'birthdate', 'birth_date'],
  expiryDate: ['fecha_vencimiento', 'fecha_de_vencimiento', 'vencimiento', 'caducidad', 'fecha_caducidad', 'expirydate'],
  issueDate: ['fecha_emision', 'fecha_de_emision', 'issuedate'],
  placeOfBirth: ['lugar_nacimiento', 'lugar_de_nacimiento', 'placeofbirth'],
  personalNumber: ['numero_personal', 'personalnumber'],
  address: ['direccion', 'domicilio', 'address'],
  phone: ['telefono', 'phone', 'movil'],
  email: ['email', 'correo', 'correo_electronico'],
  city: ['ciudad', 'ciudad_firma', 'city'],
  sexAgeCategory: ['sexo', 'genero', 'gender', 'sexo/edad', 'sexo_/_edad', 'sexo_edad', 'edad/sexo', 'condicion', 'condicion_juridica'],
  lawyerName: ['abogado_nombre', 'nombre_abogado', 'letrado_nombre', 'abogado', 'idoneo', 'abogado_designado'],
  lawyerCedula: ['abogado_cedula', 'cedula_abogado'],
  lawyerIdoneidad: ['abogado_idoneidad', 'idoneidad_abogado', 'idoneidad'],
  lawyerColegiado: ['abogado_colegiado', 'colegiado', 'n_colegiado'],
  date: ['fecha', 'fecha_firma', 'fecha_solicitud', 'fecha_declaracion'],
};

export function canonicalField(key: string): string {
  const normalized = normalizeField(key);
  return Object.entries(FIELD_ALIASES).find(([, aliases]) => aliases.includes(normalized))?.[0] || normalized;
}

export function documentTypeLabel(type?: string): string {
  return ({ pasaporte: 'Pasaporte', cedula: 'Cédula', dni: 'DNI', nie: 'Carnet de Extranjería / NIE', otro: 'Documento de identidad' })[type || ''] || '';
}

export function fieldDefault(key: string, client?: Client | null, lawyer?: Idoneo, category = ''): string {
  const field = canonicalField(key);
  if (field === 'docType') return documentTypeLabel(client?.docType);
  if (field === 'sexAgeCategory') return category;
  if (field === 'lawyerName') return lawyer?.formalTitle || '';
  if (field === 'lawyerCedula') return lawyer?.cedula || '';
  if (field === 'lawyerIdoneidad') return lawyer?.idoneidad || '';
  if (field === 'lawyerColegiado') return lawyer?.colegiado || '';
  if (field === 'date') return new Date().toLocaleDateString('es-PA', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Panama' });
  if (field === 'passportNumber') return client?.passportNumber || client?.personalNumber || '';
  const value = client?.[field as keyof Client];
  return typeof value === 'string' ? value : '';
}
