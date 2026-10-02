import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import saveAs from 'file-saver';
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
export async function parseDocxFile(
  fileBuffer: ArrayBuffer,
  fileName: string
): Promise<{
  placeholders: string[];
  placeholderDefs: PlaceholderDef[];
  fileBase64: string;
}> {
  const uint8 = new Uint8Array(fileBuffer);
  const zip = new PizZip(uint8);

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
      const sglMatches = text.match(/\{([^{}]+)\}/g);
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

    // Also do fallback check on whole cleaned XML for split words
    const strippedXml = xmlContent.replace(/<[^>]+>/g, '');
    for (const kw of coreKeywords) {
      if (strippedXml.toLowerCase().includes(`(${kw.toLowerCase()})`)) {
        rawTagsSet.add(`(${kw})`);
      }
      if (strippedXml.toLowerCase().includes(`{{${kw.toLowerCase()}}}`)) {
        rawTagsSet.add(`{{${kw}}}`);
      }
      if (strippedXml.toLowerCase().includes(`{${kw.toLowerCase()}}`)) {
        rawTagsSet.add(`{${kw}}`);
      }
      if (strippedXml.toLowerCase().includes(`[${kw.toLowerCase()}]`)) {
        rawTagsSet.add(`[${kw}]`);
      }
    }
  }

  // Ensure mandatory 4 fields are always easily recognizable if present in any form
  const placeholders = Array.from(rawTagsSet);

  // If no placeholders detected at all, suggest the standard default 4 placeholders
  if (placeholders.length === 0) {
    placeholders.push('(nombre)', '(numero de identidad)', '(nacionalidad)', '(cedula/pasaporte)');
  }

  const placeholderDefs: PlaceholderDef[] = placeholders.map((key) => {
    return inferPlaceholderDef(key);
  });

  const fileBase64 = uint8ArrayToBase64(uint8);

  return {
    placeholders,
    placeholderDefs,
    fileBase64,
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
    defaultValue = new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
  }
  // 11. Ciudad
  else if (cleanKey.includes('ciudad') || cleanKey.includes('city') || cleanKey.includes('lugar')) {
    label = label || 'Ciudad';
    category = 'fechas';
    defaultValue = 'Madrid';
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
    defaultValue = 'VARÓN';
  }
  // 13. Sexo simple / Género (Varón, Mujer, Joven, Menor)
  else if (cleanKey.includes('sexo') || cleanKey.includes('genero') || cleanKey.includes('gender')) {
    label = 'Condición / Sexo (Varón, Mujer, Joven, Menor)';
    category = 'pasaporte';
    type = 'select';
    options = ['VARÓN', 'MUJER', 'JOVEN', 'MENOR'];
    defaultValue = 'VARÓN';
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
  const str = birthDateStr.trim();

  let birth: Date | null = null;

  // Try ISO YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = str.match(/^(\d{4})[-\/\.](\d{1,2})[-\/\.](\d{1,2})/);
  if (isoMatch) {
    birth = new Date(parseInt(isoMatch[1], 10), parseInt(isoMatch[2], 10) - 1, parseInt(isoMatch[3], 10));
  } else {
    // Try DD/MM/YYYY or DD-MM-YYYY
    const dmyMatch = str.match(/^(\d{1,2})[-\/\.](\d{1,2})[-\/\.](\d{4})/);
    if (dmyMatch) {
      birth = new Date(parseInt(dmyMatch[3], 10), parseInt(dmyMatch[2], 10) - 1, parseInt(dmyMatch[1], 10));
    } else {
      // Try generic Date.parse
      const parsed = Date.parse(str);
      if (!isNaN(parsed)) {
        birth = new Date(parsed);
      }
    }
  }

  if (!birth || isNaN(birth.getTime())) return null;

  let age = refDate.getFullYear() - birth.getFullYear();
  const m = refDate.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && refDate.getDate() < birth.getDate())) {
    age--;
  }
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
  const normalizedSex = (sex || 'M').trim().toUpperCase();
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

  // Fallback si no hay fecha de nacimiento registrada
  const fallbackCat = isFemale ? 'MUJER' : 'VARÓN';
  return {
    category: fallbackCat,
    age: null,
    explanation: `Sin fecha de nacimiento ➔ Asignado según condición: ${fallbackCat}`,
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

  // Extract base values - formatted according to uppercase/lowercase rules
  const rawFullName = (
    data['(nombre)'] ||
    data['nombre'] ||
    data['nombre_completo'] ||
    data['(nombre_completo)'] ||
    data['nombre completo'] ||
    data['(nombre completo)'] ||
    data['{{nombre}}'] ||
    data['{{nombre_completo}}'] ||
    client?.fullName ||
    (client ? `${client.firstName} ${client.lastName}` : '') ||
    'CLIENTE IDENTIFICADO'
  ).toString().trim();
  const fullName = rawFullName.toUpperCase();

  const rawPassportNumber = (
    data['(numero de identidad)'] ||
    data['(número de identidad)'] ||
    data['numero de identidad'] ||
    data['número de identidad'] ||
    data['(numero_identidad)'] ||
    data['(número_identidad)'] ||
    data['numero_identidad'] ||
    data['número_identidad'] ||
    data['(identidad)'] ||
    data['identidad'] ||
    data['(número de pasaporte)'] ||
    data['(numero de pasaporte)'] ||
    data['número de pasaporte'] ||
    data['numero de pasaporte'] ||
    data['numero_pasaporte'] ||
    data['(numero_pasaporte)'] ||
    data['(pasaporte)'] ||
    data['pasaporte'] ||
    data['{{numero de identidad}}'] ||
    data['{{número de identidad}}'] ||
    data['{{numero_identidad}}'] ||
    data['{{numero_pasaporte}}'] ||
    data['{{pasaporte}}'] ||
    client?.passportNumber ||
    client?.personalNumber ||
    ''
  ).toString().trim();
  const passportNumber = rawPassportNumber.toUpperCase();

  // EXCEPTION: Nationality is maintained in lowercase (minúsculas)
  const rawNationality = (
    data['(nacionalidad)'] ||
    data['nacionalidad'] ||
    data['{{nacionalidad}}'] ||
    client?.nationality ||
    ''
  ).toString().trim();
  const nationality = rawNationality.toLowerCase();

  // Document type: "Cédula" or "Pasaporte"
  let docTypeVal = (
    data['(cedula/pasaporte)'] ||
    data['(cédula/pasaporte)'] ||
    data['cedula/pasaporte'] ||
    data['cédula/pasaporte'] ||
    data['cedula_pasaporte'] ||
    data['(cedula_pasaporte)'] ||
    data['tipo_documento'] ||
    data['(tipo_documento)'] ||
    data['tipo de documento'] ||
    data['{{cedula/pasaporte}}'] ||
    data['{{tipo_documento}}'] ||
    (client?.docType === 'cedula' ? 'Cédula' : 'Pasaporte')
  ).toString().trim();

  if (!docTypeVal) {
    docTypeVal = client?.docType === 'cedula' ? 'Cédula' : 'Pasaporte';
  }
  docTypeVal = docTypeVal.toUpperCase();

  const rawBirthDate = (
    data['(fecha_nacimiento)'] ||
    data['fecha_nacimiento'] ||
    data['(fecha de nacimiento)'] ||
    data['fecha de nacimiento'] ||
    client?.birthDate ||
    ''
  ).toString().trim();
  const birthDate = rawBirthDate.toUpperCase();

  const rawIssuingCountry = (
    data['(pais_emisor)'] ||
    data['pais_emisor'] ||
    data['(país emisor)'] ||
    data['país emisor'] ||
    client?.issuingCountry ||
    client?.nationality ||
    ''
  ).toString().trim();
  const issuingCountry = rawIssuingCountry.toUpperCase();

  const rawAddress = (
    data['(direccion)'] ||
    data['direccion'] ||
    data['(dirección)'] ||
    data['dirección'] ||
    data['(domicilio)'] ||
    data['domicilio'] ||
    client?.address ||
    ''
  ).toString().trim();
  const address = rawAddress.toUpperCase();

  const rawPhone = (
    data['(telefono)'] ||
    data['telefono'] ||
    data['(teléfono)'] ||
    data['teléfono'] ||
    client?.phone ||
    ''
  ).toString().trim();
  const phone = rawPhone.toUpperCase();

  const rawEmail = (
    data['(email)'] ||
    data['email'] ||
    data['(correo)'] ||
    data['correo'] ||
    client?.email ||
    ''
  ).toString().trim();
  const email = rawEmail.toUpperCase();

  const rawCity = (
    data['(ciudad_firma)'] ||
    data['ciudad_firma'] ||
    data['(ciudad)'] ||
    data['ciudad'] ||
    client?.city ||
    'Madrid'
  ).toString().trim();
  const city = rawCity.toUpperCase();

  const formattedToday = new Date().toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const rawDateVal = (
    data['(fecha_firma)'] ||
    data['fecha_firma'] ||
    data['(fecha)'] ||
    data['fecha'] ||
    formattedToday
  ).toString().trim();
  const dateVal = rawDateVal.toUpperCase();

  // 5. (sexo) y (sexo/edad) / Condición Legal: VARÓN, MUJER, JOVEN o MENOR (nunca masculino/femenino)
  let explicitSexAge = (
    data['(sexo/edad)'] ||
    data['(sexo / edad)'] ||
    data['(SEXO/EDAD)'] ||
    data['(SEXO / EDAD)'] ||
    data['(Sexo/Edad)'] ||
    data['(sexo_edad)'] ||
    data['(SEXO_EDAD)'] ||
    data['(sexo-edad)'] ||
    data['(condicion)'] ||
    data['(condición)'] ||
    data['(CONDICION)'] ||
    data['(CONDICIÓN)'] ||
    data['(edad/sexo)'] ||
    data['(EDAD/SEXO)'] ||
    data['sexo/edad'] ||
    data['sexo / edad'] ||
    data['sexo_edad'] ||
    data['condicion'] ||
    data['condición'] ||
    data['{{sexo/edad}}'] ||
    data['{{sexo_edad}}'] ||
    data['{{condicion}}'] ||
    data['[sexo/edad]'] ||
    data['(sexo)'] ||
    data['sexo'] ||
    data['(genero)'] ||
    data['genero'] ||
    client?.sexAgeCategory ||
    ''
  ).toString().trim();

  let normalizedSexCategory = '';
  const upperExplicit = explicitSexAge.toUpperCase();
  if (['VARÓN', 'MUJER', 'JOVEN', 'MENOR', 'VARON'].includes(upperExplicit)) {
    normalizedSexCategory = upperExplicit === 'VARON' ? 'VARÓN' : upperExplicit;
  } else {
    const determined = determineSexAgeCategory(
      client?.birthDate || data['(fecha_nacimiento)'] || data['fecha_nacimiento'],
      client?.sex || data['(sexo)'] || data['sexo']
    );
    normalizedSexCategory = determined.category;
  }
  const sexAgeVal = normalizedSexCategory.toUpperCase();
  const sex = sexAgeVal; // En (sexo) se coloca estrictamente VARÓN, MUJER, JOVEN o MENOR

  // Populate all user-defined values from data with casing rules applied
  Object.keys(data).forEach((key) => {
    if (data[key] !== undefined && data[key] !== null) {
      const isNat = isNationalityKey(key);
      const val = isNat
        ? String(data[key]).trim().toLowerCase()
        : String(data[key]).trim().toUpperCase();
      const bareKey = key.replace(/^[\({<\[]+|[\)}>\]]+$/g, '').trim();
      if (bareKey) {
        map[`(${bareKey})`] = val;
        map[`(${bareKey.toLowerCase()})`] = val;
        map[`(${bareKey.toUpperCase()})`] = val;
        map[`{{${bareKey}}}`] = val;
        map[`{${bareKey}}`] = val;
        map[`[${bareKey}]`] = val;
      }
      if (key.startsWith('(') && key.endsWith(')')) {
        map[key] = val;
      }
    }
  });

  // 1. (nombre) / Full Name Aliases - STRICTLY DELIMITED ONLY
  [
    '(nombre)',
    '(NOMBRE)',
    '(Nombre)',
    '(nombre_completo)',
    '(NOMBRE_COMPLETO)',
    '(Nombre_Completo)',
    '(nombre completo)',
    '(NOMBRE COMPLETO)',
    '(Nombre Completo)',
    '(cliente)',
    '(CLIENTE)',
    '(Cliente)',
    '(fullName)',
    '(fullname)',
    '(FULLNAME)',
    '{{nombre}}',
    '{{NOMBRE}}',
    '{{nombre_completo}}',
    '{{nombre completo}}',
    '{nombre}',
    '{nombre_completo}',
    '[nombre]',
    '[NOMBRE]',
    '[nombre_completo]',
  ].forEach((k) => {
    map[k] = fullName;
  });

  // 2. (numero de identidad) / (número de pasaporte) / Identity Number Aliases - STRICTLY DELIMITED ONLY
  [
    '(numero de identidad)',
    '(NUMERO DE IDENTIDAD)',
    '(Numero de Identidad)',
    '(número de identidad)',
    '(NÚMERO DE IDENTIDAD)',
    '(Número de Identidad)',
    '(numero_identidad)',
    '(NUMERO_IDENTIDAD)',
    '(número_identidad)',
    '(NÚMERO_IDENTIDAD)',
    '(identidad)',
    '(IDENTIDAD)',
    '(Identidad)',
    '(cedula)',
    '(CÉDULA)',
    '(cédula)',
    '(CEDULA)',
    '(número de pasaporte)',
    '(NÚMERO DE PASAPORTE)',
    '(Número de Pasaporte)',
    '(numero de pasaporte)',
    '(NUMERO DE PASAPORTE)',
    '(Numero de Pasaporte)',
    '(numero_pasaporte)',
    '(NUMERO_PASAPORTE)',
    '(número_pasaporte)',
    '(NÚMERO_PASAPORTE)',
    '(pasaporte)',
    '(PASAPORTE)',
    '(Pasaporte)',
    '(passportNumber)',
    '(passport_number)',
    '(passport)',
    '(PASSPORT)',
    '(documento)',
    '(DOCUMENTO)',
    '(Documento)',
    '(numero_documento)',
    '(número_documento)',
    '(numero de documento)',
    '(número de documento)',
    '(NÚMERO DE DOCUMENTO)',
    '{{numero de identidad}}',
    '{{número de identidad}}',
    '{{NUMERO DE IDENTIDAD}}',
    '{{NÚMERO DE IDENTIDAD}}',
    '{{numero_identidad}}',
    '{{identidad}}',
    '{{número de pasaporte}}',
    '{{numero de pasaporte}}',
    '{{NUMERO DE PASAPORTE}}',
    '{{pasaporte}}',
    '{{PASAPORTE}}',
    '{{numero_pasaporte}}',
    '{numero de identidad}',
    '{número de identidad}',
    '{identidad}',
    '{número de pasaporte}',
    '{numero de pasaporte}',
    '{pasaporte}',
    '[numero de identidad]',
    '[número de identidad]',
    '[NUMERO DE IDENTIDAD]',
    '[identidad]',
    '[número de pasaporte]',
    '[numero de pasaporte]',
    '[pasaporte]',
    '[PASAPORTE]',
  ].forEach((k) => {
    map[k] = passportNumber;
  });

  // 3. (nacionalidad) / Nationality Aliases - STRICTLY DELIMITED ONLY
  [
    '(nacionalidad)',
    '(NACIONALIDAD)',
    '(Nacionalidad)',
    '(nationality)',
    '(NATIONALITY)',
    '(país_origen)',
    '(pais_origen)',
    '(PAÍS_ORIGEN)',
    '{{nacionalidad}}',
    '{{NACIONALIDAD}}',
    '{nacionalidad}',
    '[nacionalidad]',
    '[NACIONALIDAD]',
  ].forEach((k) => {
    map[k] = nationality;
  });

  // 4. (cedula/pasaporte) / Document Type Aliases - STRICTLY DELIMITED ONLY
  [
    '(cedula/pasaporte)',
    '(cédula/pasaporte)',
    '(CEDULA/PASAPORTE)',
    '(CÉDULA/PASAPORTE)',
    '(Cedula/Pasaporte)',
    '(Cédula/Pasaporte)',
    '(cedula / pasaporte)',
    '(cédula / pasaporte)',
    '(CEDULA / PASAPORTE)',
    '(CÉDULA / PASAPORTE)',
    '(cedula_pasaporte)',
    '(cédula_pasaporte)',
    '(CEDULA_PASAPORTE)',
    '(CÉDULA_PASAPORTE)',
    '(tipo_documento)',
    '(TIPO_DOCUMENTO)',
    '(tipo de documento)',
    '(TIPO DE DOCUMENTO)',
    '(Tipo de Documento)',
    '(tipo documento)',
    '(TIPO DOCUMENTO)',
    '(document_type)',
    '{{cedula/pasaporte}}',
    '{{cédula/pasaporte}}',
    '{{tipo_documento}}',
    '{cedula/pasaporte}',
    '{cédula/pasaporte}',
    '{tipo_documento}',
    '[cedula/pasaporte]',
    '[cédula/pasaporte]',
    '[tipo_documento]',
  ].forEach((k) => {
    map[k] = docTypeVal;
  });

  // Additional standard helpers - STRICTLY DELIMITED ONLY
  [
    '(fecha_nacimiento)',
    '(FECHA_NACIMIENTO)',
    '(fecha de nacimiento)',
    '(FECHA DE NACIMIENTO)',
    '(nacimiento)',
    '(NACIMIENTO)',
    '{{fecha_nacimiento}}',
    '{fecha_nacimiento}',
    '[fecha_nacimiento]',
  ].forEach((k) => {
    map[k] = birthDate;
  });

  [
    '(pais_emisor)',
    '(PAIS_EMISOR)',
    '(país emisor)',
    '(PAÍS EMISOR)',
    '(pais)',
    '(país)',
    '(PAÍS)',
    '{{pais_emisor}}',
    '{pais_emisor}',
    '[pais_emisor]',
  ].forEach((k) => {
    map[k] = issuingCountry;
  });

  [
    '(direccion)',
    '(dirección)',
    '(DIRECCION)',
    '(DIRECCIÓN)',
    '(domicilio)',
    '(DOMICILIO)',
    '{{direccion}}',
    '{{dirección}}',
    '{direccion}',
    '[direccion]',
    '[dirección]',
  ].forEach((k) => {
    map[k] = address;
  });

  [
    '(telefono)',
    '(teléfono)',
    '(TELEFONO)',
    '(TELÉFONO)',
    '(movil)',
    '(móvil)',
    '(MÓVIL)',
    '{{telefono}}',
    '{{teléfono}}',
    '{telefono}',
    '[telefono]',
    '[teléfono]',
  ].forEach((k) => {
    map[k] = phone;
  });

  [
    '(email)',
    '(EMAIL)',
    '(correo)',
    '(CORREO)',
    '(correo_electronico)',
    '(correo electrónico)',
    '(CORREO ELECTRÓNICO)',
    '{{email}}',
    '{{correo}}',
    '{email}',
    '[email]',
    '[correo]',
  ].forEach((k) => {
    map[k] = email;
  });

  [
    '(ciudad_firma)',
    '(CIUDAD_FIRMA)',
    '(ciudad)',
    '(CIUDAD)',
    '(lugar)',
    '(LUGAR)',
    '{{ciudad_firma}}',
    '{ciudad_firma}',
    '[ciudad_firma]',
  ].forEach((k) => {
    map[k] = city;
  });

  [
    '(fecha_firma)',
    '(FECHA_FIRMA)',
    '(fecha)',
    '(FECHA)',
    '(fecha_hoy)',
    '(FECHA_HOY)',
    '(fecha_solicitud)',
    '(FECHA_SOLICITUD)',
    '{{fecha_firma}}',
    '{fecha_firma}',
    '[fecha_firma]',
  ].forEach((k) => {
    map[k] = dateVal;
  });

  [
    '(sexo)',
    '(SEXO)',
    '(genero)',
    '(género)',
    '(GÉNERO)',
    '{{sexo}}',
    '{sexo}',
    '[sexo]',
  ].forEach((k) => {
    map[k] = sex;
  });

  // 13. (sexo/edad) / Condición Legal / Edad y Sexo - STRICTLY DELIMITED ONLY
  [
    '(sexo/edad)',
    '(SEXO/EDAD)',
    '(Sexo/Edad)',
    '(sexo / edad)',
    '(SEXO / EDAD)',
    '(sexo_edad)',
    '(SEXO_EDAD)',
    '(sexo-edad)',
    '(condicion)',
    '(condición)',
    '(CONDICION)',
    '(CONDICIÓN)',
    '(Condicion)',
    '(Condición)',
    '(edad/sexo)',
    '(EDAD/SEXO)',
    '(edad_sexo)',
    '{{sexo/edad}}',
    '{{sexo_edad}}',
    '{{condicion}}',
    '{{condición}}',
    '{sexo/edad}',
    '{sexo_edad}',
    '{condicion}',
    '[sexo/edad]',
    '[sexo_edad]',
    '[condicion]',
    '[condición]',
    '[SEXO/EDAD]',
  ].forEach((k) => {
    map[k] = sexAgeVal;
  });

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
function replaceTokensInWordXml(xml: string, replacementMap: Record<string, string>): string {
  // Filter to ONLY enclosed keys (starting and ending with delimiters)
  const enclosedKeys = Object.keys(replacementMap).filter((k) => {
    const t = k.trim();
    return (
      (t.startsWith('(') && t.endsWith(')')) ||
      (t.startsWith('{{') && t.endsWith('}}')) ||
      (t.startsWith('{') && t.endsWith('}')) ||
      (t.startsWith('[') && t.endsWith(']'))
    );
  });

  // Sort keys by length descending so longer tokens like (número de pasaporte) replace before (pasaporte)
  const sortedKeys = enclosedKeys.sort((a, b) => b.length - a.length);

  return xml.replace(/<w:p\b([^>]*)>([\s\S]*?)<\/w:p>/gi, (fullParagraph, pAttrs, pInner) => {
    // Parse individual runs to preserve each run's distinct formatting (<w:rPr> including bold, font, etc.)
    const parsedRuns: ParsedRun[] = [];
    const rRegex = /<w:r\b[^>]*>([\s\S]*?)<\/w:r>/gi;
    let rMatch;
    let runningCharIndex = 0;
    let combinedText = '';

    while ((rMatch = rRegex.exec(pInner)) !== null) {
      const rInner = rMatch[1];
      const rPrMatch = rInner.match(/<w:rPr\b[^>]*>[\s\S]*?<\/w:rPr>/i);
      const rPr = rPrMatch ? rPrMatch[0] : '';

      const tInsideRegex = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>/gi;
      let tInsideMatch;
      let runText = '';
      while ((tInsideMatch = tInsideRegex.exec(rInner)) !== null) {
        runText += tInsideMatch[1];
      }

      if (runText.length > 0) {
        parsedRuns.push({
          rPr,
          text: runText,
          startIndex: runningCharIndex,
          endIndex: runningCharIndex + runText.length,
        });
        runningCharIndex += runText.length;
        combinedText += runText;
      }
    }

    // Fallback if runs weren't standard but <w:t> exists
    if (parsedRuns.length === 0) {
      const tRegex = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>/gi;
      let tMatch;
      while ((tMatch = tRegex.exec(pInner)) !== null) {
        combinedText += tMatch[1];
      }
      if (!combinedText) return fullParagraph;
      parsedRuns.push({
        rPr: '',
        text: combinedText,
        startIndex: 0,
        endIndex: combinedText.length,
      });
    }

    // Extract paragraph properties <w:pPr> if present
    const pPrMatch = pInner.match(/<w:pPr\b[^>]*>[\s\S]*?<\/w:pPr>/i);
    const pPrXml = pPrMatch ? pPrMatch[0] : '';

    // Extract base run properties <w:rPr> from the paragraph if present
    let baseRPr = parsedRuns[0]?.rPr || '';
    if (!baseRPr && pPrXml) {
      const rPrInPPr = pPrXml.match(/<w:rPr\b[^>]*>[\s\S]*?<\/w:rPr>/i);
      if (rPrInPPr && rPrInPPr[0]) {
        baseRPr = rPrInPPr[0];
      }
    }

    interface MatchOccurrence {
      start: number;
      end: number;
      rawMatch: string;
      replacementVal: string;
      isNationality: boolean;
    }

    const matches: MatchOccurrence[] = [];

    // 1. Direct key search
    for (const key of sortedKeys) {
      const escapedKey = key.replace(/[.*+?^${}()|[\]\/\\]/g, '\\$&');
      const reg = new RegExp(escapedKey, 'g');
      let m;
      while ((m = reg.exec(combinedText)) !== null) {
        const isNat = isNationalityKey(key);
        matches.push({
          start: m.index,
          end: m.index + m[0].length,
          rawMatch: m[0],
          replacementVal: isNat ? replacementMap[key].toLowerCase() : replacementMap[key].toUpperCase(),
          isNationality: isNat,
        });
      }
    }

    // 2. Flexible internal spacing search for parentheses e.g. ( nombre ) or ( número de pasaporte )
    for (const key of sortedKeys) {
      if (key.startsWith('(') && key.endsWith(')')) {
        const inner = key.slice(1, -1).trim();
        const escapedInner = inner.replace(/[.*+?^${}()|[\]\/\\]/g, '\\$&');
        const parenRegex = new RegExp(`\\(\\s*${escapedInner}\\s*\\)`, 'gi');
        let m;
        while ((m = parenRegex.exec(combinedText)) !== null) {
          const isNat = isNationalityKey(key);
          matches.push({
            start: m.index,
            end: m.index + m[0].length,
            rawMatch: m[0],
            replacementVal: isNat ? replacementMap[key].toLowerCase() : replacementMap[key].toUpperCase(),
            isNationality: isNat,
          });
        }
      }
    }

    if (matches.length === 0) {
      return fullParagraph;
    }

    // Sort matches by start position ascending, and longer length first if same start
    matches.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));

    // Remove overlapping matches
    const filteredMatches: MatchOccurrence[] = [];
    let lastEnd = -1;
    for (const m of matches) {
      if (m.start >= lastEnd) {
        filteredMatches.push(m);
        lastEnd = m.end;
      }
    }

    if (filteredMatches.length === 0) {
      return fullParagraph;
    }

    // Build replacement runs preserving the exact original run styles for all un-replaced text
    let newRunsXml = '';
    let curIndex = 0;

    for (const m of filteredMatches) {
      // Preceding plain text - slices original runs to preserve any pre-existing bold or styling
      if (m.start > curIndex) {
        newRunsXml += sliceOriginalRunsToXml(parsedRuns, curIndex, m.start, baseRPr);
      }

      // Find host run where this token replacement starts to inherit its font / base attributes
      const hostRun = parsedRuns.find((r) => r.startIndex <= m.start && m.start < r.endIndex) || parsedRuns[0];
      const hostRPr = hostRun ? hostRun.rPr : baseRPr;

      // Replaced token run
      if (m.isNationality) {
        // EXCEPTION: NATIONALITY must be in lowercase and NOT bold
        newRunsXml += `<w:r>${makeNotBoldRPr(hostRPr)}<w:t xml:space="preserve">${xmlEscape(m.replacementVal)}</w:t></w:r>`;
      } else {
        // ALL OTHER REPLACEMENTS: must be in UPPERCASE and BOLD
        newRunsXml += `<w:r>${makeBoldRPr(hostRPr)}<w:t xml:space="preserve">${xmlEscape(m.replacementVal)}</w:t></w:r>`;
      }

      curIndex = m.end;
    }

    // Trailing plain text - slices original runs to preserve pre-existing styles
    if (curIndex < combinedText.length) {
      newRunsXml += sliceOriginalRunsToXml(parsedRuns, curIndex, combinedText.length, baseRPr);
    }

    // Construct the updated paragraph preserving pPr
    return `<w:p${pAttrs}>${pPrXml}${newRunsXml}</w:p>`;
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
  sigOptions?: SignatureLayoutOptions,
  replacementMap?: Record<string, string>,
  client?: Client | null
): string {
  const hasAcepto = /ACEPTO/i.test(xml);
  const hasOtorgo = /OTORGO/i.test(xml);

  if (!hasAcepto && !hasOtorgo) {
    return xml;
  }

  const lawyerTitle = (
    sigOptions?.lawyerSignatureTitle ||
    replacementMap?.['(abogado_nombre)'] ||
    replacementMap?.['abogado_nombre'] ||
    'LCDO. ANTONY NATHANAEL TALLA COPRIS'
  ).toUpperCase();

  const lawyerCedula = (
    sigOptions?.lawyerSignatureCedula ||
    replacementMap?.['(abogado_cedula)'] ||
    replacementMap?.['abogado_cedula'] ||
    'CÉDULA NO. 8-849-2485'
  ).toUpperCase();

  const lawyerIdoneidad = (
    sigOptions?.lawyerSignatureIdoneidad ||
    replacementMap?.['(abogado_idoneidad)'] ||
    replacementMap?.['abogado_idoneidad'] ||
    'IDONEIDAD 30553'
  ).toUpperCase();

  const rawClientName = (
    sigOptions?.clientSignatureName ||
    replacementMap?.['(nombre)'] ||
    replacementMap?.['nombre'] ||
    client?.fullName ||
    'CLIENTE IDENTIFICADO'
  ).toUpperCase();

  const docTypeLabel = client?.docType === 'cedula' ? 'CÉDULA No. ' : 'PASAPORTE No. ';
  const docNum = (
    client?.passportNumber ||
    client?.personalNumber ||
    replacementMap?.['(numero de identidad)'] ||
    ''
  ).toUpperCase();
  const rawClientDoc =
    sigOptions?.clientSignatureDoc || (docNum ? `${docTypeLabel}${docNum}` : 'PASAPORTE No. ');

  const blankLinesCount = Math.max(1, Math.min(5, sigOptions?.signatureBlankLines ?? 2));
  const useTable = sigOptions?.useTwoColumnTable !== false;

  // Offset default: 56% (matching Image 2)
  const offset = sigOptions?.columnOffsetPercent || 56;
  const totalWidthDxa = 9300;
  const col2WidthDxa = Math.round((totalWidthDxa * (100 - offset)) / 100);
  const col1WidthDxa = totalWidthDxa - col2WidthDxa;

  if (useTable) {
    let blankParagraphs = '';
    for (let i = 0; i < blankLinesCount; i++) {
      blankParagraphs += `<w:p><w:pPr><w:spacing w:after="160"/><w:rPr><w:sz w:val="22"/><w:szCs w:val="22"/><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/></w:rPr></w:pPr><w:r><w:rPr><w:sz w:val="22"/><w:szCs w:val="22"/><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/></w:rPr><w:t xml:space="preserve"> </w:t></w:r></w:p>`;
    }

    const tableXml = `<w:tbl>
  <w:tblPr>
    <w:tblW w:w="${totalWidthDxa}" w:type="dxa"/>
    <w:jc w:val="both"/>
    <w:tblBorders>
      <w:top w:val="none" w:sz="0" w:space="0" w:color="auto"/>
      <w:left w:val="none" w:sz="0" w:space="0" w:color="auto"/>
      <w:bottom w:val="none" w:sz="0" w:space="0" w:color="auto"/>
      <w:right w:val="none" w:sz="0" w:space="0" w:color="auto"/>
      <w:insideH w:val="none" w:sz="0" w:space="0" w:color="auto"/>
      <w:insideV w:val="none" w:sz="0" w:space="0" w:color="auto"/>
    </w:tblBorders>
    <w:tblCellMar>
      <w:top w:w="40" w:type="dxa"/>
      <w:left w:w="60" w:type="dxa"/>
      <w:bottom w:w="40" w:type="dxa"/>
      <w:right w:w="60" w:type="dxa"/>
    </w:tblCellMar>
  </w:tblPr>
  <w:tblGrid>
    <w:gridCol w:w="${col1WidthDxa}"/>
    <w:gridCol w:w="${col2WidthDxa}"/>
  </w:tblGrid>
  <w:tr>
    <w:tc>
      <w:tcPr>
        <w:tcW w:w="${col1WidthDxa}" w:type="dxa"/>
        <w:vAlign w:val="top"/>
      </w:tcPr>
      <w:p>
        <w:pPr><w:spacing w:after="240"/><w:rPr><w:b/><w:bCs/><w:sz w:val="22"/><w:szCs w:val="22"/><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/></w:rPr></w:pPr>
        <w:r><w:rPr><w:b/><w:bCs/><w:sz w:val="22"/><w:szCs w:val="22"/><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/></w:rPr><w:t>ACEPTO PODER</w:t></w:r>
      </w:p>
      ${blankParagraphs}
      <w:p>
        <w:pPr><w:spacing w:after="40"/><w:rPr><w:b/><w:bCs/><w:sz w:val="22"/><w:szCs w:val="22"/><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/></w:rPr></w:pPr>
        <w:r><w:rPr><w:b/><w:bCs/><w:sz w:val="22"/><w:szCs w:val="22"/><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/></w:rPr><w:t>${xmlEscape(lawyerTitle)}</w:t></w:r>
      </w:p>
      <w:p>
        <w:pPr><w:spacing w:after="40"/><w:rPr><w:b/><w:bCs/><w:sz w:val="22"/><w:szCs w:val="22"/><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/></w:rPr></w:pPr>
        <w:r><w:rPr><w:b/><w:bCs/><w:sz w:val="22"/><w:szCs w:val="22"/><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/></w:rPr><w:t>${xmlEscape(lawyerCedula)}</w:t></w:r>
      </w:p>
      ${lawyerIdoneidad ? `<w:p>
        <w:pPr><w:spacing w:after="40"/><w:rPr><w:b/><w:bCs/><w:sz w:val="22"/><w:szCs w:val="22"/><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/></w:rPr></w:pPr>
        <w:r><w:rPr><w:b/><w:bCs/><w:sz w:val="22"/><w:szCs w:val="22"/><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/></w:rPr><w:t>${xmlEscape(lawyerIdoneidad)}</w:t></w:r>
      </w:p>` : ''}
    </w:tc>
    <w:tc>
      <w:tcPr>
        <w:tcW w:w="${col2WidthDxa}" w:type="dxa"/>
        <w:vAlign w:val="top"/>
      </w:tcPr>
      <w:p>
        <w:pPr><w:spacing w:after="240"/><w:rPr><w:b/><w:bCs/><w:sz w:val="22"/><w:szCs w:val="22"/><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/></w:rPr></w:pPr>
        <w:r><w:rPr><w:b/><w:bCs/><w:sz w:val="22"/><w:szCs w:val="22"/><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/></w:rPr><w:t>OTORGO PODER:</w:t></w:r>
      </w:p>
      ${blankParagraphs}
      <w:p>
        <w:pPr><w:spacing w:after="40"/><w:rPr><w:b/><w:bCs/><w:sz w:val="22"/><w:szCs w:val="22"/><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/></w:rPr></w:pPr>
        <w:r><w:rPr><w:b/><w:bCs/><w:sz w:val="22"/><w:szCs w:val="22"/><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/></w:rPr><w:t>${xmlEscape(rawClientName)}</w:t></w:r>
      </w:p>
      <w:p>
        <w:pPr><w:spacing w:after="40"/><w:rPr><w:b/><w:bCs/><w:sz w:val="22"/><w:szCs w:val="22"/><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/></w:rPr></w:pPr>
        <w:r><w:rPr><w:b/><w:bCs/><w:sz w:val="22"/><w:szCs w:val="22"/><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/></w:rPr><w:t>${xmlEscape(rawClientDoc)}</w:t></w:r>
      </w:p>
    </w:tc>
  </w:tr>
</w:tbl>`;

    // Matches from paragraph containing ACEPTO PODER through the following signature paragraphs
    const sigBlockRegex = /<w:p\b[^>]*>(?:(?!<\/w:p>)[\s\S])*?ACEPTO[\s\S]*?<\/w:p>(?:[\s\S]*?<w:p\b[^>]*>(?:(?!<\/w:p>)[\s\S])*?(?:IDONEIDAD|PASAPORTE|C[EÉ]DULA|No\.\s*\d+)[\s\S]*?<\/w:p>)/i;

    if (sigBlockRegex.test(xml)) {
      return xml.replace(sigBlockRegex, tableXml);
    }
  }

  // Fallback or Tab-based: ensure every signature paragraph has an explicit tab stop and all runs are bold
  return xml.replace(/<w:p\b([^>]*)>([\s\S]*?)<\/w:p>/gi, (pFull, pAttrs, pInner) => {
    const isSigP = /ACEPTO|OTORGO|IDONEIDAD|PASAPORTE|CÉDULA|CEDULA/i.test(pInner);
    if (!isSigP) return pFull;

    let updatedPInner = pInner;

    // Enforce bold on all runs within signature paragraphs
    updatedPInner = updatedPInner.replace(/<w:r\b([^>]*)>([\s\S]*?)<\/w:r>/gi, (rFull, rAttrs, rInner) => {
      if (/<w:rPr\b[^>]*>/i.test(rInner)) {
        if (!/<w:b\b/i.test(rInner)) {
          return `<w:r${rAttrs}>${rInner.replace(/(<w:rPr\b[^>]*>)/i, '$1<w:b/><w:bCs/>')}</w:r>`;
        }
        return rFull;
      }
      return `<w:r${rAttrs}><w:rPr><w:b/><w:bCs/></w:rPr>${rInner}</w:r>`;
    });

    const tabStopXml = `<w:tabs><w:tab w:val="left" w:pos="5400"/></w:tabs>`;
    if (/<w:pPr\b[^>]*>/i.test(updatedPInner)) {
      if (!/<w:tabs\b/i.test(updatedPInner)) {
        updatedPInner = updatedPInner.replace(/(<w:pPr\b[^>]*>)/i, `$1${tabStopXml}`);
      }
    } else {
      updatedPInner = `<w:pPr>${tabStopXml}</w:pPr>${updatedPInner}`;
    }
    return `<w:p${pAttrs}>${updatedPInner}</w:p>`;
  });
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
  signatureOptions?: SignatureLayoutOptions
): Promise<{ blob: Blob; fileName: string; sizeFormatted: string }> {
  if (!template.fileData) {
    throw new Error('La plantilla seleccionada no contiene datos de archivo .docx válidos.');
  }

  const binaryString = atob(template.fileData);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const zip = new PizZip(bytes);

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
      zip.file(partPath, updatedXml);
    }
  }

  // 3. Fallback pass with Docxtemplater for any remaining {{tag}} or {tag} structures
  const docXmlAfterReplace = zip.file('word/document.xml')?.asText() || '';
  if (docXmlAfterReplace.includes('{{') || /\{[a-zA-Z0-9_]+\}/.test(docXmlAfterReplace)) {
    const hasDoubleBraces = docXmlAfterReplace.includes('{{');
    const delimiters = hasDoubleBraces
      ? { start: '{{', end: '}}' }
      : { start: '{', end: '}' };

    try {
      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
        delimiters,
        nullGetter: (part) => {
          const key = part.value;
          return replacementMap[key] || replacementMap[`(${key})`] || '';
        },
      });
      doc.render(replacementMap);
    } catch (docxTemplaterErr) {
      // If Docxtemplater encountered syntax quirks on custom user symbols,
      // direct XML replacement above has already handled the substitutions cleanly.
      console.warn('Docxtemplater optional pass warning (handled by direct XML replacer):', docxTemplaterErr);
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

  const finalFileName = customDownloadFileName || `${safeTemplateName}_${clientName}_${dateStamp}.docx`;

  saveAs(outBlob, finalFileName);

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
