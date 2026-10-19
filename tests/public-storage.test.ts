import { test, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { publicSupabase } from "../src/services/publicSupabaseClient";
import {
  forceCloudSyncNow,
  searchClients,
  searchDocuments,
  loadMoreDocuments,
  getGeneratedDocuments,
  getClients,
  saveClient,
  getClientDocuments,
} from "../src/services/storageService";
const original = publicSupabase.rpc;
const client = {
  id: "fixture-client",
  fullName: "ANA GARCÍA",
  passportNumber: "FAKE0001",
  docType: "pasaporte",
  email: "fixture@example.test",
  phone: "5550000",
};
const document = (
  id: string,
  title: string,
  templateName = "Poder ficticio",
) => ({
  id,
  payload: {
    id,
    title,
    clientName: "ANA GARCÍA",
    templateName,
    passportNumber: "FAKE0001",
    generatedAt: "2026-10-01T00:00:00Z",
  },
  revision: 1,
  archived: false,
  approved: true,
  sort_key: "2026-10-01T00:00:00+00|" + id,
});
let handler: (name: string, args: Record<string, unknown>) => Promise<unknown>;
beforeEach(async () => {
  handler = async (name, args) => {
    if (name === "pl_public_list_entities")
      return args.entity === "clients" && !args.query
        ? [
            {
              id: client.id,
              payload: client,
              revision: 1,
              archived: false,
              approved: true,
            },
          ]
        : [];
    if (name === "pl_public_entity_counts")
      return { clients: 1, templates: 0, documents: 0 };
    if (name === "pl_public_sync_cursor") return 0;
    return [];
  };
  publicSupabase.rpc = (async (
    name: string,
    args: Record<string, unknown>,
  ) => ({
    data: await handler(name, args),
    error: null,
  })) as unknown as typeof publicSupabase.rpc;
  await searchDocuments("");
  await forceCloudSyncNow();
});
after(() => {
  publicSupabase.rpc = original;
  publicSupabase.auth.stopAutoRefresh();
});
test("public client search keeps cached email and phone matches absent from the backend name filter", async () => {
  assert.equal(
    (await searchClients(" fixture@example.test "))[0]?.id,
    client.id,
  );
  assert.equal((await searchClients("5550000"))[0]?.id, client.id);
  assert.equal((await searchClients("garcia"))[0]?.id, client.id);
});
test("history searches metadata beyond the first page, including template and document number", async () => {
  let calls = 0;
  handler = async (name, args) => {
    if (name !== "pl_public_list_entities") return [];
    calls++;
    return args.after_id
      ? [document("target", "Other", "CERTIFICACIÓN")]
      : Array.from({ length: 250 }, (_, index) =>
          document("other" + index, "No match", "Other"),
        );
  };
  const found = await searchDocuments("certificacion");
  assert.equal(calls, 2);
  assert.equal(found[0]?.id, "target");
  const byIdentity = await searchDocuments("FAKE0001");
  assert.equal(byIdentity.length, 50);
  assert.equal(await loadMoreDocuments("FAKE0001"), true);
  assert.equal(getGeneratedDocuments().length, 100);
});
test("an older history search cannot overwrite the latest search or its pagination", async () => {
  let finish!: (value: unknown) => void;
  let first = true;
  handler = async (name) => {
    if (name !== "pl_public_list_entities") return [];
    if (first) {
      first = false;
      return new Promise((resolve) => {
        finish = resolve;
      });
    }
    return [document("new", "NEW QUERY")];
  };
  const old = searchDocuments("old");
  await searchDocuments("new");
  finish([document("old", "OLD QUERY")]);
  await old;
  assert.deepEqual(
    getGeneratedDocuments().map((doc) => doc.id),
    ["new"],
  );
  assert.equal(await loadMoreDocuments("old"), false);
  assert.deepEqual(
    getGeneratedDocuments().map((doc) => doc.id),
    ["new"],
  );
});

test("a committed public client edit remains visible when the following refresh fails", async () => {
  const existing = getClients()[0];
  handler = async (name) => {
    if (name === "pl_public_save_entity") return 7;
    throw new Error("Refresh offline");
  };
  const saved = await saveClient({ ...existing, fullName: "UPDATED FIXTURE" });
  assert.equal(saved.revision, 7);
  assert.equal(getClients()[0].fullName, "UPDATED FIXTURE");
});

test("a client history lookup filters by identity and never replaces the open global history", async () => {
  handler = async () => [document("global", "Global record")];
  await searchDocuments("");
  handler = async () => [
    {
      ...document("match", "Same client name"),
      payload: {
        ...document("match", "Same client name").payload,
        clientId: "target",
      },
    },
    {
      ...document("different", "Same client name"),
      payload: {
        ...document("different", "Same client name").payload,
        clientId: "other",
      },
    },
  ];
  const result = await getClientDocuments("target");
  assert.deepEqual(
    result.map((record) => record.id),
    ["match"],
  );
  assert.deepEqual(
    getGeneratedDocuments().map((record) => record.id),
    ["global"],
  );
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    getClientDocuments("target", controller.signal),
    /cancelada/,
  );
});
