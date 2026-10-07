import { entityFile, blobBase64 } from './fileStorage';
import { parseCalendarDate } from './validation';
import PizZip from 'pizzip';
import saveAs from 'file-saver';
import { FIELD_ALIASES, canonicalField, fieldDefault, documentTypeLabel } from './fieldMapping';
import { Template, PlaceholderDef, Client, SignatureLayoutOptions } from '../types';

/**
 * Creates a valid, minimal OpenXML DOCX archive from formatted XML content.
 * This guarantees pre-bundled legal templates work 100% out of the box in MS Word, Google Docs & LibreOffice.
 */
function createBaseDocx(documentBodyXml: string): Uint8Array {
  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

  const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const wordRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
</Relationships>`;

  const fullDocumentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    ${documentBodyXml}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;

  const zip = new PizZip();
  zip.file('[Content_Types].xml', contentTypesXml);
  zip.file('_rels/.rels', relsXml);
  zip.file('word/_rels/document.xml.rels', wordRelsXml);
  zip.file('word/document.xml', fullDocumentXml);

  return zip.generate({ type: 'uint8array' });
}

function xmlEscape(text: string): string {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function p(
  text: string,
  options: { bold?: boolean; heading?: boolean; align?: 'center' | 'right' | 'left' | 'both'; spaceAfter?: number } = {}
): string {
  const jc = options.align ? `<w:jc w:val="${options.align}"/>` : '';
  const spacing = options.spaceAfter ? `<w:spacing w:after="${options.spaceAfter}"/>` : '<w:spacing w:after="160"/>';
  const rPr = options.bold
    ? `<w:rPr><w:b/><w:bCs/><w:sz w:val="${options.heading ? '32' : '24'}"/><w:szCs w:val="${options.heading ? '32' : '24'}"/><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/></w:rPr>`
    : `<w:rPr><w:sz w:val="22"/><w:szCs w:val="22"/><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/></w:rPr>`;

  return `<w:p>
    <w:pPr>
      ${jc}
      ${spacing}
    </w:pPr>
    <w:r>
      ${rPr}
      <w:t xml:space="preserve">${xmlEscape(text)}</w:t>
    </w:r>
  </w:p>`;
}

/**
 * Initial templates configuration (starts clean with 0 templates as requested)
 */
export function getInitialDefaultTemplates(): Template[] {
  return [];
}

/**
 * Extracts visible plain text from a Word XML string by parsing <w:p> and <w:t> tags
 */
function extractParagraphsFromWordXml(xml: string): string[] {
  const paragraphs: string[] = [];
  const pRegex = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/gi;
  let pMatch;

  while ((pMatch = pRegex.exec(xml)) !== null) {
    const pContent = pMatch[1];
    // Extract all <w:t> tags within this paragraph
    const tRegex = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>/gi;
    let tMatch;
    let paragraphText = '';
    while ((tMatch = tRegex.exec(pContent)) !== null) {
      paragraphText += tMatch[1];
    }
    if (paragraphText.trim()) {
      paragraphs.push(paragraphText);
    }
  }

  return paragraphs;
}

/**
 * Normalizes and extracts all placeholder tokens from a template DOCX archive.
 * Supports:
 * - Parentheses: (nombre), (número de pasaporte), (nacionalidad), (cedula/pasaporte)
 * - Double braces: {{nombre}}, {{numero_pasaporte}}, {{cedula/pasaporte}}
 * - Single braces: {nombre}, {nacionalidad}
 * - Square brackets: [nombre], [número de pasaporte]
 * - HTML/XML style: <nombre>, <numero_pasaporte>
 */
function validateWordArchive(zip: PizZip) {
  const entries = Object.entries(zip.files);
  if (entries.length > 1000) throw new Error('La plantilla contiene demasiadas partes.');
  let total = 0;
  for (const [name, entry] of entries) {
    if (/vbaProject\.bin$/i.test(name)) throw new Error('No se admiten plantillas con macros.');
    const size = Number((entry as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize || 0);
    total += size;
    if (size > 32 * 1024 * 1024 || total > 64 * 1024 * 1024) throw new Error('La plantilla supera el límite de contenido descomprimido.');
  }
}

export async function parseDocxFile(
  fileBuffer: ArrayBuffer,
  fileName: string
): Promise<{
  placeholders: string[];
  placeholderDefs: PlaceholderDef[];
  fileBase64: string;
  previewText: string;
}> {
  const uint8 = new Uint8Array(fileBuffer);
  const zip = new PizZip(uint8);
  validateWordArchive(zip);

  // List of all XML parts in docx to scan for placeholders
  const xmlPartPaths = Object.keys(zip.files).filter(
    (name) =>
      name === 'word/document.xml' ||
      /^word\/header\d+\.xml$/i.test(name) ||
      /^word\/footer\d+\.xml$/i.test(name) ||
      name === 'word/footnotes.xml' ||
      name === 'word/endnotes.xml'
  );

  const rawTagsSet = new Set<string>();

  // Known core keywords to prioritize
  const coreKeywords = [
    'nombre',
    'nombre_completo',
    'nombre completo',
    'numero de identidad',
    'número de identidad',
    'numero_identidad',
    'número_identidad',
    'identidad',
    'número de pasaporte',
    'numero de pasaporte',
    'numero_pasaporte',
    'número_pasaporte',
    'pasaporte',
    'cedula',
    'cédula',
    'nacionalidad',
    'cedula/pasaporte',
    'cédula/pasaporte',
    'cedula_pasaporte',
    'tipo_documento',
    'tipo de documento',
    'fecha_nacimiento',
    'fecha de nacimiento',
    'pais_emisor',
    'país emisor',
    'direccion',
    'dirección',
    'domicilio',
    'telefono',
    'teléfono',
    'email',
    'correo',
    'ciudad_firma',
    'fecha_firma',
    'fecha',
    'sexo',
  ];

  for (const partPath of xmlPartPaths) {
    const xmlContent = zip.file(partPath)?.asText() || '';
    const paragraphs = extractParagraphsFromWordXml(xmlContent);

    for (const text of paragraphs) {
      // 1. Parentheses: (tag with spaces, slashes, accents) e.g. (nombre), (número de pasaporte), (cedula/pasaporte)
      const parenMatches = text.match(/\(([^()]+)\)/g);
      if (parenMatches) {
        for (const raw of parenMatches) {
          const inner = raw.slice(1, -1).trim();
          if (isValidPlaceholderCandidate(inner)) {
            rawTagsSet.add(raw);
          }
        }
      }

      // 2. Double Braces: {{tag}}
      const dblMatches = text.match(/\{\{([^{}]+)\}\}/g);
      if (dblMatches) {
        for (const raw of dblMatches) {
          const inner = raw.slice(2, -2).trim();
          if (isValidPlaceholderCandidate(inner)) {
            rawTagsSet.add(raw);
          }
        }
      }

      // 3. Single Braces: {tag}
      const sglMatches = text.match(/(?<!\{)\{([^{}]+)\}(?!\})/g);
      if (sglMatches) {
        for (const raw of sglMatches) {
          const inner = raw.slice(1, -1).trim();
          if (isValidPlaceholderCandidate(inner) && !raw.startsWith('{{')) {
            rawTagsSet.add(raw);
          }
        }
      }

      // 4. Square Brackets: [tag]
      const bktMatches = text.match(/\[([^\[\]]+)\]/g);
      if (bktMatches) {
        for (const raw of bktMatches) {
          const inner = raw.slice(1, -1).trim();
          if (isValidPlaceholderCandidate(inner)) {
            rawTagsSet.add(raw);
          }
        }
      }
    }

  }
  if (!zip.file('word/document.xml')) throw new Error('El archivo no es una plantilla Word válida.');
  const placeholders = Array.from(rawTagsSet);
  if (!placeholders.length) throw new Error('La plantilla no tiene marcadores. Añade campos como {{nombre}} o {{numero_identidad}} en Word.');

  const placeholderDefs: PlaceholderDef[] = placeholders.map((key) => {
    return inferPlaceholderDef(key);
  });

  const fileBase64 = uint8ArrayToBase64(uint8);

  return {
    placeholders,
    placeholderDefs,
    fileBase64,
    previewText: extractParagraphsFromWordXml(zip.file('word/document.xml')!.asText()).join('\n'),
  };
}

/**
 * Validates whether an extracted token candidate is a real placeholder rather than random numbers or standard text
 */
function isValidPlaceholderCandidate(text: string): boolean {
  if (!text || text.length < 2 || text.length > 80) return false;
  // Ignore pure numbers (e.g. "(1)", "(123)")
  if (/^\d+$/.test(text)) return false;
  // Ignore single characters (e.g. "(a)", "(b)")
  if (text.length === 1) return false;
  // Ignore XML or code fragments
  if (text.includes('xmlns') || text.includes('w:val') || text.includes('</')) return false;

  return true;
}

/**
 * Infers field label, category and input type from tag key
 */
export function inferPlaceholderDef(rawKey: string): PlaceholderDef {
  const cleanKey = rawKey
    .replace(/^[\({<\[]+|[\)}>\]]+$/g, '')
    .trim()
    .toLowerCase();

  let label = rawKey
    .replace(/^[\({<\[]+|[\)}>\]]+$/g, '')
    .replace(/_/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

  let category: PlaceholderDef['category'] = 'personalizado';
  let type: PlaceholderDef['type'] = 'text';
  let defaultValue = '';
  let options: string[] | undefined = undefined;

  if (canonicalField(rawKey) === 'docType') return { key: rawKey, label: 'Tipo de documento', category: 'pasaporte', type: 'select', options: ['Pasaporte', 'Cédula', 'DNI', 'Carnet de Extranjería / NIE', 'Documento de identidad'] };
  const field = canonicalField(rawKey);
  const lawyerLabels: Record<string, string> = { lawyerName: 'Nombre del letrado', lawyerCedula: 'Cédula del letrado', lawyerIdoneidad: 'Idoneidad del letrado', lawyerColegiado: 'Número de colegiado' };
  if (field in lawyerLabels) return { key: rawKey, label: lawyerLabels[field], category: 'legal', type: 'text' };
  // 1. Nombre / Nombre Completo
  if (
    cleanKey === 'nombre' ||
    cleanKey.includes('nombre_completo') ||
    cleanKey.includes('nombre completo') ||
    cleanKey.includes('fullname') ||
    cleanKey === 'cliente'
  ) {
    label = 'Nombre Completo del Cliente';
    category = 'cliente';
  }
  // 2. Número de Identidad / Cédula / Pasaporte / Documento
  else if (
    cleanKey === 'numero de identidad' ||
    cleanKey === 'número de identidad' ||
    cleanKey.includes('numero_identidad') ||
    cleanKey.includes('número_identidad') ||
    cleanKey.includes('numero de identidad') ||
    cleanKey.includes('número de identidad') ||
    cleanKey.includes('identidad') ||
    cleanKey === 'número de pasaporte' ||
    cleanKey === 'numero de pasaporte' ||
    cleanKey.includes('numero_pasaporte') ||
    cleanKey.includes('número_pasaporte') ||
    cleanKey === 'pasaporte' ||
    cleanKey.includes('passport') ||
    cleanKey.includes('cedula') ||
    cleanKey.includes('cédula') ||
    cleanKey.includes('documento')
  ) {
    label = 'Número de Identidad (Cédula o Pasaporte)';
    category = 'pasaporte';
  }
  // 3. Nacionalidad
  else if (cleanKey.includes('nacionalidad') || cleanKey.includes('nationality')) {
    label = 'Nacionalidad';
    category = 'pasaporte';
  }
  // 4. Cédula / Pasaporte (Tipo de Documento)
  else if (
    cleanKey.includes('cedula/pasaporte') ||
    cleanKey.includes('cédula/pasaporte') ||
    cleanKey.includes('cedula_pasaporte') ||
    cleanKey.includes('tipo_documento') ||
    cleanKey.includes('tipo de documento') ||
    cleanKey.includes('document_type')
  ) {
    label = 'Tipo de Documento (Cédula o Pasaporte)';
    category = 'pasaporte';
    type = 'select';
    options = ['Pasaporte', 'Cédula', 'DNI', 'NIE', 'Documento Nacional'];
    defaultValue = 'Pasaporte';
  }
  // 5. Fecha de Nacimiento
  else if (cleanKey.includes('nacimiento') || cleanKey.includes('birth')) {
    label = 'Fecha de Nacimiento';
    category = 'pasaporte';
    type = 'date';
  }
  // 6. País Emisor
  else if (cleanKey.includes('pais') || cleanKey.includes('país') || cleanKey.includes('emisor') || cleanKey.includes('country')) {
    label = 'País Emisor';
    category = 'pasaporte';
  }
  // 7. Dirección
  else if (cleanKey.includes('direccion') || cleanKey.includes('dirección') || cleanKey.includes('domicilio') || cleanKey.includes('address')) {
    label = 'Dirección / Domicilio';
    category = 'cliente';
  }
  // 8. Teléfono
  else if (cleanKey.includes('telefono') || cleanKey.includes('teléfono') || cleanKey.includes('phone') || cleanKey.includes('movil')) {
    label = 'Teléfono de Contacto';
    category = 'cliente';
  }
  // 9. Email
  else if (cleanKey.includes('email') || cleanKey.includes('correo')) {
    label = 'Correo Electrónico';
    category = 'cliente';
  }
  // 10. Fechas
  else if (cleanKey.includes('fecha') || cleanKey.includes('date')) {
    label = label || 'Fecha';
    category = 'fechas';
    if (field === 'date') defaultValue = new Date().toLocaleDateString('es-PA', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Panama' });
    else type = 'date';
  }
  // 11. Ciudad
  else if (cleanKey.includes('ciudad') || cleanKey.includes('city') || cleanKey.includes('lugar')) {
    label = label || 'Ciudad';
    category = 'fechas';
    defaultValue = '';
  }
  // 12. Sexo / Edad (Condición Legal: Varón, Mujer, Joven, Menor)
  else if (
    cleanKey.includes('sexo/edad') ||
    cleanKey.includes('sexo / edad') ||
    cleanKey.includes('sexo_edad') ||
    cleanKey.includes('sexo-edad') ||
    cleanKey.includes('edad/sexo') ||
    cleanKey === 'condicion' ||
    cleanKey === 'condición'
  ) {
    label = 'Condición Legal (Sexo/Edad: Varón, Mujer, Joven, Menor)';
    category = 'pasaporte';
    type = 'select';
    options = ['VARÓN', 'MUJER', 'JOVEN', 'MENOR'];
    defaultValue = '';
  }
  // 13. Sexo simple / Género (Varón, Mujer, Joven, Menor)
  else if (cleanKey.includes('sexo') || cleanKey.includes('genero') || cleanKey.includes('gender')) {
    label = 'Condición / Sexo (Varón, Mujer, Joven, Menor)';
    category = 'pasaporte';
    type = 'select';
    options = ['VARÓN', 'MUJER', 'JOVEN', 'MENOR'];
    defaultValue = '';
  }
  // 14. Detalles legales
  else if (cleanKey.includes('motivo') || cleanKey.includes('facultades') || cleanKey.includes('objeto') || cleanKey.includes('descripcion') || cleanKey.includes('clausula')) {
    label = label || 'Detalle Legal';
    category = 'legal';
    type = 'textarea';
  }

  return {
    key: rawKey,
    label,
    category,
    type,
    defaultValue,
    options,
  };
}

/**
 * Calculates client age in completed years from a birth date string and reference date.
 * Supports multiple formats: YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, YYYY/MM/DD, etc.
 */
export function calculateAgeFromBirthDate(birthDateStr?: string, refDate: Date = new Date()): number | null {
  if (!birthDateStr || !birthDateStr.trim()) return null;
  const birth = parseCalendarDate(birthDateStr);
  if (!birth) return null;
  const today = new Date(refDate.getTime() - 5 * 60 * 60 * 1000);
  let age = today.getUTCFullYear() - birth.getUTCFullYear();
  const month = today.getUTCMonth() - birth.getUTCMonth();
  if (month < 0 || (month === 0 && today.getUTCDate() < birth.getUTCDate())) age--;
  return age >= 0 && age <= 130 ? age : null;
}

/**
 * Determines the (sexo) and (sexo/edad) legal classification:
 * - If client age is < 14 years old (menor de 14 años): returns "MENOR"
 * - If client age is 14 to 17 years old (14 a 17 años): returns "JOVEN"
 * - If client age is >= 18 years old (de 18 para adelante): returns "VARÓN" o "MUJER" dependiendo del sexo
 */
export function determineSexAgeCategory(
  birthDate?: string,
  sex?: string,
  customOverride?: string
): { category: string; age: number | null; explanation: string } {
  if (customOverride && customOverride.trim()) {
    let cleanOverride = customOverride.trim().toUpperCase();
    if (cleanOverride === 'VARON') cleanOverride = 'VARÓN';
    return {
      category: cleanOverride,
      age: calculateAgeFromBirthDate(birthDate),
      explanation: `Seleccionado manualmente: ${cleanOverride}`,
    };
  }

  const age = calculateAgeFromBirthDate(birthDate);
  const normalizedSex = (sex || '').trim().toUpperCase();
  if (!['M', 'F', 'VARON', 'VARÓN', 'MUJER', 'MASCULINO', 'FEMENINO'].includes(normalizedSex)) return { category: '', age, explanation: 'Verifica la condición antes de generar.' };
  const isFemale = normalizedSex === 'F' || normalizedSex.startsWith('FEM') || normalizedSex === 'MUJER';

  if (age !== null) {
    if (age < 14) {
      return {
        category: 'MENOR',
        age,
        explanation: `${age} años (menor de 14 años) ➔ Clasificado como MENOR`,
      };
    } else if (age <= 17) {
      return {
        category: 'JOVEN',
        age,
        explanation: `${age} años (14 a 17 años) ➔ Clasificado como JOVEN`,
      };
    } else {
      // De 18 en adelante -> VARÓN o MUJER
      const cat = isFemale ? 'MUJER' : 'VARÓN';
      return {
        category: cat,
        age,
        explanation: `${age} años (mayor de edad, ${isFemale ? 'mujer' : 'varón'}) ➔ Clasificado como ${cat}`,
      };
    }
  }

  return {
    category: '', age: null,
    explanation: 'Falta una fecha de nacimiento válida. Verifica la condición antes de generar.',
  };
}

/**
 * Checks if a placeholder key corresponds to client nationality / country of origin.
 */
export function isNationalityKey(key: string): boolean {
  const clean = key.replace(/^[\({<\[\s]+|[\)}>\]\s]+$/g, '').trim().toLowerCase();
  return (
    clean === 'nacionalidad' ||
    clean === 'nationality' ||
    clean === 'nacionalidad_cliente' ||
    clean === 'pais_origen' ||
    clean === 'país_origen'
  );
}

/**
 * Helper to produce bold run properties (<w:rPr>) in OpenXML
 */
function makeBoldRPr(baseRPr: string): string {
  if (!baseRPr) {
    return '<w:rPr><w:b/><w:bCs/></w:rPr>';
  }
  // Remove any non-bold attributes/tags
  const rPr = baseRPr
    .replace(/<w:b\b[^>]*\/>/gi, '')
    .replace(/<w:bCs\b[^>]*\/>/gi, '');
  if (/<w:rPr\b[^>]*>/i.test(rPr)) {
    return rPr.replace(/(<w:rPr\b[^>]*>)/i, '$1<w:b/><w:bCs/>');
  }
  return `<w:rPr><w:b/><w:bCs/>${rPr}</w:rPr>`;
}

/**
 * Helper to produce non-bold run properties (<w:rPr>) in OpenXML (used specifically for nationality)
 */
function makeNotBoldRPr(baseRPr: string): string {
  if (!baseRPr) {
    return '<w:rPr><w:b w:val="0"/><w:bCs w:val="0"/></w:rPr>';
  }
  // Remove any bold attributes/tags
  const rPr = baseRPr
    .replace(/<w:b\b[^>]*\/>/gi, '')
    .replace(/<w:bCs\b[^>]*\/>/gi, '');
  if (/<w:rPr\b[^>]*>/i.test(rPr)) {
    return rPr.replace(/(<w:rPr\b[^>]*>)/i, '$1<w:b w:val="0"/><w:bCs w:val="0"/>');
  }
  return `<w:rPr><w:b w:val="0"/><w:bCs w:val="0"/>${rPr}</w:rPr>`;
}

function makePlainRPr(baseRPr: string): string {
  return baseRPr || '';
}

/**
 * Builds a multi-alias dictionary ensuring EVERY spelling, capitalization and delimiter variation
 * of the core 4 fields and standard fields is accurately resolved.
 * 
 * FORMATTING RULES:
 * - All replaced fields are converted to UPPERCASE (MAYÚSCULAS).
 * - Exception: (nacionalidad) is converted to lowercase (minúsculas).
 */
export function buildComprehensiveReplacementMap(
  data: Record<string, any>,
  client?: Client | null
): Record<string, string> {
  const map: Record<string, string> = {};
  const values: Record<string, string> = {};
  const category = determineSexAgeCategory(client?.birthDate, client?.sex).category;
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    values[field] = fieldDefault(aliases[0], client, undefined, category);
  }
  // Explicit edits always win, including an intentionally empty value.
  for (const [key, value] of Object.entries(data)) {
    if (!key.startsWith('_') && value != null) values[canonicalField(key)] = String(value).trim();
  }
  const add = (key: string, value: string) => {
    const bare = key.replace(/^[({\[\s]+|[)}\]\s]+$/g, '');
    const formatted = canonicalField(key) === 'nationality' ? value.toLowerCase() : value.toUpperCase();
    for (const alias of new Set([bare, bare.toLowerCase(), bare.toUpperCase()])) {
      for (const [a,b] of [['(',')'], ['{{','}}'], ['{','}'], ['[',']']]) map[a+alias+b] = formatted;
    }
  };
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    aliases.forEach(alias => add(alias, values[field] || ''));
  }
  Object.entries(data).filter(([key]) => !key.startsWith('_')).forEach(([key]) => add(key, values[canonicalField(key)] || ''));
  return map;
}

interface ParsedRun {
  rPr: string;
  text: string;
  startIndex: number;
  endIndex: number;
}

/**
 * Reconstructs original runs slicing text exactly across their run boundaries,
 * preserving any pre-existing bold, italic, font or size formatting in the source document.
 */
function sliceOriginalRunsToXml(
  runs: ParsedRun[],
  sliceStart: number,
  sliceEnd: number,
  fallbackRPr: string
): string {
  if (sliceStart >= sliceEnd) return '';
  let xml = '';

  for (const r of runs) {
    const overlapStart = Math.max(r.startIndex, sliceStart);
    const overlapEnd = Math.min(r.endIndex, sliceEnd);

    if (overlapStart < overlapEnd) {
      const offsetStart = overlapStart - r.startIndex;
      const offsetEnd = overlapEnd - r.startIndex;
      const sub = r.text.slice(offsetStart, offsetEnd);
      if (sub) {
        const rPr = r.rPr || fallbackRPr || '';
        xml += `<w:r>${rPr}<w:t xml:space="preserve">${xmlEscape(sub)}</w:t></w:r>`;
      }
    }
  }

  return xml;
}

/**
 * Robust XML token replacement across OpenXML document paragraphs, headers and footers.
 * 
 * STRICT RULES:
 * 1. ONLY placeholders enclosed inside delimiters (parentheses, braces, brackets) are replaced.
 * 2. Words outside delimiters in the legal text are PROTECTED and NEVER replaced.
 * 3. All replaced tokens are formatted in UPPERCASE and BOLD (<w:b/><w:bCs/>).
 * 4. EXCEPTION: (nacionalidad) is formatted in lowercase (minúsculas) and NOT bold (sin negrita).
 * 5. ALL pre-existing bold text and font formatting in the source document are 100% PRESERVED.
 */
function xmlUnescape(text: string): string {
  return text.replace(/&#(x[0-9a-f]+|\d+);/gi, (_, code) => String.fromCodePoint(code[0].toLowerCase() === 'x' ? parseInt(code.slice(1), 16) : Number(code)))
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}

// Keep drawings, hyperlinks, bookmarks, tables, breaks and field codes intact.
// Only text nodes that overlap a marker are changed, including split Word runs.
export function replaceTokensInWordXml(xml: string, replacementMap: Record<string, string>): string {
  const values = new Map(Object.entries(replacementMap).map(([key, value]) => [canonicalField(key), value]));
  return xml.replace(/<w:p\b([^>]*)>((?:(?!<w:p\b)[\s\S])*?)<\/w:p>/gi, (paragraph, attrs, inner) => {
    const nodes: { start: number; end: number; text: string; replacement?: string }[] = [];
    let combined = '';
    for (const match of inner.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/gi)) {
      const text = xmlUnescape(match[1]);
      nodes.push({ start: combined.length, end: combined.length + text.length, text });
      combined += text;
    }
    const edits: {start: number; end: number; value: string; nationality: boolean}[] = [];
    for (const match of combined.matchAll(/\{\{[^{}]+\}\}|(?<!\{)\{[^{}]+\}(?!\})|\([^()]+\)|\[[^\[\]]+\]/g)) {
      const field = canonicalField(match[0]);
      if (!values.has(field)) continue;
      edits.push({ start: match.index!, end: match.index! + match[0].length, value: values.get(field)!, nationality: field === 'nationality' });
    }
    if (!edits.length) return paragraph;
    const replacements: {text: string; inserted?: boolean; nationality?: boolean}[][] = [];
    for (const node of nodes) {
      let cursor = node.start;
      const fragments: {text: string; inserted?: boolean; nationality?: boolean}[] = [];
      for (const edit of edits) {
        if (edit.end <= node.start || edit.start >= node.end) continue;
        if (edit.start > cursor) fragments.push({ text: node.text.slice(cursor - node.start, edit.start - node.start) });
        if (edit.start >= node.start) fragments.push({ text: edit.value, inserted: true, nationality: edit.nationality });
        cursor = Math.min(node.end, edit.end);
      }
      if (cursor < node.end) fragments.push({ text: node.text.slice(cursor - node.start) });
      replacements.push(fragments);
    }
    let index = 0;
    const updated = inner.replace(/<w:r\b([^>]*)>([\s\S]*?)<\/w:r>/gi, (run: string, runAttrs: string, runInner: string) => {
      const originalProps = runInner.match(/<w:rPr\b[^>]*>[\s\S]*?<\/w:rPr>/i)?.[0] || '';
      const content = runInner.replace(originalProps, '');
      let result = '';
      let position = 0;
      const wrap = (body: string, props = originalProps) => body ? `<w:r${runAttrs}>${props}${body}</w:r>` : '';
      for (const match of content.matchAll(/<w:t\b([^>]*)>[\s\S]*?<\/w:t>/gi)) {
        result += wrap(content.slice(position, match.index));
        const fragments = replacements[index++] || [];
        for (const fragment of fragments) {
          const props = fragment.inserted ? (fragment.nationality ? makeNotBoldRPr(originalProps) : makeBoldRPr(originalProps)) : originalProps;
          const text = xmlEscape(fragment.text).replace(/\r?\n/g, '</w:t><w:br/><w:t xml:space="preserve">');
          result += wrap(`<w:t xml:space="preserve">${text}</w:t>`, props);
        }
        position = match.index! + match[0].length;
      }
      result += wrap(content.slice(position));
      return result || `<w:r${runAttrs}>${originalProps}<w:t/></w:r>`;
    });
    return `<w:p${attrs}>${updated}</w:p>`;
  });
}

/**
 * Formats and aligns the Signature Block in OpenXML word/document.xml.
 * Implements a balanced two-column layout (Table or normalized tabs)
 * guaranteeing that the client's signature line and passport/ID line
 * remain 100% vertically aligned under "OTORGO PODER:", regardless of whether
 * the name is short (e.g. "ANA LI") or long (e.g. "GUSTAVO JOSE ACOSTA MUÑOZ").
 */
export function formatAndAlignSignatureBlockInWordXml(
  xml: string,
  options?: SignatureLayoutOptions,
  replacementMap?: Record<string, string>,
  client?: Client | null
): string {
  if (!options?.enabled) return xml;
  const paragraphs = Array.from(xml.matchAll(/<w:p\b[^>]*>((?:(?!<w:p\b)[\s\S])*?)<\/w:p>/gi));
  const plain = (p: RegExpMatchArray) => extractParagraphsFromWordXml(p[0]).join(' ').trim();
  const first = paragraphs.findIndex(p => /ACEPTO\s*PODER/i.test(plain(p)) && /OTORGO\s*PODER/i.test(plain(p)));
  const last = first < 0 ? -1 : paragraphs.findIndex((p, i) => i > first && i <= first + 6 && /^(?:C[EÉ]DULA|PASAPORTE|DNI|NIE)\b/i.test(plain(p)));
  if (first < 0 || last < 0) throw new Error('No se encontró un bloque de firmas compatible. Desactiva Aplicar bloque de firmas para conservar el formato original.');
  const start = paragraphs[first].index!;
  const end = paragraphs[last].index! + paragraphs[last][0].length;
  if (/<w:(?:tbl|tc|drawing|sectPr)\b/.test(xml.slice(start, end))) throw new Error('El bloque de firmas tiene una estructura compleja. Conserva el formato de tu plantilla desactivando el bloque de firmas.');
  const name = options.clientSignatureName || client?.fullName || '';
  const document = options.clientSignatureDoc || `${documentTypeLabel(client?.docType)} No. ${client?.passportNumber || ''}`;
  const lawyer = options.lawyerSignatureTitle || '';
  const cedula = options.lawyerSignatureCedula || '';
  const idoneidad = options.lawyerSignatureIdoneidad || '';
  if (!name || !lawyer) throw new Error('Completa los nombres del cliente y del letrado en el bloque de firmas.');
  const blanks = Math.max(1, Math.min(5, options.signatureBlankLines ?? 2));
  const align = options.alignment === 'center' ? 'center' : options.alignment === 'column-right' ? 'right' : 'left';
  const left = ['ACEPTO PODER', ...Array(blanks).fill(''), lawyer, cedula, idoneidad];
  const right = ['OTORGO PODER:', ...Array(blanks).fill(''), name, document, ''];
  const section = xml.match(/<w:pgSz\b[^>]*w:w="(\d+)"/);
  const margin = xml.match(/<w:pgMar\b[^>]*>/)?.[0] || '';
  const width = Math.max(3000, Number(section?.[1] || 11906) - Number(margin.match(/w:left="(\d+)"/)?.[1] || 1440) - Number(margin.match(/w:right="(\d+)"/)?.[1] || 1440));
  const offset = Math.round(width * Math.max(25, Math.min(75, options.columnOffsetPercent ?? 56)) / 100);
  let block = '';
  if (options.useTwoColumnTable !== false) {
    const cell = (lines: string[], cellWidth: number) => `<w:tc><w:tcPr><w:tcW w:w="${cellWidth}" w:type="dxa"/></w:tcPr>${lines.map(line => p(line.toUpperCase(), { bold: true, align })).join('')}</w:tc>`;
    block = `<w:tbl><w:tblPr><w:tblW w:w="${width}" w:type="dxa"/><w:tblBorders>${['top','left','bottom','right','insideH','insideV'].map(side => `<w:${side} w:val="nil"/>`).join('')}</w:tblBorders></w:tblPr><w:tblGrid><w:gridCol w:w="${offset}"/><w:gridCol w:w="${width-offset}"/></w:tblGrid><w:tr>${cell(left, offset)}${cell(right, width-offset)}</w:tr></w:tbl>`;
  } else {
    block = left.map((line,i) => `<w:p><w:pPr><w:tabs><w:tab w:val="${align}" w:pos="${offset}"/></w:tabs></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">${xmlEscape(line.toUpperCase())}</w:t><w:tab/><w:t xml:space="preserve">${xmlEscape(right[i].toUpperCase())}</w:t></w:r></w:p>`).join('');
  }
  return xml.slice(0, start) + block + xml.slice(end);
}

/**
 * Replaces all placeholders in a template DOCX and generates a real downloadable DOCX file.
 * Handles (nombre), (número de pasaporte), (nacionalidad), (cedula/pasaporte), and any {{tag}} / {tag} delimiters!
 */
export async function generateAndDownloadDocx(
  template: Template,
  data: Record<string, string | number>,
  customDownloadFileName?: string,
  client?: Client | null,
  signatureOptions?: SignatureLayoutOptions,
  download = true
): Promise<{ blob: Blob; fileName: string; sizeFormatted: string }> {
  if (!template.fileData) template = { ...template, fileData: await blobBase64(await entityFile('templates', template.sourceTemplateId || template.id)) };
  if (template.approved === false) throw new Error('La plantilla necesita aprobación antes de generar.');

  const missing = template.placeholders.filter(key => !String(data[key] ?? '').trim());
  if (missing.length) throw new Error(`Completa los campos: ${missing.join(', ')}`);
  const binaryString = atob(template.fileData!);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const zip = new PizZip(bytes);
  validateWordArchive(zip);

  // 1. Build comprehensive multi-alias dictionary
  const replacementMap = buildComprehensiveReplacementMap(data, client);

  // 2. Perform direct token replacement on all Word OpenXML parts
  const xmlPartPaths = Object.keys(zip.files).filter(
    (name) =>
      name === 'word/document.xml' ||
      /^word\/header\d+\.xml$/i.test(name) ||
      /^word\/footer\d+\.xml$/i.test(name) ||
      name === 'word/footnotes.xml' ||
      name === 'word/endnotes.xml'
  );

  for (const partPath of xmlPartPaths) {
    const rawXml = zip.file(partPath)?.asText();
    if (rawXml) {
      let updatedXml = replaceTokensInWordXml(rawXml, replacementMap);
      if (partPath === 'word/document.xml') {
        updatedXml = formatAndAlignSignatureBlockInWordXml(updatedXml, signatureOptions, replacementMap, client);
      }
      const unresolved = extractParagraphsFromWordXml(updatedXml).flatMap(text => text.match(/\{\{[^{}]+\}\}/g) || []);
      if (unresolved.length) throw new Error(`Hay marcadores pendientes en el Word: ${[...new Set(unresolved)].join(', ')}`);
      zip.file(partPath, updatedXml);
    }
  }

  const outBlob = zip.generate({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    compression: 'DEFLATE',
  });

  const clientName = (
    replacementMap['(nombre)'] ||
    replacementMap['nombre'] ||
    'Cliente'
  ).replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]/g, '_');

  const safeTemplateName = template.name.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]/g, '_');
  const dateStamp = new Date().toISOString().split('T')[0];

  const finalFileName = (customDownloadFileName ? customDownloadFileName.replace(/[<>:"/\\|?*]/g, '_').replace(/\.docx$/i, '') + '.docx' : '') || `${safeTemplateName}_${clientName}_${dateStamp}.docx`;

  if (download) saveAs(outBlob, finalFileName);

  const sizeFormatted = (outBlob.size / 1024).toFixed(1) + ' KB';

  return {
    blob: outBlob,
    fileName: finalFileName,
    sizeFormatted,
  };
}

// Helpers
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
