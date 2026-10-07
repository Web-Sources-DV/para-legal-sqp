// Synthetic identity only; all database writes are intercepted. Downloads real Tesseract language models.
import { test } from "node:test";
import { existsSync } from "node:fs";
import assert from "node:assert/strict";
import type { Client } from "../../src/types";
import { chromium } from "playwright";
test(
  "real OCR reads a synthetic national ID, flags expiry and registers reviewed fields",
  { timeout: 180000 },
  async () => {
    const browser = await chromium.launch({
      executablePath: existsSync("/usr/bin/chromium")
        ? "/usr/bin/chromium"
        : undefined,
      args: ["--no-sandbox"],
    });
    try {
      const context = await browser.newContext({ ignoreHTTPSErrors: true });
      const page = await context.newPage();
      let saved: Client | undefined;
      await page.route(
        "https://fipcnxfxxngdjunrlbat.supabase.co/**",
        async (route) => {
          const name = new URL(route.request().url()).pathname
            .split("/")
            .at(-1);
          let data: unknown = [];
          if (name === "pl_public_sync_cursor") data = 0;
          if (name === "pl_public_entity_counts")
            data = { clients: 0, templates: 0, documents: 0 };
          if (name === "pl_public_save_entity") {
            saved = route.request().postDataJSON().document;
            data = 1;
          }
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(data),
          });
        },
      );
      await page.clock.setFixedTime(new Date("2026-10-07T17:00:00Z"));
      await page.goto(process.env.PL_BROWSER_URL!);
      const png = await page.evaluate(() => {
        const canvas = document.createElement("canvas");
        canvas.width = 1400;
        canvas.height = 900;
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, 1400, 900);
        ctx.fillStyle = "black";
        ctx.font = "36px Arial";
        [
          "REPUBLICA DE PANAMA",
          "CEDULA DE IDENTIDAD",
          "Numero de identidad: 8-123-4567",
          "Nombre completo: MARIA JOSE GONZALEZ",
          "Fecha de nacimiento: 15/06/2011",
          "Sexo: F",
          "Fecha de vencimiento: 01/01/2024",
        ].forEach((line, i) => ctx.fillText(line, 60, 70 + i * 90));
        return canvas.toDataURL("image/png").split(",")[1];
      });
      await page
        .locator("#passport-file-input")
        .setInputFiles({
          name: "synthetic-id.png",
          mimeType: "image/png",
          buffer: Buffer.from(png, "base64"),
        });
      await page
        .getByRole("button", { name: "Leer y revisar identidad", exact: true })
        .click();
      await page
        .getByText("DOCUMENTO VENCIDO", { exact: true })
        .waitFor({ timeout: 120000 });
      const expiry = page.locator("input[type=date]").nth(1);
      assert.equal(await expiry.inputValue(), "2024-01-01");
      await expiry.fill("2100-01-01");
      assert.equal(
        await page.getByText("DOCUMENTO VENCIDO", { exact: true }).count(),
        0,
      );
      await expiry.fill("2024-01-01");
      await page.getByText("DOCUMENTO VENCIDO", { exact: true }).waitFor();
      const confirm = page.getByRole("checkbox", {
        name: /He revisado nombre/,
      });
      await confirm.check();
      page.on("dialog", (dialog) => dialog.accept());
      await page
        .getByRole("button", {
          name: "Guardar en Directorio de Clientes",
          exact: true,
        })
        .click();
      await page.waitForTimeout(500);
      assert.ok(saved);
      assert.equal(saved.fullName, "MARIA JOSE GONZALEZ");
      assert.equal(saved.passportNumber, "8-123-4567");
      assert.equal(saved.birthDate, "2011-06-15");
      assert.equal(saved.sex, "F");
      assert.equal(saved.expiryDate, "2024-01-01");
      assert.equal(saved.sexAgeCategory, "JOVEN");
      assert.equal(saved.docType, "cedula");
      assert.equal(saved.age, 15);
      console.log(
        "PASS: synthetic image → real OCR → expired-document alert → reviewed client registration with all identity fields.",
      );
    } finally {
      await browser.close();
    }
  },
);
