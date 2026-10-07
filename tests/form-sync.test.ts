import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import React, { act } from "react";
import type { Client, Template } from "../src/types";

test("background refresh preserves edited fields despite new client and template objects", async () => {
  const dom = new JSDOM('<div id="root"></div>', {
    url: "http://localhost:3000",
  });
  const previousWindow = globalThis.window,
    previousDocument = globalThis.document;
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    HTMLElement: dom.window.HTMLElement,
    HTMLAnchorElement: dom.window.HTMLAnchorElement,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  const { createRoot } = await import("react-dom/client");
  const { DocumentGenerator } = await import(
    "../src/components/DocumentGenerator"
  );
  const root = createRoot(document.getElementById("root")!);
  const client: Client = {
    id: "client",
    fullName: "ORIGINAL CLIENT",
    firstName: "ORIGINAL",
    lastName: "CLIENT",
    passportNumber: "TEST001",
    docType: "pasaporte",
    nationality: "PANAMEÑA",
    issuingCountry: "PANAMÁ",
    birthDate: "1990-01-01",
    expiryDate: "2030-01-01",
    sex: "M",
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
  };
  const template: Template = {
    id: "template",
    name: "TEST",
    description: "",
    category: "General",
    fileName: "test.docx",
    fileData: "VEVTVA==",
    placeholders: ["{{nombre}}"],
    placeholderDefs: [{ key: "{{nombre}}", label: "Nombre", type: "text" }],
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
    usageCount: 0,
  };
  try {
    await act(async () => {
      root.render(
        React.createElement(DocumentGenerator, {
          clients: [client],
          templates: [template],
        }),
      );
    });
    const field = document.querySelector<HTMLInputElement>(
      '[aria-label="Nombre"]',
    )!;
    assert.ok(field);
    assert.equal(field.value, "ORIGINAL CLIENT");
    const setter = Object.getOwnPropertyDescriptor(
      dom.window.HTMLInputElement.prototype,
      "value",
    )!.set!;
    await act(async () => {
      setter.call(field, "CORRECTED NAME");
      field.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    });
    assert.equal(field.value, "CORRECTED NAME");
    await act(async () => {
      root.render(
        React.createElement(DocumentGenerator, {
          clients: [{ ...client, fullName: "REMOTE CHANGE" }],
          templates: [{ ...template, usageCount: 1 }],
        }),
      );
    });
    assert.equal(
      document.querySelector<HTMLInputElement>('[aria-label="Nombre"]')!.value,
      "CORRECTED NAME",
    );
  } finally {
    const { supabase } = await import("../src/services/supabaseClient");
    supabase.auth.stopAutoRefresh();
    (
      supabase.auth as unknown as { broadcastChannel?: BroadcastChannel }
    ).broadcastChannel?.close();
    await act(async () => {
      root.unmount();
    });
    dom.window.close();
    Object.assign(globalThis, {
      window: previousWindow,
      document: previousDocument,
    });
  }
});
