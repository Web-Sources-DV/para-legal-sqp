import { test, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { supabase } from "../src/services/supabaseClient";
import { setActiveUser } from "../src/services/authService";
import {
  forceCloudSyncNow,
  getClients,
  saveClient,
  saveDocumentLog,
} from "../src/services/cloudStorageService";
import type { Client, GeneratedDocument } from "../src/types";
const originalRpc = supabase.rpc.bind(supabase),
  originalStorage = supabase.storage.from.bind(supabase.storage);
const client: Client = {
  id: "client",
  fullName: "TEST CLIENT",
  firstName: "TEST",
  lastName: "CLIENT",
  passportNumber: "TEST001",
  docType: "pasaporte",
  nationality: "PANAMEÑA",
  issuingCountry: "PANAMÁ",
  birthDate: "",
  expiryDate: "",
  sex: "",
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
  revision: 3,
};
let readFailure = false,
  writeFailure = false,
  uploads = 0;
const calls: { name: string; args: any }[] = [];
beforeEach(async () => {
  readFailure = false;
  writeFailure = false;
  uploads = 0;
  calls.length = 0;
  setActiveUser({
    id: "test-user",
    displayName: "TEST",
    role: "owner",
    active: true,
  });
  supabase.rpc = (async (name: string, args: any) => {
    calls.push({ name, args });
    if (name === "pl_save_entity" || name === "pl_record_document")
      return writeFailure
        ? { data: null, error: new Error("write failed") }
        : { data: 4, error: null };
    if (readFailure) return { data: null, error: new Error("refresh failed") };
    if (name === "pl_sync_cursor") return { data: 0, error: null };
    if (name === "pl_changes") return { data: [], error: null };
    if (name === "pl_entity_counts")
      return { data: { clients: 1, templates: 0, documents: 0 }, error: null };
    if (name === "pl_list_entities")
      return {
        data:
          args.entity === "clients"
            ? [
                {
                  id: client.id,
                  payload: client,
                  revision: 3,
                  archived: false,
                  approved: true,
                },
              ]
            : [],
        error: null,
      };
    return { data: null, error: null };
  }) as unknown as typeof supabase.rpc;
  supabase.storage.from = (() => ({
    upload: async () => {
      uploads++;
      return { error: null };
    },
  })) as unknown as typeof supabase.storage.from;
  await forceCloudSyncNow();
});
after(() => {
  supabase.rpc = originalRpc;
  supabase.storage.from = originalStorage;
  setActiveUser(null);
});
test("a committed cloud write remains successful when refresh fails; readable cache survives", async () => {
  readFailure = true;
  const saved = await saveClient(client);
  assert.equal(saved.revision, 4);
  assert.equal(getClients()[0].fullName, "TEST CLIENT");
  assert.equal(
    calls.find((call) => call.name === "pl_save_entity")!.args
      .expected_revision,
    3,
  );
});
test("cloud write errors remain errors and do not masquerade as success", async () => {
  writeFailure = true;
  await assert.rejects(saveClient(client), /write failed/);
});
test("document retry reuses its private file and stable identifier", async () => {
  const doc: GeneratedDocument = {
    id: "document-stable",
    title: "TEST",
    fileName: "test.docx",
    templateId: "template",
    templateName: "TEST",
    clientId: "client",
    clientName: "TEST",
    passportNumber: "TEST001",
    generatedAt: "2026-01-01",
    fileSizeFormatted: "4 B",
    dataSnapshot: {},
    fileBase64: "VEVTVA==",
  };
  writeFailure = true;
  await assert.rejects(saveDocumentLog(doc), /write failed/);
  writeFailure = false;
  await saveDocumentLog(doc);
  assert.equal(uploads, 1);
  const recorded = calls.filter((call) => call.name === "pl_record_document");
  assert.equal(recorded.length, 2);
  assert.equal(recorded[0].args.document.id, recorded[1].args.document.id);
  assert.ok(recorded[1].args.document.filePath);
  assert.equal(recorded[1].args.document.fileBase64, undefined);
});
test("invalid calendar input never reaches cloud writes", async () => {
  await assert.rejects(
    saveClient({ ...client, birthDate: "2000-02-31" }),
    /Fecha inválida/,
  );
  assert.equal(
    calls.some((call) => call.name === "pl_save_entity"),
    false,
  );
});
