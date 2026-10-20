import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { chromium, type Page } from "playwright";
async function openTool(page: Page, tab: string) {
  const target = page.locator(`#nav-tab-${tab}`);
  if (!(await target.isVisible()))
    await page.getByText("Herramientas", { exact: true }).click();
  return target;
}
import PizZip from "pizzip";
const id = "00000000-0000-0000-0000-000000000001";
const profile = { id, display_name: "TEST OWNER", role: "owner", active: true };
const user = {
  id,
  email: "owner@example.test",
  role: "authenticated",
  aud: "authenticated",
  created_at: "2026-01-01",
  app_metadata: {},
  user_metadata: {},
  identities: [],
  factors: [],
};
const client = {
  id: "client",
  fullName: "TEST CLIENT",
  firstName: "TEST",
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
const template = {
  id: "template",
  name: "TEST TEMPLATE",
  description: "",
  category: "General",
  fileName: "test.docx",
  placeholders: ["{{nombre}}"],
  placeholderDefs: [{ key: "{{nombre}}", label: "Nombre", type: "text" }],
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
  usageCount: 0,
  version: 1,
};
test("public browser access, edits across refresh, stable archive retry and actual Word download", async () => {
  const executablePath =
    process.env.PL_CHROMIUM_PATH ||
    (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined);
  const browser = await chromium.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  let archiveAttempts = 0,
    uploads = 0;
  const archiveIds: string[] = [];
  let modified = false;
  const zip = new PizZip();
  zip.file(
    "word/document.xml",
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>{{nombre}}</w:t></w:r></w:p></w:body></w:document>',
  );
  const fileData = zip.generate({ type: "base64" });
  const token = `${Buffer.from("{}").toString("base64url")}.${Buffer.from(JSON.stringify({ sub: id, role: "authenticated", aal: "aal1", exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.test`;
  const pageErrors: string[] = [];
  let authRequests = 0;
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.route(
    "https://fipcnxfxxngdjunrlbat.supabase.co/**",
    async (route) => {
      const request = route.request(),
        url = new URL(request.url());
      const headers = {
        "access-control-allow-origin": request.headers().origin || "*",
        "access-control-allow-headers": "*",
        "access-control-allow-methods": "GET,POST,PUT,OPTIONS",
        "content-type": "application/json",
      };
      if (request.method() === "OPTIONS") {
        await route.fulfill({ status: 200, headers, body: "{}" });
        return;
      }
      if (url.pathname.startsWith("/auth/")) authRequests++;
      let result: unknown = {};
      let status = 200;
      if (url.pathname === "/auth/v1/token")
        result = {
          access_token: token,
          refresh_token: "test-refresh",
          expires_in: 3600,
          token_type: "bearer",
          user,
        };
      else if (url.pathname === "/auth/v1/user") result = user;
      else if (url.pathname === "/rest/v1/pl_profiles")
        result = request.headers().accept?.includes("object")
          ? profile
          : [profile];
      else if (url.pathname.startsWith("/storage/v1/object/")) {
        uploads++;
        if (!/\/shared\/documents\/[0-9a-f-]{36}$/.test(url.pathname)) {
          status = 403;
          result = {
            message:
              "Invalid object path: public storage accepts UUID file identifiers",
          };
        } else result = { Key: "test" };
      } else if (url.pathname.includes("/rpc/")) {
        const name = url.pathname
            .split("/")
            .at(-1)
            ?.replace("pl_public_", "pl_"),
          args = request.postDataJSON();
        if (name === "pl_sync_cursor") result = 0;
        else if (name === "pl_entity_counts")
          result = {
            clients: 1,
            templates: 1,
            documents: archiveAttempts > 1 ? 1 : 0,
          };
        else if (name === "pl_list_entities")
          result =
            args.entity === "clients"
              ? [
                  {
                    id: client.id,
                    payload: modified
                      ? { ...client, fullName: "REMOTE NAME" }
                      : client,
                    revision: 1,
                    archived: false,
                    approved: true,
                  },
                ]
              : args.entity === "templates"
                ? [
                    {
                      id: template.id,
                      payload: template,
                      revision: 1,
                      archived: false,
                      approved: true,
                    },
                  ]
                : [];
        else if (name === "pl_changes")
          result = modified
            ? [
                {
                  cursor: archiveAttempts === 1 ? 2 : 1,
                  entity: "clients",
                  id: "client",
                  record: {
                    id: "client",
                    payload: { ...client, fullName: "REMOTE NAME" },
                    revision: 2,
                    archived: false,
                    approved: true,
                  },
                },
              ]
            : [];
        if (name === "pl_changes" && archiveAttempts === 1)
          result = [
            ...(result as unknown[]),
            {
              cursor: 3,
              entity: "templates",
              id: template.id,
              record: {
                id: template.id,
                payload: {
                  ...template,
                  placeholders: [...template.placeholders, "{{nuevo_campo}}"],
                },
                revision: 2,
                archived: false,
                approved: true,
              },
            },
          ];
        else if (name === "pl_entity_file")
          result = { data: fileData, path: null };
        else if (name === "pl_record_document") {
          archiveAttempts++;
          archiveIds.push(args.document.id);
          if (archiveAttempts === 1) {
            status = 503;
            result = {
              message: "Temporary archive outage",
              code: "TEST_OUTAGE",
            };
          } else result = null;
        }
      } else if (
        ["/rest/v1/pl_backups", "/rest/v1/pl_audit"].includes(url.pathname)
      )
        result = [];
      await route.fulfill({ status, headers, body: JSON.stringify(result) });
    },
  );
  try {
    await page.goto(process.env.PL_BROWSER_URL!);
    assert.equal(await page.getByLabel("Correo", { exact: true }).count(), 0);
    assert.equal(authRequests, 0);
    for (const selector of [
      "#btn-sign-out",
      "#nav-tab-users",
      "#nav-tab-database",
    ])
      assert.equal(await page.locator(selector).count(), 0);
    await (await openTool(page, "generator")).click();
    await page.getByLabel("Nombre", { exact: true }).fill("CORRECTED NAME");
    modified = true;
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await page.waitForTimeout(400);
    assert.equal(
      await page.getByLabel("Nombre", { exact: true }).inputValue(),
      "CORRECTED NAME",
    );
    const generate = page
      .getByRole("button")
      .filter({ hasText: /Generar.*Word/ })
      .last();
    await generate.click();
    await page
      .getByText(/Documento preparado, pendiente de archivar/)
      .waitFor();
    assert.equal(uploads, 1);
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await page.getByText(/Los datos de origen cambiaron/).waitFor();
    await page
      .getByText(/nuevo_campo/)
      .first()
      .waitFor();
    assert.equal(
      await page.locator("#select-client-for-doc").isDisabled(),
      true,
    );
    assert.equal(
      await page.locator("#select-template-for-doc").isDisabled(),
      true,
    );
    const download = page.waitForEvent("download");
    await generate.click();
    const downloaded = await download;
    assert.equal(archiveAttempts, 2);
    assert.equal(uploads, 1);
    assert.equal(archiveIds[0], archiveIds[1]);
    assert.ok(downloaded.suggestedFilename().endsWith(".docx"));
    assert.equal(await downloaded.failure(), null);
    const path = await downloaded.path();
    const { readFile } = await import("node:fs/promises");
    const generated = new PizZip(await readFile(path!));
    assert.ok(
      generated.file("word/document.xml")!.asText().includes("CORRECTED NAME"),
    );
    const repeated = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Volver a Descargar .docx" })
      .click();
    assert.equal(await (await repeated).failure(), null);
    assert.equal(archiveAttempts, 2);
    await (await openTool(page, "manual")).click();
    for (const name of [
      /Versión HTML anterior/i,
      /Cerrar sesi[oó]n/i,
      /Base de Datos/i,
      /^Usuarios$/i,
    ]) {
      assert.equal(await page.getByRole("button", { name }).count(), 0);
    }
    assert.equal(authRequests, 0);
    assert.deepEqual(pageErrors, []);
  } catch (error) {
    console.error(
      "Browser failure:",
      await page.locator("body").innerText(),
      pageErrors,
    );
    throw error;
  } finally {
    await context.close();
    await browser.close();
  }
});

test("review can save then continue with the saved revision, and displays retry errors beside actions", async () => {
  const browser = await chromium.launch({
    executablePath: existsSync("/usr/bin/chromium")
      ? "/usr/bin/chromium"
      : undefined,
    args: ["--no-sandbox"],
  });
  try {
    const page = await browser.newPage();
    const writes: {
      document: { id: string };
      expected_revision: number | null;
    }[] = [];
    let failNext = false;
    await page.route(
      "https://fipcnxfxxngdjunrlbat.supabase.co/**",
      async (route) => {
        const name = new URL(route.request().url()).pathname.split("/").at(-1);
        let data: unknown = [];
        let status = 200;
        if (name === "pl_public_sync_cursor") data = 0;
        if (name === "pl_public_entity_counts")
          data = { clients: 0, templates: 0, documents: 0 };
        if (name === "pl_public_save_entity") {
          const args = route.request().postDataJSON();
          writes.push(args);
          if (failNext) {
            status = 503;
            data = { message: "Fallo temporal de prueba" };
            failNext = false;
          } else if (writes.length > 1 && args.expected_revision !== 1) {
            status = 409;
            data = { code: "23505", message: "duplicate key" };
          } else data = writes.length === 1 ? 1 : 2;
        }
        await route.fulfill({
          status,
          contentType: "application/json",
          body: JSON.stringify(data),
        });
      },
    );
    page.on("dialog", (dialog) => dialog.accept());
    await page.goto(process.env.PL_BROWSER_URL!);
    await page.getByRole("button", { name: /Ingreso Manual Rápido/ }).click();
    await page.getByPlaceholder("Ej. CARLOS ANDRÉS").fill("PRUEBA");
    await page.getByPlaceholder("Ej. RESTREPO GÓMEZ").fill("FLUJO");
    await page.getByPlaceholder("Ej. 8-765-4321 o PA1234567").fill("FLOW0001");
    const confirm = page.getByRole("checkbox", { name: /He revisado nombre/ });
    assert.equal(
      await page.locator("#btn-confirm-and-generate").isEnabled(),
      false,
    );
    await confirm.check();
    await page.locator("#btn-save-client-only").click();
    await page
      .getByText("Vincular con otro cliente (opcional)", { exact: true })
      .click();
    await page
      .getByRole("radio", { name: /Actualizar Cliente Existente/ })
      .waitFor();
    await page.waitForFunction(() =>
      document
        .querySelector<HTMLInputElement>('input[name="assocMode"]:checked')
        ?.parentElement?.textContent?.includes("Actualizar"),
    );
    failNext = true;
    await page.locator("#btn-confirm-and-generate").click();
    const error = page
      .getByRole("alert")
      .filter({ hasText: "Fallo temporal de prueba" });
    await error.waitFor();
    assert.equal(
      await error.evaluate((element) => document.activeElement === element),
      true,
    );
    assert.equal(
      await page.getByPlaceholder("Ej. CARLOS ANDRÉS").inputValue(),
      "PRUEBA",
    );
    await page.locator("#btn-confirm-and-generate").click();
    await page
      .getByText("Cliente seleccionado para este documento:", { exact: true })
      .waitFor();
    assert.equal(writes.length, 3);
    assert.equal(writes[0].expected_revision, null);
    assert.equal(writes[1].expected_revision, 1);
    assert.equal(writes[2].expected_revision, 1);
    assert.equal(writes[0].document.id, writes[2].document.id);
  } finally {
    await browser.close();
  }
});

test("client details do not infer sex and load older history; failed saves stay visible in the dialog", async () => {
  const browser = await chromium.launch({
    executablePath: existsSync("/usr/bin/chromium")
      ? "/usr/bin/chromium"
      : undefined,
    args: ["--no-sandbox"],
  });
  try {
    const page = await browser.newPage();
    await page.route(
      "https://fipcnxfxxngdjunrlbat.supabase.co/**",
      async (route) => {
        const name = new URL(route.request().url()).pathname.split("/").at(-1);
        const args = route.request().postDataJSON();
        let data: unknown = [];
        let status = 200;
        if (name === "pl_public_sync_cursor") data = 0;
        if (name === "pl_public_entity_counts")
          data = { clients: 1, templates: 0, documents: 1 };
        if (name === "pl_public_list_entities" && args.entity === "clients")
          data = [
            {
              id: client.id,
              payload: { ...client, sex: "", documentCount: 1 },
              revision: 1,
              archived: false,
              approved: true,
            },
          ];
        if (
          name === "pl_public_list_entities" &&
          args.entity === "documents" &&
          args.page_size === 250
        )
          data = [
            {
              id: "older-fixture",
              payload: {
                id: "older-fixture",
                title: "Older fixture",
                clientId: client.id,
                clientName: client.fullName,
                templateName: "OLDER FIXTURE TEMPLATE",
                fileName: "older.docx",
                generatedAt: "2026-01-01T00:00:00Z",
              },
              revision: 1,
              archived: false,
              approved: true,
            },
          ];
        if (name === "pl_public_save_entity") {
          status = 503;
          data = { message: "Fallo de guardado de prueba" };
        }
        await route.fulfill({
          status,
          contentType: "application/json",
          body: JSON.stringify(data),
        });
      },
    );
    await page.goto(process.env.PL_BROWSER_URL!);
    await (await openTool(page, "clients")).click();
    await page.getByText(client.fullName, { exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Ficha de cliente" });
    await dialog.getByText("Sin confirmar", { exact: true }).waitFor();
    await dialog.getByText("OLDER FIXTURE TEMPLATE", { exact: true }).waitFor();
    assert.equal(
      await dialog.getByText("Femenino", { exact: true }).count(),
      0,
    );
    await page.keyboard.press("Escape");
    await page.getByTitle("Editar Ficha", { exact: true }).click();
    await page
      .getByRole("button", { name: "Guardar Cliente", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("alert")
      .filter({ hasText: "Fallo de guardado de prueba" })
      .waitFor();
  } finally {
    await browser.close();
  }
});

test("public navigation and scanner controls fit mobile and desktop screens", async () => {
  const browser = await chromium.launch({
    executablePath:
      process.env.PL_CHROMIUM_PATH ||
      (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("https://*.supabase.co/**", async (route) => {
    const name = new URL(route.request().url()).pathname.split("/").at(-1);
    const result = name?.endsWith("entity_counts")
      ? { clients: 0, templates: 0, documents: 0 }
      : name?.endsWith("sync_cursor")
        ? 0
        : [];
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(result),
    });
  });
  try {
    await page.goto(process.env.PL_BROWSER_URL || "http://127.0.0.1:3100");
    for (const width of [375, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 960 });
      for (const tab of [
        "generator",
        "clients",
        "templates",
        "history",
        "manual",
        "wizard",
      ]) {
        const button = await openTool(page, tab);
        const box = await button.boundingBox();
        await button.click();
        await page
          .getByText("Cargando sección...", { exact: true })
          .waitFor({ state: "hidden" });
        assert.ok(
          box && box.x >= 0 && box.x + box.width <= width,
          `${tab} button fits ${width}px`,
        );
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          ),
          false,
          `${tab} does not overflow at ${width}px`,
        );
      }
      await page
        .getByRole("heading", {
          name: "Lector OCR de Pasaporte, Cédula y Carnet",
        })
        .waitFor();
      assert.equal(
        await page
          .getByText("Filtro de Preprocesamiento Óptico OCR", { exact: true })
          .count(),
        0,
      );
    }
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});

test("three-step workflow saves a reviewed identity and downloads Word without changing sections", async () => {
  const browser = await chromium.launch({
    executablePath:
      process.env.PL_CHROMIUM_PATH ||
      (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  let saved: Record<string, unknown> | undefined;
  let archived: Record<string, unknown> | undefined;
  const zip = new PizZip();
  zip.file(
    "word/document.xml",
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>{{nombre}}</w:t></w:r></w:p></w:body></w:document>',
  );
  const fileData =
    "data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64," +
    zip.generate({ type: "base64" });
  await page.route("https://*.supabase.co/**", async (route) => {
    const name = new URL(route.request().url()).pathname
      .split("/")
      .at(-1)
      ?.replace("pl_public_", "pl_");
    const args =
      new URL(route.request().url()).pathname.includes("/rpc/") &&
      route.request().method() === "POST"
        ? route.request().postDataJSON()
        : {};
    let result: unknown = [];
    if (name === "pl_sync_cursor") result = 0;
    else if (name === "pl_entity_counts")
      result = {
        clients: saved ? 1 : 0,
        templates: 1,
        documents: archived ? 1 : 0,
      };
    else if (name === "pl_list_entities")
      result =
        args.entity === "templates"
          ? [
              {
                id: template.id,
                payload: template,
                revision: 1,
                approved: true,
                archived: false,
              },
            ]
          : args.entity === "clients" && saved
            ? [
                {
                  id: saved.id,
                  payload: saved,
                  revision: 1,
                  approved: true,
                  archived: false,
                },
              ]
            : [];
    else if (name === "pl_save_entity") {
      saved = args.document;
      result = 1;
    } else if (name === "pl_entity_file")
      result = { data: fileData, path: null };
    else if (name === "pl_record_document") {
      archived = args.document;
      result = null;
    } else if (new URL(route.request().url()).pathname.includes("/storage/"))
      result = { Key: "test" };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(result),
    });
  });
  try {
    await page.goto(process.env.PL_BROWSER_URL!);
    await page
      .getByRole("heading", { name: "Documento en 3 pasos", exact: true })
      .waitFor();
    assert.equal(
      await page
        .getByRole("list", { name: "Progreso del documento" })
        .locator("li")
        .count(),
      3,
    );
    if (process.env.PL_CAPTURE_UI === "1") {
      for (const width of [375, 1440]) {
        await page.setViewportSize({ width, height: 960 });
        await page.screenshot({
          path: `/tmp/para-legal-simple-${width}.png`,
          fullPage: true,
        });
      }
    }
    await page
      .getByRole("button", { name: "Ingreso Manual Rápido", exact: true })
      .click();
    await page.getByPlaceholder("Ej. CARLOS ANDRÉS").fill("PRUEBA");
    await page.getByPlaceholder("Ej. RESTREPO GÓMEZ").fill("FLUJO");
    await page.getByPlaceholder("Ej. 8-765-4321 o PA1234567").fill("FLOW0001");
    await page.getByRole("checkbox", { name: /He revisado nombre/ }).check();
    await page.locator("#btn-confirm-and-generate").click();
    await page.locator("#select-template-for-doc").waitFor();
    assert.equal(
      await page.locator("#select-client-for-doc").isVisible(),
      false,
    );
    assert.equal(
      await page
        .getByRole("button", { name: "Ver JSON (OCR)", exact: true })
        .count(),
      0,
    );
    await page.getByLabel("Nombre", { exact: true }).fill("PRUEBA CORREGIDA");
    const downloadEvent = page.waitForEvent("download");
    await page
      .getByRole("button", {
        name: "Generar y Descargar Word (.docx)",
        exact: true,
      })
      .click();
    const download = await downloadEvent;
    assert.ok(saved);
    assert.ok(archived);
    assert.equal(archived.clientId, saved.id);
    assert.equal(archived.templateId, template.id);
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
    assert.match(
      new PizZip(Buffer.concat(chunks)).file("word/document.xml")!.asText(),
      /PRUEBA CORREGIDA/,
    );
  } finally {
    await browser.close();
  }
});
