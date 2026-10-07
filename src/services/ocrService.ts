import { countryName, validateMrz, mrzDate } from './mrz';
import { ocrWorkerSession } from './ocrWorker';
import { documentTypeLabel } from './fieldMapping';
import { determineSexAgeCategory } from './docxService';
import { ExtractionResult } from '../types';
import { preprocessDocumentForOCR, PreprocessedImages } from './imagePreprocessing';

export interface SamplePassportPreset {
  id: string;
  name: string;
  country: string;
  flag: string;
  passportNumber: string;
  birthDate: string;
  expiryDate: string;
  nationality: string;
  sex: 'M' | 'F';
  address: string;
  phone: string;
  email: string;
  imageDataUri: string;
}

/**
 * Standardized mapping of 3-letter ICAO country codes to Spanish demonyms and countries
 */
export function mapCountryCode(code: string): string {
  const map: Record<string, string> = {
    ESP: 'ESPAÑOLA',
    PAN: 'PANAMEÑA',
    COL: 'COLOMBIANA',
    MEX: 'MEXICANA',
    VEN: 'VENEZOLANA',
    PER: 'PERUANA',
    ARG: 'ARGENTINA',
    CHL: 'CHILENA',
    ECU: 'ECUATORIANA',
    DOM: 'DOMINICANA',
    CRI: 'COSTARRICENSE',
    GTM: 'GUATEMALTECA',
    HND: 'HONDUREÑA',
    NIC: 'NICARAGÜENSE',
    SLV: 'SALVADOREÑA',
    BOL: 'BOLIVIANA',
    PRY: 'PARAGUAYA',
    URY: 'URUGUAYA',
    CUB: 'CUBANA',
    USA: 'ESTADOUNIDENSE',
    FRA: 'FRANCESA',
    ITA: 'ITALIANA',
    DEU: 'ALEMANA',
    GBR: 'BRITÁNICA',
    PRT: 'PORTUGUESA',
    BRA: 'BRASILEÑA',
    CAN: 'CANADIENSE',
  };
  return map[code.toUpperCase()] || code.toUpperCase();
}

/**
 * Parses Machine Readable Zone (MRZ) string into structured fields.
 * Supports:
 * - TD3: 2 lines of 44 characters (Passports)
 * - TD1: 3 lines of 30 characters (Cédulas de Identidad, DNI, Carnets de Extranjería)
 * - TD2: 2 lines of 36 characters (ID Cards / Visas)
 */
export function parseMRZ(rawText: string): Partial<ExtractionResult> {
  const rawLines = rawText
    .split('\n')
    .map((l) => l.trim().replace(/\s+/g, ''))
    .filter((l) => l.length >= 25 && /^[A-Z0-9<]+$/.test(l) && l.includes('<'));

  const result: Partial<ExtractionResult> = {};

  // Case 1: TD1 format (3 lines of ~30 characters - Cédula / Carnet / DNI)
  const td1CandidateLines = rawLines.filter((l) => l.length >= 28 && l.length <= 32);
  if (td1CandidateLines.length >= 3) {
    const l1 = td1CandidateLines[td1CandidateLines.length - 3];
    const l2 = td1CandidateLines[td1CandidateLines.length - 2];
    const l3 = td1CandidateLines[td1CandidateLines.length - 1];

    if (/^[ICA]/.test(l1)) {
      result.mrzLine1 = l1;
      result.mrzLine2 = l2;
      result.mrzLine3 = l3;
      result.docType = 'cedula';
      result.documentType = 'Cédula de Identidad';

      // Line 1: Doc Type (2), Country (3), Doc Number (9), check, optional
      const issuingCountryCode = l1.substring(2, 5);
      const docNum = l1.substring(5, 14).replace(/</g, '').trim();
      result.passportNumber = docNum;
      result.issuingCountry = countryName(issuingCountryCode);

      // Line 2: DOB (6), check, Sex (1), Expiry (6), check, Nationality (3)
      if (l2.length >= 20) {
        const dobRaw = l2.substring(0, 6);
        const sex = l2.substring(7, 8);
        const expRaw = l2.substring(8, 14);
        const natCode = l2.substring(15, 18).replace(/</g, '');

        result.sex = sex === 'F' ? 'F' : sex === 'M' ? 'M' : 'Otro';
        result.nationality = mapCountryCode(natCode || issuingCountryCode);




      }

      // Line 3: Surname << Given Names
      const nameSegments = l3.split('<<');
      if (nameSegments.length >= 1) {
        result.lastName = nameSegments[0].replace(/</g, ' ').trim();
        result.firstName = (nameSegments[1] || '').replace(/</g, ' ').trim();
        result.fullName = `${result.firstName} ${result.lastName}`.trim();
      }

      if (result.mrzLine1 && result.mrzLine2) {
      const lines = [result.mrzLine1, result.mrzLine2, ...(result.mrzLine3 ? [result.mrzLine3] : [])];
      result.warnings = validateMrz(lines);
      const second = result.mrzLine2;
      result.birthDate = mrzDate(result.mrzLine3 ? second.slice(0, 6) : second.slice(13, 19), true);
      result.expiryDate = mrzDate(result.mrzLine3 ? second.slice(8, 14) : second.slice(21, 27), false);
      if (!result.birthDate || !result.expiryDate) result.warnings.push('MRZ: fecha inválida; revisa nacimiento y vencimiento.');
    }
    return result;
    }
  }

  // Case 2: TD3 format (2 lines of 44 characters - Standard Passport)
  const td3CandidateLines = rawLines.filter((l) => l.length >= 40);
  if (td3CandidateLines.length >= 2) {
    const l1 = td3CandidateLines[td3CandidateLines.length - 2];
    const l2 = td3CandidateLines[td3CandidateLines.length - 1];

    if (l1.startsWith('P') || l1.startsWith('I') || l1.startsWith('V')) {
      result.mrzLine1 = l1;
      result.mrzLine2 = l2;
      result.docType = l1.startsWith('P') ? 'pasaporte' : 'cedula';
      result.documentType = l1.startsWith('P') ? 'Pasaporte' : 'Cédula de Identidad';

      // Line 1: P<ISSLASTNAME<<FIRSTNAME<MIDDLE<<<<<<<<<<<<<
      const namePart = l1.substring(5);
      const nameSegments = namePart.split('<<');
      if (nameSegments.length >= 1) {
        const lastName = nameSegments[0].replace(/</g, ' ').trim();
        const firstName = (nameSegments[1] || '').replace(/</g, ' ').trim();
        result.lastName = lastName;
        result.firstName = firstName;
        result.fullName = `${firstName} ${lastName}`.trim();
      }

      // Line 2: PASSPORT_NUM (9) + CHECK (1) + NATIONALITY (3) + DOB (6) + CHECK (1) + SEX (1) + EXPIRY (6) + CHECK (1)
      if (l2.length >= 28) {
        const passportNum = l2.substring(0, 9).replace(/</g, '').trim();
        const nationalityCode = l2.substring(10, 13).replace(/</g, '').trim();
        const dobRaw = l2.substring(13, 19); // YYMMDD
        const sex = l2.substring(20, 21);
        const expRaw = l2.substring(21, 27); // YYMMDD

        result.passportNumber = passportNum;
        result.nationality = mapCountryCode(nationalityCode);
        result.issuingCountry = countryName(l1.substring(2, 5));
        result.sex = sex === 'F' ? 'F' : sex === 'M' ? 'M' : 'Otro';




      }
      if (result.mrzLine1 && result.mrzLine2) {
      const lines = [result.mrzLine1, result.mrzLine2, ...(result.mrzLine3 ? [result.mrzLine3] : [])];
      result.warnings = validateMrz(lines);
      const second = result.mrzLine2;
      result.birthDate = mrzDate(result.mrzLine3 ? second.slice(0, 6) : second.slice(13, 19), true);
      result.expiryDate = mrzDate(result.mrzLine3 ? second.slice(8, 14) : second.slice(21, 27), false);
      if (!result.birthDate || !result.expiryDate) result.warnings.push('MRZ: fecha inválida; revisa nacimiento y vencimiento.');
    }
    return result;
    }
  }

  // Case 3: TD2 format (2 lines of ~36 characters - ID Card or Visa)
  const td2CandidateLines = rawLines.filter((l) => l.length >= 34 && l.length <= 38);
  if (td2CandidateLines.length >= 2) {
    const l1 = td2CandidateLines[td2CandidateLines.length - 2];
    const l2 = td2CandidateLines[td2CandidateLines.length - 1];

    result.mrzLine1 = l1;
    result.mrzLine2 = l2;
    result.docType = 'cedula';
    result.documentType = 'Carnet / Cédula';

    const namePart = l1.substring(5);
    const nameSegments = namePart.split('<<');
    if (nameSegments.length >= 1) {
      result.lastName = nameSegments[0].replace(/</g, ' ').trim();
      result.firstName = (nameSegments[1] || '').replace(/</g, ' ').trim();
      result.fullName = `${result.firstName} ${result.lastName}`.trim();
    }

    if (l2.length >= 28) {
      result.passportNumber = l2.substring(0, 9).replace(/</g, '').trim();
      const natCode = l2.substring(10, 13).replace(/</g, '').trim();
      result.nationality = mapCountryCode(natCode);
      result.issuingCountry = countryName(l1.substring(2, 5));
      const dobRaw = l2.substring(13, 19);
      const sex = l2.substring(20, 21);
      const expRaw = l2.substring(21, 27);
      result.sex = sex === 'F' ? 'F' : sex === 'M' ? 'M' : 'Otro';



    }
    if (result.mrzLine1 && result.mrzLine2) {
      const lines = [result.mrzLine1, result.mrzLine2, ...(result.mrzLine3 ? [result.mrzLine3] : [])];
      result.warnings = validateMrz(lines);
      const second = result.mrzLine2;
      result.birthDate = mrzDate(result.mrzLine3 ? second.slice(0, 6) : second.slice(13, 19), true);
      result.expiryDate = mrzDate(result.mrzLine3 ? second.slice(8, 14) : second.slice(21, 27), false);
      if (!result.birthDate || !result.expiryDate) result.warnings.push('MRZ: fecha inválida; revisa nacimiento y vencimiento.');
    }
    return result;
  }

  if (result.mrzLine1 && result.mrzLine2) {
      const lines = [result.mrzLine1, result.mrzLine2, ...(result.mrzLine3 ? [result.mrzLine3] : [])];
      result.warnings = validateMrz(lines);
      const second = result.mrzLine2;
      result.birthDate = mrzDate(result.mrzLine3 ? second.slice(0, 6) : second.slice(13, 19), true);
      result.expiryDate = mrzDate(result.mrzLine3 ? second.slice(8, 14) : second.slice(21, 27), false);
      if (!result.birthDate || !result.expiryDate) result.warnings.push('MRZ: fecha inválida; revisa nacimiento y vencimiento.');
    }
    return result;
}

/**
 * Optical parser for visual text on Latin American and Spanish Cédulas, Carnets, DNI, NIE and Passports.
 * Extracts fields when MRZ is absent, blurry or photographed at an angle.
 */
export function parseVisualDocumentText(rawText: string): Partial<ExtractionResult> {
  const result: Partial<ExtractionResult> = {};
  const upper = rawText.toUpperCase();

  // 1. Detect Document Type
  if (upper.includes('CÉDULA') || upper.includes('CEDULA') || upper.includes('CARNET DE IDENTIDAD')) {
    result.docType = 'cedula';
    result.documentType = 'Cédula de Identidad';
  } else if (upper.includes('DNI') || upper.includes('DOCUMENTO NACIONAL')) {
    result.docType = 'dni';
    result.documentType = 'DNI';
  } else if (upper.includes('NIE') || upper.includes('EXTRANJERO') || upper.includes('EXTRANJERÍA')) {
    result.docType = 'nie';
    result.documentType = 'Carnet de Extranjería / NIE';
  } else if (upper.includes('PASAPORTE') || upper.includes('PASSPORT')) {
    result.docType = 'pasaporte';
    result.documentType = 'Pasaporte';
  }

  // 2. Document Number Regex Patterns
  // Panama Cédula: 8-765-4321, 4-123-4567, PE-8-1234, E-8-1234, 1AV-123-456
  const panamaCedulaMatch = rawText.match(/\b([0-9]{1,2}|PE|E|[0-9]{1,2}AV)-([0-9]{3,4})-([0-9]{4,6})\b/i);
  // Colombia C.C.: 1.020.345.678 or 52.345.678
  const colombiaCedulaMatch = rawText.match(/(?:C\.?C\.?|CÉDULA|CEDULA)\s*[:.]?\s*(\b[0-9]{1,2}\.?[0-9]{3}\.?[0-9]{3}\b)/i);
  // Spain DNI / NIE: 12345678A or X-1234567-Y
  const spainDniNieMatch = rawText.match(/\b([XYZ]?[0-9]{7,8}[A-Z])\b/i);
  // Venezuela: V-12345678 or E-12345678
  const venezuelaMatch = rawText.match(/\b([VE]-[0-9]{7,9})\b/i);
  // Generic Passport: PA1234567, A12345678, etc.
  const passRegex = /(?:PASAPORTE|PASSPORT|DOCUMENTO)(?:[ \t]+(?:N[º°O.]|NUM(?:ERO)?|NUMBER))?[ \t]*[:.]?[ \t]*(?=[A-Z0-9]*\d)([A-Z0-9]{5,15})\b/i;
  const passMatch = rawText.match(passRegex);

  if (panamaCedulaMatch) {
    result.passportNumber = panamaCedulaMatch[0];
    result.docType = 'cedula';
    result.documentType = 'Cédula de Identidad (Panamá)';

    result.issuingCountry = result.issuingCountry || 'PANAMÁ';
  } else if (spainDniNieMatch) {
    result.passportNumber = spainDniNieMatch[1];
    result.docType = spainDniNieMatch[1].startsWith('X') || spainDniNieMatch[1].startsWith('Y') || spainDniNieMatch[1].startsWith('Z') ? 'nie' : 'dni';
    result.documentType = result.docType === 'nie' ? 'NIE' : 'DNI';
    result.nationality = result.nationality || '';
  } else if (venezuelaMatch) {
    result.passportNumber = venezuelaMatch[1];
    result.docType = 'cedula';
    result.documentType = 'Cédula de Identidad (Venezuela)';

  } else if (colombiaCedulaMatch && colombiaCedulaMatch[1].replace(/\./g, '').length >= 6) {
    result.passportNumber = colombiaCedulaMatch[1].replace(/\./g, '');
    result.docType = 'cedula';
    result.documentType = 'Cédula de Ciudadanía';
  } else if (passMatch && passMatch[1].length >= 7) {
    result.passportNumber = passMatch[1];
  }

  // 3. Names Extraction
  const surnameMatch = rawText.match(/(?:APELLIDOS|SURNAME|PRIMER APELLIDO)[\s/:]+([A-ZÁÉÍÓÚÑ\s]+)/i);
  const givenMatch = rawText.match(/(?:NOMBRES|GIVEN NAMES|NOMBRE)[\s/:]+([A-ZÁÉÍÓÚÑ\s]+)/i);
  const fullMatch = rawText.match(/(?:NOMBRE COMPLETO|TITULAR|APELLIDOS Y NOMBRES)[\s/:]+([A-ZÁÉÍÓÚÑ\s]+)/i);

  if (surnameMatch) {
    result.lastName = surnameMatch[1].split('\n')[0].replace(/[0-9<]/g, '').trim();
  }
  if (givenMatch) {
    result.firstName = givenMatch[1].split('\n')[0].replace(/[0-9<]/g, '').trim();
  }
  if (result.firstName || result.lastName) {
    result.fullName = `${result.firstName || ''} ${result.lastName || ''}`.trim();
  } else if (fullMatch) {
    const fn = fullMatch[1].split('\n')[0].replace(/[0-9<]/g, '').trim();
    result.fullName = fn;
    const parts = fn.split(' ');
    result.firstName = parts.slice(0, Math.ceil(parts.length / 2)).join(' ');
    result.lastName = parts.slice(Math.ceil(parts.length / 2)).join(' ');
  }

  // Read labeled dates only: emission must not become birth or expiry.
  const readDate = (labels: string): string => {
    const match = rawText.match(new RegExp(`(?:${labels})[\\s:.]*((?:19|20)\\d{2}[-/.]\\d{1,2}[-/.]\\d{1,2}|\\d{1,2}[-/.]\\d{1,2}[-/.](?:19|20)\\d{2})`, 'i'));
    if (!match) return '';
    const parts = match[1].split(/[-/.]/).map(Number);
    const [year, month, day] = parts[0] > 1900 ? parts : [parts[2], parts[1], parts[0]];
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return '';
    return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  };
  result.birthDate = readDate('FECHA (?:DE )?NACIMIENTO|NACIMIENTO|DATE OF BIRTH|BIRTH DATE');
  result.expiryDate = readDate('FECHA (?:DE )?(?:VENCIMIENTO|CADUCIDAD)|VENCIMIENTO|CADUCIDAD|DATE OF EXPIRY|EXPIRY DATE');
  result.issueDate = readDate('FECHA (?:DE )?EMISI[ÓO]N|DATE OF ISSUE|ISSUE DATE');

  // 5. Sex Extraction
  if (/\b(SEXO|SEX)\b[\s/:]*(M|V|VARÓN|VARON|MASCULINO|HOMBRE)\b/i.test(rawText)) {
    result.sex = 'M';
  } else if (/\b(SEXO|SEX)\b[\s/:]*(F|MUJER|FEMENINO)\b/i.test(rawText)) {
    result.sex = 'F';
  }

  // 6. Nationality Extraction
  const nationalities = [
    { key: 'PANAMEÑA', words: ['PANAMA', 'PANAMÁ', 'PANAMEÑA'] },
    { key: 'ESPAÑOLA', words: ['ESPAÑA', 'ESPAÑOLA', 'ESPANOLA'] },
    { key: 'COLOMBIANA', words: ['COLOMBIA', 'COLOMBIANA'] },
    { key: 'MEXICANA', words: ['MEXICO', 'MÉXICO', 'MEXICANA'] },
    { key: 'VENEZOLANA', words: ['VENEZUELA', 'VENEZOLANA'] },
    { key: 'PERUANA', words: ['PERU', 'PERÚ', 'PERUANA'] },
    { key: 'ARGENTINA', words: ['ARGENTINA'] },
    { key: 'CHILENA', words: ['CHILE', 'CHILENA'] },
    { key: 'ESTADOUNIDENSE', words: ['USA', 'ESTADOS UNIDOS', 'UNITED STATES', 'AMERICAN'] },
  ];

  const nationalityText = upper.match(/(?:NACIONALIDAD|NATIONALITY)[ \t:/]+([^\n]+)/)?.[1] || '';
  for (const n of nationalities) {
    if (n.words.some((w) => nationalityText.includes(w))) {
      result.nationality = n.key;

      break;
    }
  }

  return result;
}

/**
 * Constructs a strict, standardized JSON object from extracted document fields.
 * This JSON is the single source of truth that will be displayed to the user
 * and directly mapped onto the final Microsoft Word (.docx) document tags.
 */
export function buildStructuredDocumentJson(
  data: Partial<ExtractionResult>
): Record<string, any> {
  const docType = data.documentType || documentTypeLabel(data.docType);
  const sexCondition = data.sexAgeCategory || determineSexAgeCategory(data.birthDate, data.sex).category;

  return {
    tipo_documento: docType,
    numero_identidad: (data.passportNumber || '').toUpperCase().trim(),
    nombres: (data.firstName || '').toUpperCase().trim(),
    apellidos: (data.lastName || '').toUpperCase().trim(),
    nombre_completo: (data.fullName || `${data.firstName || ''} ${data.lastName || ''}`).toUpperCase().trim(),
    nacionalidad: (data.nationality || '').toUpperCase().trim(),
    pais_emisor: (data.issuingCountry || '').toUpperCase().trim(),
    fecha_nacimiento: data.birthDate || '',
    fecha_vencimiento: data.expiryDate || '',
    fecha_emision: data.issueDate || '',
    sexo: data.sex || '',
    condicion_juridica: sexCondition,
    lugar_nacimiento: data.placeOfBirth || '',
    numero_personal: data.personalNumber || '',
    codigo_mrz_linea1: data.mrzLine1 || '',
    codigo_mrz_linea2: data.mrzLine2 || '',
    codigo_mrz_linea3: data.mrzLine3 || '',
    confianza_lectura_porcentaje: data.confidenceScore ?? 0,
    metodo_extraccion: data.method === 'manual' ? 'Revisión manual' : 'OCR Óptico Local (Tesseract.js)',
    timestamp_extraccion: new Date().toISOString(),
  };
}

/**
 * Optical character recognition using client-side Tesseract.js engine with image preprocessing.
 * Runs multi-pass recognition on both enhanced and binarized image buffers.
 */
export async function extractWithTesseract(
  imageSource: string | File | Blob,
  onProgress?: (progress: number, status: string) => void,
  preparedImages?: PreprocessedImages,
  signal?: AbortSignal
): Promise<ExtractionResult> {
  // Convert string image to preprocessed versions
  let dataUri = '';
  if (typeof imageSource === 'string') {
    dataUri = imageSource;
  } else {
    dataUri = await fileToDataUri(imageSource);
  }

  if (onProgress) {
    onProgress(15, 'Preprocesando imagen: optimizando contraste y binarización...');
  }

  // Preprocess image with optical contrast and binarization filters
  const preprocessed = preparedImages || await preprocessDocumentForOCR(dataUri);

  if (onProgress) {
    onProgress(30, 'Cargando motor OCR Tesseract (spa+eng)...');
  }


  if (onProgress) {
    onProgress(50, 'Escaneando texto óptico y zona de lectura mecánica (MRZ)...');
  }

  // First pass: enhanced contrast image
  let rawText = '';
  let confidence = 0;
  let mrzResult: Partial<ExtractionResult> = {};
  await ocrWorkerSession.run(async worker => {
  const ret = await worker.recognize(preprocessed.enhanced);
  rawText = ret.data.text;
  confidence = Math.round(ret.data.confidence) || 0;

  // Check if MRZ was found; if not, test the binarized image specifically for MRZ
  mrzResult = parseMRZ(rawText);
  if (!mrzResult.passportNumber && !mrzResult.fullName) {
    if (onProgress) {
      onProgress(75, 'Ejecutando pase secundario de alta fidelidad binarizado...');
    }
    const retBin = await worker.recognize(preprocessed.binarized);
    rawText += '\n' + retBin.data.text;
    const mrzBin = parseMRZ(retBin.data.text);
    if (mrzBin.passportNumber || mrzBin.fullName) {
      mrzResult = mrzBin;
      confidence = Math.max(confidence, Math.round(retBin.data.confidence));
    }
  }

  }, signal);

  if (onProgress) {
    onProgress(90, 'Extrayendo y estructurando JSON de identidad...');
  }

  // Parse visual layout fields
  const visualResult = parseVisualDocumentText(rawText);

  // Merge MRZ (highest accuracy) with Visual layout (for cards without MRZ)
  const firstName = mrzResult.firstName || visualResult.firstName || '';
  const lastName = mrzResult.lastName || visualResult.lastName || '';
  const fullName = mrzResult.fullName || visualResult.fullName || `${firstName} ${lastName}`.trim() || '';
  const passportNumber = mrzResult.passportNumber || visualResult.passportNumber || '';
  const nationality = mrzResult.nationality || visualResult.nationality || '';
  const issuingCountry = mrzResult.issuingCountry || visualResult.issuingCountry || '';
  const birthDate = mrzResult.birthDate || visualResult.birthDate || '';
  const expiryDate = mrzResult.expiryDate || visualResult.expiryDate || '';
  const sex = mrzResult.sex || visualResult.sex || '';
  const docType = mrzResult.docType || visualResult.docType || 'pasaporte';
  const documentType = mrzResult.documentType || visualResult.documentType || (docType === 'cedula' ? 'Cédula de Identidad' : 'Pasaporte');

  const baseResult: ExtractionResult = {
    firstName,
    lastName,
    fullName,
    passportNumber,
    nationality,
    issuingCountry,
    birthDate,
    expiryDate,
    issueDate: visualResult.issueDate || '',
    placeOfBirth: visualResult.placeOfBirth || '',
    sex,
    docType,
    documentType,
    warnings: mrzResult.warnings || [],
    confidenceScore: confidence,
    mrzLine1: mrzResult.mrzLine1 || '',
    mrzLine2: mrzResult.mrzLine2 || '',
    mrzLine3: mrzResult.mrzLine3 || '',
    notes: 'Datos leídos mediante Reconocimiento Óptico de Caracteres (OCR Tesseract) con filtros de realce.',
    method: 'tesseract',
    rawOcrText: rawText,
    imagePreview: preprocessed.enhanced,
  };

  // Generate standardized JSON
  baseResult.extractedJson = buildStructuredDocumentJson(baseResult);

  if (onProgress) {
    onProgress(100, 'OCR completado con éxito.');
  }

  return baseResult;
}

/**
 * Helper: Converts File/Blob to Base64 Data URI
 */
function fileToDataUri(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}
