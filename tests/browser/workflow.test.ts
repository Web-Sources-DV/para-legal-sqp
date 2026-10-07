import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { chromium } from "playwright";
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
        result = { Key: "test" };
      } else if (url.pathname.includes("/rpc/")) {
        const name = url.pathname.split("/").at(-1)?.replace("pl_public_", "pl_"),
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
                  cursor: 1,
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
    assert.equal(await page.getByLabel("Correo", {exact:true}).count(), 0);
    assert.equal(authRequests, 0);
    for (const selector of ['#btn-sign-out','#nav-tab-users','#nav-tab-database']) assert.equal(await page.locator(selector).count(), 0);
    await page.locator("#nav-tab-generator").click();
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
    await page.locator("#nav-tab-manual").click();
    for (const name of [/Versión HTML anterior/i, /Cerrar sesi[oó]n/i, /Base de Datos/i, /^Usuarios$/i]) {
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
