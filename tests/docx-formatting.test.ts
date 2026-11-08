import { test } from "node:test";
import assert from "node:assert/strict";
import PizZip from "pizzip";
import { JSDOM } from "jsdom";
import {
  buildComprehensiveReplacementMap,
  replaceTokensInWordXml,
  generateAndDownloadDocx,
} from "../src/services/docxService";
import type { Template } from "../src/types";

const namespace =
  'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const bodyStyle =
  '<w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:b w:val="0"/><w:sz w:val="22"/><w:color w:val="333333"/></w:rPr>';
const signatureStyle =
  '<w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:b/><w:bCs/><w:i/><w:u w:val="single"/><w:sz w:val="28"/><w:spacing w:val="10"/></w:rPr>';
const source = `<w:document ${namespace}><w:body><w:p><w:pPr><w:jc w:val="both"/></w:pPr><w:r>${bodyStyle}<w:t>Con {{tipo de documento}} No. {{numero_identidad}}.</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r>${signatureStyle}<w:t>{{TIPO DE DOCUMENTO}}: {{NUMERO_IDENTIDAD}}</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body></w:document>`;
const withoutText = (xml: string) =>
  xml.replace(/<w:t\b[^>]*>[\s\S]*?<\/w:t>/g, "<w:t/>");

test("body and signature markers keep independent fonts, sizes and bold without restyling the template", () => {
  const map = buildComprehensiveReplacementMap({
    "{{tipo de documento}}": "Pasaporte",
    "{{numero_identidad}}": "Ab009X",
  });
  const output = replaceTokensInWordXml(source, map);
  assert.equal(withoutText(output), withoutText(source));
  assert.match(output, /Con pasaporte No\. Ab009X\./);
  assert.match(output, /PASAPORTE: Ab009X/);
  assert.ok(output.includes(bodyStyle));
  assert.ok(output.includes(signatureStyle));
});

test("split markers use their first letter's run and keep delimiters' and surrounding styles untouched", () => {
  const xml = `<w:document ${namespace}><w:body><w:p><w:r><w:t>Texto legal </w:t></w:r><w:r><w:rPr><w:sz w:val="18"/></w:rPr><w:t>{{</w:t></w:r><w:r>${bodyStyle}<w:t>tipo de </w:t></w:r><w:r>${bodyStyle}<w:t>documento}}</w:t><w:br/><w:t> y pasaporte literal.</w:t></w:r></w:p></w:body></w:document>`;
  const output = replaceTokensInWordXml(
    xml,
    buildComprehensiveReplacementMap({ "{{tipo_documento}}": "Pasaporte" }),
  );
  assert.equal(withoutText(output), withoutText(xml));
  const window = new JSDOM(output, { contentType: "application/xml" }).window;
  const runs = [
    ...window.document.getElementsByTagNameNS(
      "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
      "r",
    ),
  ];
  assert.equal(runs[1].textContent, "");
  assert.equal(runs[2].textContent, "pasaporte");
  assert.equal(runs[3].textContent, " y pasaporte literal.");
  window.close();
});

test("nationality retains bold when the template requests it, while unstyled fields inherit their Word style", () => {
  const xml = `<w:document ${namespace}><w:body><w:p><w:pPr><w:pStyle w:val="Legal"/></w:pPr><w:r><w:t>{{nombre}} (tipo_documento) [nacionalidad]</w:t></w:r></w:p><w:p><w:r>${signatureStyle}<w:t>(NACIONALIDAD) (Tipo_documento)</w:t></w:r></w:p></w:body></w:document>`;
  const output = replaceTokensInWordXml(
    xml,
    buildComprehensiveReplacementMap({
      "{{nombre}}": "Ana María Pérez",
      "(tipo_documento)": "Cédula",
      "[nacionalidad]": "PANAMEÑA",
    }),
  );
  assert.equal(withoutText(output), withoutText(xml));
  assert.match(output, /Ana María Pérez cédula panameña/);
  assert.match(output, /PANAMEÑA Cédula/);
  assert.equal((output.match(/<w:b\/>/g) || []).length, 1);
});

test("downloaded DOCX preserves formatting and unchanged styles across body, header and footer", async () => {
  const zip = new PizZip();
  zip.file("word/document.xml", source);
  const header = `<w:hdr ${namespace}><w:p><w:r>${bodyStyle}<w:t>{{tipo_documento}}</w:t></w:r></w:p></w:hdr>`;
  const footer = `<w:ftr ${namespace}><w:p><w:r>${signatureStyle}<w:t>{{TIPO_DOCUMENTO}}</w:t></w:r></w:p></w:ftr>`;
  zip.file("word/header1.xml", header);
  zip.file("word/footer1.xml", footer);
  const styles = `<w:styles ${namespace}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:sz w:val="24"/></w:rPr></w:rPrDefault></w:docDefaults></w:styles>`;
  zip.file("word/styles.xml", styles);
  const template = {
    id: "format-test",
    name: "Formato de prueba",
    placeholders: ["{{tipo de documento}}", "{{numero_identidad}}"],
    fileData: zip.generate({ type: "base64" }),
  } as Template;
  const generated = await generateAndDownloadDocx(
    template,
    { "{{tipo de documento}}": "Pasaporte", "{{numero_identidad}}": "Ab009X" },
    "formato",
    undefined,
    undefined,
    false,
  );
  const result = new PizZip(await generated.blob.arrayBuffer());
  for (const [path, original] of [
    ["word/document.xml", source],
    ["word/header1.xml", header],
    ["word/footer1.xml", footer],
  ])
    assert.equal(
      withoutText(result.file(path)!.asText()),
      withoutText(original),
    );
  assert.match(result.file("word/header1.xml")!.asText(), />pasaporte<\/w:t>/);
  assert.match(result.file("word/footer1.xml")!.asText(), />PASAPORTE<\/w:t>/);
  assert.equal(result.file("word/styles.xml")!.asText(), styles);
});
