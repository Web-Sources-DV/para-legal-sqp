import type { ExtractionResult } from "../types";
import { parseCalendarDate } from "./validation";
const latinDigits = (text: string) =>
  text.replace(/[٠-٩۰-۹]/g, (character) =>
    String(
      character.charCodeAt(0) -
        (character.charCodeAt(0) >= 0x6f0 ? 0x6f0 : 0x660),
    ),
  );
const fold = (text: string) =>
  latinDigits(text).normalize("NFD").replace(/\p{M}/gu, "").toUpperCase();
const labels = {
  fullName:
    "NOMBRE COMPLETO|APELLIDOS Y NOMBRES|NOMBRES Y APELLIDOS|FULL NAME|NOME COMPLETO|NOM COMPLET|姓名|氏名|ФИО|الاسم الكامل",
  lastName:
    "PRIMER APELLIDO|APELLIDOS?|SURNAMES?|FAMILY NAME|NOM DE FAMILLE|NOM|SOBRENOME|COGNOME|NACHNAME|ФАМИЛИЯ|اسم العائلة",
  firstName:
    "GIVEN NAMES?|FIRST NAMES?|PRENOMS?|VORNAMEN?|NOMBRES?|NOMES?|FORENAMES?|ИМЯ|الاسم",
  number:
    "PASSPORT (?:NO\.?|NUMBER)|DOCUMENT (?:NO\.?|NUMBER)|ID (?:NO\.?|NUMBER)|IDENTITY (?:NO\.?|NUMBER)|NUMERO (?:DE )?(?:IDENTIDAD|DOCUMENTO|CEDULA|PASAPORTE)|(?:CEDULA|PASAPORTE|DNI|NIE|CPF|RG|CURP|RUN|RUT|CUI|DPI|NUIP|C\\.C\\.)\s*(?:NO\.?|N[°º]?|NUMERO)?|DOCUMENTO N[°º]?|PERSONAL NUMBER|N[°º]\s*(?:DE )?(?:DOCUMENTO|PASAPORTE)|NUMERO DO DOCUMENTO|NUMERO DE PASSEPORT|PASSNUMMER|AUSWEISNUMMER|НОМЕР ПАСПОРТА|رقم الهوية|الرقم القومي|رقم الجواز",
  birth:
    "FECHA (?:DE )?NACIMIENTO|NACIMIENTO|DATE OF BIRTH|BIRTH DATE|DOB|DATA (?:DE )?NASCIMENTO|DATE DE NAISSANCE|GEBURTSDATUM|DATA DI NASCITA|ДАТА РОЖДЕНИЯ|出生日期|生年月日|تاريخ الميلاد",
  expiry:
    "FECHA (?:DE )?(?:VENCIMIENTO|CADUCIDAD|EXPIRACION)|VENCIMIENTO|CADUCIDAD|EXPIRACION|DATE OF EXPIRY|EXPIRY DATE|EXPIRATION DATE|DATE OF EXPIRATION|VALID UNTIL|VALID THRU|VALIDADE|DATA DE VALIDADE|DATE D.EXPIRATION|GUELTIG BIS|GULTIG BIS|SCADENZA|СРОК ДЕЙСТВИЯ|有效期至|有効期限|تاريخ الانتهاء",
  issue:
    "FECHA (?:DE )?(?:EMISION|EXPEDICION)|EMISION|EXPEDICION|DATE OF ISSUE|ISSUE DATE|DATA DE EMISSAO|DATE DE DELIVRANCE|AUSSTELLUNGSDATUM",
  sex: "SEXO|SEX|GENDER|SEXE|SESSO|GESCHLECHT|ПОЛ|性别|性別|الجنس",
  nationality:
    "NACIONALIDAD|NATIONALITY|NATIONALITE|NACIONALIDADE|STAATSANGEHOERIGKEIT|CITTADINANZA|ГРАЖДАНСТВО",
  birthPlace:
    "LUGAR (?:DE )?NACIMIENTO|PLACE OF BIRTH|LIEU DE NAISSANCE|LOCAL DE NASCIMENTO",
};
const allLabels = Object.values(labels).join("|");
function readLabel(
  lines: string[],
  pattern: string,
  accept: (value: string) => boolean = () => true,
): string {
  const regex = new RegExp(
    `(?:^|[^\\p{L}])(?:${pattern})(?=$|[^\\p{L}])`,
    "iu",
  );
  const boundary = new RegExp(
    `(?:^|[^\\p{L}])(?:${allLabels})(?=$|[^\\p{L}])`,
    "iu",
  );
  for (let i = 0; i < lines.length; i++) {
    if (
      pattern !== labels.fullName &&
      (pattern === labels.firstName || pattern === labels.lastName) &&
      new RegExp(labels.fullName, "iu").test(fold(lines[i]))
    )
      continue;
    const matched = regex.exec(fold(lines[i]));
    if (!matched) continue;
    let tail = lines[i]
      .slice(matched.index + matched[0].length)
      .replace(/^[\s:/.º°-]+/, "");
    // Skip translated labels before the value (SURNAME / APELLIDOS).
    for (let n = 0; n < 5; n++) {
      const next = new RegExp(`^(?:${allLabels})(?=$|[^\\p{L}])`, "iu").exec(
        fold(tail),
      );
      if (!next) break;
      tail = tail.slice(next[0].length).replace(/^[\s:/.º°-]+/, "");
    }
    if (tail) {
      const value = tail.split(boundary)[0].trim();
      if (accept(value)) return value;
      continue;
    }
    for (let j = i + 1; j < Math.min(lines.length, i + 3); j++) {
      if (boundary.test(fold(lines[j]))) break;
      if (lines[j].trim()) {
        if (accept(lines[j].trim())) return lines[j].trim();
        break;
      }
    }
  }
  return "";
}
const months: Record<string, number> = {
  JAN: 1,
  JANUARY: 1,
  ENE: 1,
  ENERO: 1,
  JANEIRO: 1,
  JANVIER: 1,
  FEB: 2,
  FEBRUARY: 2,
  FEBRERO: 2,
  FEV: 2,
  FEVRIER: 2,
  FEVEREIRO: 2,
  MAR: 3,
  MARCH: 3,
  MARZO: 3,
  MARS: 3,
  MARCO: 3,
  APR: 4,
  APRIL: 4,
  ABR: 4,
  ABRIL: 4,
  AVR: 4,
  AVRIL: 4,
  MAY: 5,
  MAYO: 5,
  MAI: 5,
  MAIO: 5,
  JUN: 6,
  JUNE: 6,
  JUNIO: 6,
  JUIN: 6,
  JUNHO: 6,
  JUL: 7,
  JULY: 7,
  JULIO: 7,
  JUIL: 7,
  JUILLET: 7,
  JULHO: 7,
  AUG: 8,
  AUGUST: 8,
  AGO: 8,
  AGOSTO: 8,
  AOUT: 8,
  SEP: 9,
  SEPT: 9,
  SEPTEMBER: 9,
  SEPTIEMBRE: 9,
  SET: 9,
  SETEMBRO: 9,
  SEPTEMBRE: 9,
  OCT: 10,
  OCTOBER: 10,
  OCTUBRE: 10,
  OUT: 10,
  OUTUBRO: 10,
  OCTOBRE: 10,
  NOV: 11,
  NOVEMBER: 11,
  NOVIEMBRE: 11,
  NOVEMBRE: 11,
  NOVEMBRO: 11,
  DEC: 12,
  DECEMBER: 12,
  DIC: 12,
  DICIEMBRE: 12,
  DEZ: 12,
  DEZEMBRO: 12,
  DECEMBRE: 12,
};
export function parsePrintedDate(text: string, monthFirst = false): string {
  const value = fold(text)
    .replace(/[年月]/g, "-")
    .replace(/日/g, "")
    .replace(/\bDE\b/g, " ")
    .replace(/,/g, " ")
    .trim();
  let match = value.match(/\b(\d{4})[-/.\s](\d{1,2})[-/.\s](\d{1,2})\b/);
  let year: number, month: number, day: number;
  if (match) [year, month, day] = match.slice(1).map(Number);
  else {
    match = value.match(/\b(\d{1,2})[-/.\s](\d{1,2})[-/.\s](\d{4})\b/);
    if (match) {
      year = Number(match[3]);
      month = Number(match[monthFirst ? 1 : 2]);
      day = Number(match[monthFirst ? 2 : 1]);
    } else {
      match = value.match(
        /\b(\d{1,2})[\s./-]+([A-Z]+)(?:\s*\/\s*[A-Z]+)?[\s./-]+(\d{4})\b/,
      );
      if (match) {
        day = Number(match[1]);
        month = months[match[2]];
        year = Number(match[3]);
      } else {
        match = value.match(/\b([A-Z]+)[\s./-]+(\d{1,2})[\s./-]+(\d{4})\b/);
        if (!match) return "";
        month = months[match[1]];
        day = Number(match[2]);
        year = Number(match[3]);
      }
    }
  }
  const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return parseCalendarDate(iso) ? iso : "";
}
export function parseInternationalDocumentText(
  rawText: string,
): Partial<ExtractionResult> {
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const upper = fold(rawText);
  const result: Partial<ExtractionResult> = {};
  if (
    /PASAPORTE|PASSPORT|PASSEPORT|PASSAPORTE|REISEPASS|PASSAPORTO|ПАСПОРТ|جواز السفر/.test(
      upper,
    )
  )
    result.docType = "pasaporte";
  else if (/\bNIE\b|EXTRANJER/.test(upper)) result.docType = "nie";
  else if (/\bDNI\b|DOCUMENTO NACIONAL/.test(upper)) result.docType = "dni";
  else if (
    /CEDULA|IDENTITY CARD|IDENTIFICATION CARD|CARTE D.IDENTITE|BILHETE DE IDENTIDADE|PERSONALAUSWEIS|CARTA D.IDENTITA|CARNET|CREDENCIAL PARA VOTAR|TARJETA DE IDENTIDAD|DOCUMENTO DE IDENTIDAD|DOCUMENTO PERSONAL DE IDENTIFICACION|CARTAO DE CIDADAO|بطاقة الهوية/.test(
      upper,
    )
  )
    result.docType = "cedula";
  const countries: [RegExp, string][] = [
    [/PANAMA/, "PANAMÁ"],
    [/COLOMBIA/, "COLOMBIA"],
    [/VENEZUELA/, "VENEZUELA"],
    [/MEXICO/, "MÉXICO"],
    [/PERU\b/, "PERÚ"],
    [/ESPANA|ESPAÑA/, "ESPAÑA"],
    [/UNITED STATES|ESTADOS UNIDOS/, "ESTADOS UNIDOS"],
    [/BRASIL|BRAZIL/, "BRASIL"],
    [/FRANCE|FRANCA|FRANCIA/, "FRANCIA"],
    [/DEUTSCHLAND|GERMANY|ALEMANIA/, "ALEMANIA"],
    [/PORTUGAL/, "PORTUGAL"],
    [/ITALIA|ITALY/, "ITALIA"],
    [/CANADA/, "CANADÁ"],
  ];
  const header = fold(lines.slice(0, 5).join("\n"));
  result.issuingCountry =
    countries.find(([pattern]) => pattern.test(header))?.[1] || "";
  const number = latinDigits(
    readLabel(lines, labels.number, (value) => /\d/.test(latinDigits(value))),
  )
    .match(/[A-Z0-9][A-Z0-9 .-]{3,24}/i)?.[0]
    ?.trim();
  if (number && /\d/.test(number) && !parsePrintedDate(number))
    result.passportNumber = number.replace(/[ .]/g, "").toUpperCase();
  if (result.docType !== "pasaporte") {
    const pan = upper.match(/\b(?:\d{1,2}|PE|E|\d{1,2}AV)-\d{1,4}-\d{1,6}\b/);
    if (pan && (result.issuingCountry === "PANAMÁ" || /CEDULA/.test(upper))) {
      result.passportNumber ||= pan[0];
      result.issuingCountry ||= "PANAMÁ";
      result.docType ||= "cedula";
    }
    const dni = upper.match(/\b(?:[XYZ]\d{7}|\d{8})[A-Z]\b/);
    if (
      dni &&
      (result.issuingCountry === "ESPAÑA" || /\bDNI\b|\bNIE\b/.test(upper))
    ) {
      result.passportNumber ||= dni[0];
      result.docType ||= /^[XYZ]/.test(dni[0]) ? "nie" : "dni";
    }
    const ven = upper.match(/\b[VE]-\d{6,9}\b/);
    if (ven && result.issuingCountry === "VENEZUELA")
      result.passportNumber ||= ven[0];
  }
  const cleanName = (text: string) =>
    text
      .replace(/[^\p{L}\p{M}'’\- ]/gu, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toUpperCase();
  result.fullName = cleanName(readLabel(lines, labels.fullName));
  result.firstName = cleanName(readLabel(lines, labels.firstName));
  result.lastName = cleanName(readLabel(lines, labels.lastName));
  if (result.fullName) {
    // A full-name label is not a given-name label. Do not guess how to split compound names.
    if (!result.lastName) result.firstName = result.fullName;
  } else
    result.fullName = [result.firstName, result.lastName]
      .filter(Boolean)
      .join(" ");
  const monthFirst = result.issuingCountry === "ESTADOS UNIDOS";
  result.birthDate = parsePrintedDate(
    readLabel(
      lines,
      labels.birth,
      (value) => !!parsePrintedDate(value, monthFirst),
    ),
    monthFirst,
  );
  result.expiryDate = parsePrintedDate(
    readLabel(
      lines,
      labels.expiry,
      (value) => !!parsePrintedDate(value, monthFirst),
    ),
    monthFirst,
  );
  result.issueDate = parsePrintedDate(
    readLabel(
      lines,
      labels.issue,
      (value) => !!parsePrintedDate(value, monthFirst),
    ),
    monthFirst,
  );
  const sex = fold(readLabel(lines, labels.sex)).split(/[\s/]+/)[0];
  result.sex = /^(M|MALE|MASCULINO|H|HOMBRE|VARON|HOMME|MANN|МУЖ|男|ذكر)$/.test(
    sex,
  )
    ? "M"
    : /^(F|FEMALE|FEMENINO|MUJER|FEMME|WEIBLICH|ЖЕН|女|أنثى)$/.test(sex)
      ? "F"
      : /^(X|OTHER|UNSPECIFIED|INDETERMINADO)$/.test(sex)
        ? "X"
        : "";
  const nationality = readLabel(lines, labels.nationality).toUpperCase();
  if (nationality) result.nationality = nationality;
  result.placeOfBirth = readLabel(lines, labels.birthPlace).toUpperCase();
  return result;
}
