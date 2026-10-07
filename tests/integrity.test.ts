import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseMRZ,
  buildStructuredDocumentJson,
} from "../src/services/ocrService";
import { calculateAgeFromBirthDate } from "../src/services/docxService";
import { fieldDefault, documentTypeLabel } from "../src/services/fieldMapping";
import { validateBackup } from "../src/services/validation";
import {
  allowedOrigin,
  validUserInput,
} from "../supabase/functions/para-legal-users/requestPolicy";
const first = "P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<";
const second = "L898902C36UTO7408122F1204159ZE184226B<<<<<10";
test("MRZ checks expose corruption rather than silently trusting identity data", () => {
  assert.deepEqual(parseMRZ(first + "\n" + second).warnings, []);
  assert.ok(
    parseMRZ(
      first + "\n" + second.replace("L898902C36", "L898902C39"),
    ).warnings!.some((warning) => warning.includes("número de documento")),
  );
});
test("issuer is independent of nationality and calendar-invalid MRZ dates are blank", () => {
  const result = parseMRZ(
    first.replace("UTO", "ESP") +
      "\n" +
      second.replace("UTO740812", "PAN740812"),
  );
  assert.equal(result.issuingCountry, "ESPAÑA");
  assert.equal(result.nationality, "PANAMEÑA");
  assert.equal(
    parseMRZ(first + "\n" + second.replace("740812", "740231")).birthDate,
    "",
  );
});
test("invalid and future birth dates cannot produce a legal age", () => {
  const date = new Date("2026-10-07T12:00:00Z");
  assert.equal(calculateAgeFromBirthDate("2000-02-31", date), null);
  assert.equal(calculateAgeFromBirthDate("2027-01-01", date), null);
  assert.equal(calculateAgeFromBirthDate("2008-10-07", date), 18);
  assert.equal(
    calculateAgeFromBirthDate("2008-10-07", new Date("2026-10-07T02:00:00Z")),
    17,
  );
});
test("structured identity preserves distinct personal number, issuer, dates and document type", () => {
  const result = buildStructuredDocumentJson({
    docType: "dni",
    personalNumber: "PERSONAL",
    passportNumber: "IDENTITY",
    issueDate: "2020-01-01",
    placeOfBirth: "PANAMÁ",
    issuingCountry: "ESPAÑA",
  });
  assert.equal(result.tipo_documento, documentTypeLabel("dni"));
  assert.equal(result.numero_personal, "PERSONAL");
  assert.equal(result.fecha_emision, "2020-01-01");
  assert.equal(result.lugar_nacimiento, "PANAMÁ");
});
test("unknown backup versions and duplicate identities are rejected before restoration", () => {
  assert.throws(
    () =>
      validateBackup({
        version: "100",
        clients: [],
        templates: [],
        documents: [],
      }),
    /Versión/,
  );
  assert.throws(
    () =>
      validateBackup({
        clients: [{ id: "same" }, { id: "same" }],
        templates: [],
        documents: [],
      }),
    /repetido/,
  );
});
test("user endpoint allows exact configured origins and rejects privilege injection", () => {
  assert.equal(
    allowedOrigin(
      "http://localhost:3000",
      "https://example.test,http://localhost:3000",
    ),
    "http://localhost:3000",
  );
  assert.equal(
    allowedOrigin("https://example.test.attacker.test", "https://example.test"),
    null,
  );
  assert.equal(
    validUserInput({
      email: "test@example.test",
      displayName: "TEST",
      role: "owner",
      password: "long-password-test",
    }),
    false,
  );
  assert.equal(
    validUserInput({
      email: "test@example.test",
      displayName: "TEST",
      role: "user",
      password: "long-password-test",
    }),
    true,
  );
});
