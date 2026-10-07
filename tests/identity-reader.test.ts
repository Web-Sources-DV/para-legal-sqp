import { mergeIdentityReadings } from "../src/services/identityReadings";
import type { ExtractionResult } from "../src/types";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseVisualDocumentText,
  parseMRZ,
  buildStructuredDocumentJson,
} from "../src/services/ocrService";
import { parsePrintedDate } from "../src/services/documentTextParser";
import { evaluateIdentityDocument } from "../src/services/identityStatus";

test("multiline passport labels, accented compound names and named months", () => {
  const value = parseVisualDocumentText(
    "PASSPORT\nCANADA\nSurname / Nom de famille\nO’NEILL GARCÍA\nGiven names / Nombres\nANA MARÍA\nPassport No: AB1234567\nDate of birth: 09 OCT 2010\nSex: F\nDate of expiry: 08 OCT 2025",
  );
  assert.equal(value.passportNumber, "AB1234567");
  assert.equal(value.docType, "pasaporte");
  assert.equal(value.fullName, "ANA MARÍA O’NEILL GARCÍA");
  assert.equal(value.birthDate, "2010-10-09");
  assert.equal(value.expiryDate, "2025-10-08");
  assert.equal(value.sex, "F");
});
test("national identity cards retain their identity and fullname without guessing a surname split", () => {
  const value = parseVisualDocumentText(
    "REPÚBLICA DE COLOMBIA\nCÉDULA DE CIUDADANÍA\nNúmero de identidad: 1.020.345.678\nNombre completo: JUAN CARLOS PÉREZ GÓMEZ\nFecha de nacimiento: 15/06/2015\nSexo: M",
  );
  assert.equal(value.passportNumber, "1020345678");
  assert.equal(value.docType, "cedula");
  assert.equal(value.fullName, "JUAN CARLOS PÉREZ GÓMEZ");
  assert.equal(value.birthDate, "2015-06-15");
  assert.equal(value.expiryDate, "");
});
test("passport number matching never changes the document into a Spanish DNI", () => {
  const value = parseVisualDocumentText(
    "PASAPORTE\nESPAÑA\nPasaporte Nº: 12345678A\nApellidos: PÉREZ\nNombres: LUIS\nNacimiento: 2000-02-29",
  );
  assert.equal(value.docType, "pasaporte");
  assert.equal(value.passportNumber, "12345678A");
  assert.equal(value.fullName, "LUIS PÉREZ");
});
test("Portuguese, French and German labels", () => {
  for (const [text, birth, name] of [
    [
      "PASSAPORTE\nBRASIL\nNúmero do documento: FB1234567\nNome completo: MARIA DA SILVA\nData de nascimento: 12 DE MAIO DE 2001\nSexo: FEMININO",
      "2001-05-12",
      "MARIA DA SILVA",
    ],
    [
      "PASSEPORT\nFRANCE\nNuméro de passeport: FR1234567\nNom de famille: DUPONT\nPrénoms: ÉLODIE\nDate de naissance: 12/05/2001\nSexe: F",
      "2001-05-12",
      "ÉLODIE DUPONT",
    ],
    [
      "REISEPASS\nDEUTSCHLAND\nPassnummer: DE1234567\nNachname: MÜLLER\nVornamen: ANNA\nGeburtsdatum: 12.05.2001\nGeschlecht: F",
      "2001-05-12",
      "ANNA MÜLLER",
    ],
  ]) {
    const value = parseVisualDocumentText(text);
    assert.equal(value.birthDate, birth);
    assert.equal(value.fullName, name);
    assert.ok(value.passportNumber);
  }
});
test("dates reject impossible calendar values and honor US month-first convention", () => {
  assert.equal(parsePrintedDate("31/02/2001"), "");
  assert.equal(parsePrintedDate("12 AUG / AOUT 1974"), "1974-08-12");
  assert.equal(parsePrintedDate("05/12/2001", true), "2001-05-12");
  assert.equal(parsePrintedDate("05/12/2001"), "2001-12-05");
  const value = parseVisualDocumentText(
    "UNITED STATES OF AMERICA\nPASSPORT\nDate of birth: 05/12/2001",
  );
  assert.equal(value.birthDate, "2001-05-12");
});
test("expiration day and age use Panama date; minors do not require a guessed sex", () => {
  const now = new Date("2026-10-08T02:00:00Z");
  assert.deepEqual(
    evaluateIdentityDocument("2010-10-08", "2026-10-07", "", now),
    { age: 15, category: "JOVEN", isMinor: true, expiryStatus: "vigente" },
  );
  assert.equal(
    evaluateIdentityDocument("2015-01-01", "2026-10-06", "M", now).expiryStatus,
    "vencido",
  );
  assert.equal(
    evaluateIdentityDocument("2015-01-01", "", "", now).category,
    "MENOR",
  );
  assert.equal(
    evaluateIdentityDocument("", "", "", now).expiryStatus,
    "desconocido",
  );
  assert.equal(
    buildStructuredDocumentJson({
      birthDate: "2015-01-01",
      sex: "M",
      expiryDate: "2020-01-01",
    }).estado_documento,
    "vencido",
  );
});
test("MRZ numeric OCR confusions are repaired without changing alphanumeric passport numbers", () => {
  const value = parseMRZ(
    "P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<\nL898902C36UTO74O8I22F1204159ZE184226B<<<<<10",
  );
  assert.equal(value.birthDate, "1974-08-12");
  assert.equal(value.passportNumber, "L898902C3");
});

test("Arabic numerals and Chinese labeled identity fields", () => {
  assert.equal(parsePrintedDate("٢٠٠١/٠٥/١٢"), "2001-05-12");
  assert.equal(parsePrintedDate("2001年05月12日"), "2001-05-12");
  const value = parseVisualDocumentText(
    "姓名: 王小明\n出生日期: 2001年05月12日\n性别: 男",
  );
  assert.equal(value.fullName, "王小明");
  assert.equal(value.birthDate, "2001-05-12");
  assert.equal(value.sex, "M");
});

test("ICAO national ID TD1 preserves fields and validates checksums", () => {
  const result = parseMRZ(
    "I<UTOD231458907<<<<<<<<<<<<<<<\n7408122F1204159UTO<<<<<<<<<<<6\nERIKSSON<<ANNA<MARIA<<<<<<<<<<<",
  );
  assert.equal(result.passportNumber, "D23145890");
  assert.equal(result.birthDate, "1974-08-12");
  assert.equal(result.sex, "F");
  assert.equal(result.fullName, "ANNA MARIA ERIKSSON");
  assert.equal(result.docType, "cedula");
});

test("front and back fill missing fields, refresh age and reject another identity", () => {
  const front: ExtractionResult = {
    firstName: "ANA",
    lastName: "GOMEZ",
    fullName: "ANA GOMEZ",
    passportNumber: "TEST001",
    birthDate: "",
    expiryDate: "",
    sex: "",
    nationality: "",
    issuingCountry: "",
    docType: "cedula",
    method: "tesseract",
  };
  const birth = `${new Date().getUTCFullYear() - 15}-01-01`;
  const reverse = {
    ...front,
    birthDate: birth,
    sex: "F",
    expiryDate: "2024-01-01",
  };
  const merged = mergeIdentityReadings(front, reverse);
  assert.equal(merged.birthDate, birth);
  assert.equal(merged.sex, "F");
  assert.equal(merged.sexAgeCategory, "JOVEN");
  assert.equal(merged.extractedJson?.estado_documento, "vencido");
  assert.equal(front.birthDate, "");
  assert.throws(
    () =>
      mergeIdentityReadings(front, { ...reverse, passportNumber: "OTHER001" }),
    /difieren/,
  );
  assert.throws(
    () =>
      mergeIdentityReadings(front, { ...reverse, fullName: "OTRA PERSONA" }),
    /nombres distintos/,
  );
});

test("field names inside human names do not truncate the value", () => {
  const value = parseVisualDocumentText(
    "PASSPORT\nSurname: SEXTON\nGiven names: ANNABELLE",
  );
  assert.equal(value.fullName, "ANNABELLE SEXTON");
});
