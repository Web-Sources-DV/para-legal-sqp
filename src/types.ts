export interface Client {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  passportNumber: string;
  docType: 'pasaporte' | 'dni' | 'nie' | 'cedula' | 'otro';
  nationality: string;
  issuingCountry: string;
  birthDate: string;
  expiryDate: string;
  issueDate?: string;
  sex: 'M' | 'F' | 'X' | 'Otro' | string;
  sexAgeCategory?: 'VARÓN' | 'MUJER' | 'JOVEN' | 'MENOR' | string;
  age?: number;
  personalNumber?: string;
  placeOfBirth?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  notes?: string;
  passportImageBase64?: string;
  createdAt: string;
  updatedAt: string;
  documentCount?: number;
}

export type IdoneoName =
  | 'Susana Sabalza'
  | 'Marta Aparicio'
  | 'Lizohar Godoy'
  | 'Martín Downer'
  | 'Antony Talla';

export interface Idoneo {
  id: string;
  name: IdoneoName;
  formalTitle: string;
  gender: 'F' | 'M';
  role: string;
  colegiado: string;
  cedula?: string;
  idoneidad?: string;
  email: string;
  phone: string;
  initials: string;
  color: string;
  badgeBg: string;
  badgeText: string;
  description: string;
}

export interface SignatureLayoutOptions {
  alignment?: 'column-left' | 'center' | 'column-right';
  columnOffsetPercent?: number; // e.g. 58 (58% of page width, matching Image 2)
  signatureBlankLines?: number; // e.g. 2, 3 or 4 blank lines for hand signature
  useTwoColumnTable?: boolean; // true by default: creates perfectly balanced 2-column signature layout
  clientSignatureName?: string; // e.g. "GUSTAVO JOSE ACOSTA MUÑOZ"
  clientSignatureDoc?: string; // e.g. "PASAPORTE No. 192629016"
  lawyerSignatureTitle?: string; // e.g. "LCDO. ANTONY NATHANAEL TALLA COPRIS"
  lawyerSignatureCedula?: string; // e.g. "CÉDULA NO. 8-849-2485"
  lawyerSignatureIdoneidad?: string; // e.g. "IDONEIDAD 30553"
}

export interface PlaceholderDef {
  key: string;
  label: string;
  description?: string;
  defaultValue?: string;
  type: 'text' | 'date' | 'textarea' | 'select' | 'number';
  options?: string[];
  category?: 'cliente' | 'pasaporte' | 'legal' | 'fechas' | 'personalizado';
}

export interface Template {
  id: string;
  name: string;
  description: string;
  category: 'Notarial' | 'Contratos' | 'Migratorio' | 'Judicial' | 'Corporativo' | 'General';
  idoneo?: IdoneoName | string;
  fileName: string;
  fileData?: string; // Base64 of .docx file
  placeholders: string[]; // List of {{tags}}
  placeholderDefs: PlaceholderDef[];
  isDefault?: boolean;
  samplePreviewText?: string;
  createdAt: string;
  updatedAt: string;
  usageCount: number;
}

export interface GeneratedDocument {
  id: string;
  title: string;
  fileName: string;
  templateId: string;
  templateName: string;
  clientId: string;
  clientName: string;
  passportNumber: string;
  generatedAt: string;
  fileSizeFormatted: string;
  dataSnapshot: Record<string, string>;
  fileBase64?: string; // Optional stored generated docx
}

export interface ExtractionResult {
  firstName: string;
  lastName: string;
  fullName: string;
  passportNumber: string;
  nationality: string;
  issuingCountry: string;
  birthDate: string;
  expiryDate: string;
  issueDate?: string;
  sex: string;
  sexAgeCategory?: 'VARÓN' | 'MUJER' | 'JOVEN' | 'MENOR' | string;
  age?: number;
  docType?: 'pasaporte' | 'dni' | 'nie' | 'cedula' | 'otro';
  documentType?: string; // e.g. "Pasaporte", "Cédula", "Carnet de Identidad", "DNI"
  personalNumber?: string;
  placeOfBirth?: string;
  mrzLine1?: string;
  mrzLine2?: string;
  mrzLine3?: string;
  confidenceScore?: number;
  notes?: string;
  method: 'ocr' | 'tesseract' | 'ai' | 'manual';
  rawOcrText?: string;
  imagePreview?: string;
  extractedJson?: Record<string, any>;
}

export type ActiveTab = 'wizard' | 'generator' | 'clients' | 'templates' | 'history' | 'database' | 'manual';

export interface DatabaseStats {
  totalClients: number;
  totalTemplates: number;
  totalGeneratedDocs: number;
  lastBackupDate?: string;
  storageUsageEstimateKb: number;
}
