import { parseInternationalDocumentText } from "./documentTextParser";
import { evaluateIdentityDocument } from "./identityStatus";
import { countryName, validateMrz, mrzDate, normalizeMrzText } from './mrz';
import { getOcrSession, type OcrLanguage } from './ocrWorker';
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
  code=code.toUpperCase().replace(/</g,'').replace(/0/g,'O');
  if(!/^(?:[A-Z]{3}|D)$/.test(code)) return '';
  if(code==='D') code='DEU';
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
  const rawLines = normalizeMrzText(rawText)
    .split('\n')
    .map((l) => l.toUpperCase().trim().replace(/[«‹〈]/g, '<').replace(/\s+/g, ''))
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

        result.sex = sex === 'F' ? 'F' : sex === 'M' ? 'M' : sex === 'X' || sex === '<' ? 'X' : '';
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
        result.sex = sex === 'F' ? 'F' : sex === 'M' ? 'M' : sex === 'X' || sex === '<' ? 'X' : '';




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
      result.sex = sex === 'F' ? 'F' : sex === 'M' ? 'M' : sex === 'X' || sex === '<' ? 'X' : '';



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
  const result = parseInternationalDocumentText(rawText);
  if(result.nationality && /^[A-Z]{3}$/.test(result.nationality)) result.nationality=mapCountryCode(result.nationality);
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
    edad: evaluateIdentityDocument(data.birthDate,data.expiryDate,data.sex).age,
    es_menor: evaluateIdentityDocument(data.birthDate,data.expiryDate,data.sex).isMinor,
    estado_documento: evaluateIdentityDocument(data.birthDate,data.expiryDate,data.sex).expiryStatus,
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
  signal?: AbortSignal,
  language: OcrLanguage = "spa+eng"
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
  const candidates: Partial<ExtractionResult>[] = [];
  const visualCandidates: Partial<ExtractionResult>[] = [];
  await getOcrSession(language).run(async worker => {
    const read=async (image:string, mrzOnly=false) => {
      await worker.setParameters?.({tessedit_pageseg_mode:mrzOnly?6:11,tessedit_char_whitelist:mrzOnly?'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<':''});
      const ret=await worker.recognize(image);
      rawText += '\n'+ret.data.text;
      confidence=Math.max(confidence,Math.round(ret.data.confidence)||0);
      candidates.push(parseMRZ(ret.data.text));
      if(!mrzOnly) visualCandidates.push(parseVisualDocumentText(ret.data.text));
    };
    await read(preprocessed.enhanced);
    const validMrz=()=>candidates.some(value=>value.passportNumber && value.fullName && !value.warnings?.length);
    if(preprocessed.mrz && !validMrz()) {
      onProgress?.(62,'Leyendo la zona MRZ con su alfabeto y controles...');
      await read(preprocessed.mrz,true);
    }
    const visual=visualCandidates[0];
    if(!validMrz() || !visual?.fullName || !visual?.birthDate || !visual?.passportNumber) {
      onProgress?.(73,'Comparando una segunda lectura de alto contraste...');
      await read(preprocessed.binarized);
    }
    if(!validMrz() && confidence<70) {
      onProgress?.(82,'Revisando la imagen original para recuperar detalles...');
      await read(preprocessed.original);
    }
    await worker.setParameters?.({tessedit_pageseg_mode:11,tessedit_char_whitelist:''});
  }, signal);
  const score=(value:Partial<ExtractionResult>)=>['fullName','passportNumber','birthDate','expiryDate','sex'].filter(key=>value[key as keyof ExtractionResult]).length*10-(value.warnings?.length || 0)*15;
  mrzResult=candidates.filter(value=>value.mrzLine1).sort((a,b)=>score(b)-score(a))[0] || {};
  const visualResult=visualCandidates.sort((a,b)=>score(b)-score(a))[0] || {};
  for(const item of visualCandidates) for(const key of Object.keys(item) as (keyof ExtractionResult)[]) if(!visualResult[key] && item[key]) Object.assign(visualResult,{[key]:item[key]});
  const conflicting=['passportNumber','firstName','lastName','birthDate','expiryDate','sex'].filter(key=>mrzResult[key as keyof ExtractionResult] && visualResult[key as keyof ExtractionResult] && mrzResult[key as keyof ExtractionResult]!==visualResult[key as keyof ExtractionResult]);
  const fieldLabels: Record<string,string>={passportNumber:'número de identidad',firstName:'nombres',lastName:'apellidos',birthDate:'fecha de nacimiento',expiryDate:'vencimiento',sex:'sexo'};
  const warnings=[...(mrzResult.warnings || []),...conflicting.map(key=>`Las lecturas MRZ y visual difieren en ${fieldLabels[key] || key}. Compara con el documento original.`)];
  if(mrzResult.warnings?.length) {
    // Invalid MRZ must not override labeled visual fields that were read successfully.
    for(const key of ['firstName','lastName','fullName','passportNumber','birthDate','expiryDate','sex','nationality'] as const) if(visualResult[key]) mrzResult[key]=visualResult[key];
  }

  if (onProgress) {
    onProgress(90, 'Extrayendo y estructurando JSON de identidad...');
  }

  // Parse visual layout fields
  // Visual passes were parsed independently to prevent mixing labels between images.

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
  const docType = mrzResult.docType || visualResult.docType || 'otro';
  const documentType = mrzResult.documentType || visualResult.documentType || documentTypeLabel(docType);

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
    warnings,
    confidenceScore: confidence,
    mrzLine1: mrzResult.mrzLine1 || '',
    mrzLine2: mrzResult.mrzLine2 || '',
    mrzLine3: mrzResult.mrzLine3 || '',
    notes: 'Datos leídos mediante Reconocimiento Óptico de Caracteres (OCR Tesseract) con filtros de realce.',
    method: 'tesseract',
    rawOcrText: rawText,
    imagePreview: preprocessed.enhanced,
  };

  const status=evaluateIdentityDocument(birthDate,expiryDate,sex);
  baseResult.age=status.age ?? undefined;
  baseResult.sexAgeCategory=determineSexAgeCategory(birthDate,sex).category;
  if(status.expiryStatus==='vencido') baseResult.warnings!.push('DOCUMENTO VENCIDO: revisa la fecha de vencimiento antes de registrarlo o utilizarlo.');
  if(status.expiryStatus==='desconocido') baseResult.warnings!.push('Vencimiento no detectado: comprueba si el documento tiene fecha de caducidad.');
  if(!fullName || !passportNumber || !birthDate || !sex) baseResult.warnings!.push('Lectura incompleta: completa los campos de identidad que faltan antes de guardar.');
  // Generate standardized JSON
  baseResult.extractedJson = buildStructuredDocumentJson(baseResult);

  if (onProgress) {
    onProgress(100, 'Lectura terminada. Revisa los campos y avisos.');
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
