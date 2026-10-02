import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import PizZip from 'pizzip';
import { canonicalField, fieldDefault } from '../src/services/fieldMapping';
import { buildComprehensiveReplacementMap, parseDocxFile, replaceTokensInWordXml, formatAndAlignSignatureBlockInWordXml, generateAndDownloadDocx } from '../src/services/docxService';
import { buildStructuredDocumentJson, parseVisualDocumentText, parseMRZ } from '../src/services/ocrService';
import { saveClient, saveTemplate, saveDocumentLog, deleteDocumentLog, getClients, getTemplates, getGeneratedDocuments, importDatabaseJson, exportFullDatabaseJson } from '../src/services/storageService';
import type { Client, Template, GeneratedDocument } from '../src/types';

const storage = new Map<string, string>();
let failKey = '';
Object.defineProperty(globalThis, 'localStorage', { value: {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => { if (key === failKey) { failKey = ''; throw new Error('QuotaExceededError'); } storage.set(key, value); },
  removeItem: (key: string) => storage.delete(key),
}});
beforeEach(() => { storage.clear(); failKey = ''; });
const client: Client = { id: 'cli-test', firstName: 'CLIENTE', lastName: 'PRUEBA', fullName: 'CLIENTE PRUEBA', passportNumber: 'TEST-SQP-001', docType: 'dni', nationality: 'PANAMEÑA', issuingCountry: 'PANAMÁ', birthDate: '', expiryDate: '', sex: '', createdAt: '2026-10-02', updatedAt: '2026-10-02', documentCount: 0 };
const template: Template = { id: 'tpl-test', name: 'Prueba', description: '', category: 'General', fileName: 'prueba.docx', fileData: 'dGVzdA==', placeholders: ['{{nombre}}'], placeholderDefs: [], createdAt: '2026-10-02', updatedAt: '2026-10-02', usageCount: 0 };
const doc: GeneratedDocument = { id: 'doc-test', title: 'Prueba', fileName: 'Prueba.docx', clientId: client.id, clientName: client.fullName, templateId: template.id, templateName: template.name, passportNumber: client.passportNumber, generatedAt: '2026-10-02', fileSizeFormatted: '1 KB', dataSnapshot: { '{{nombre}}': client.fullName }, fileBase64: 'dGVzdA==' };

test('mapped fields distinguish first names, lawyer credentials and document type', () => {
  assert.equal(canonicalField('{{nombres}}'), 'firstName');
  assert.equal(canonicalField('(abogado_cédula)'), 'lawyerCedula');
  assert.equal(fieldDefault('(cedula/pasaporte)', client), 'DNI');
  assert.equal(fieldDefault('{{nombres}}', client), 'CLIENTE');
  assert.equal(fieldDefault('(ciudad)', client), '');
});

test('explicit edits and empty values override saved client data across aliases', () => {
  const values = buildComprehensiveReplacementMap({ '{{NOMBRE}}': 'NOMBRE CORREGIDO', '[numero_identidad]': 'TEST-EDIT', '(nacionalidad)': '' }, client);
  assert.equal(values['(nombre)'], 'NOMBRE CORREGIDO');
  assert.equal(values['{{numero_de_identidad}}'], 'TEST-EDIT');
  assert.equal(values['(nacionalidad)'], '');
});

test('OCR does not turn ordinary prose or country headers into identity data', () => {
  const result = parseVisualDocumentText('PASAPORTE\nREPUBLICA DE PANAMA\nDOCUMENTO NACIONAL');
  assert.equal(result.passportNumber, undefined);
  assert.equal(result.nationality, undefined);
  assert.equal(result.birthDate, '');
  const json = buildStructuredDocumentJson({});
  assert.equal(json.numero_identidad, '');
  assert.equal(json.sexo, '');
  assert.equal(json.condicion_juridica, '');
  assert.equal(json.pais_emisor, '');
  assert.equal(json.confianza_lectura_porcentaje, 0);
});

test('visual OCR reads labeled identity and dates without treating issue date as birth', () => {
  const result = parseVisualDocumentText('PASAPORTE: TEST12345\nFECHA DE EMISIÓN: 01/02/2020\nFECHA DE NACIMIENTO: 10/03/1990\nFECHA DE VENCIMIENTO: 2030-04-15\nNACIONALIDAD: PANAMEÑA');
  assert.equal(result.passportNumber, 'TEST12345');
  assert.equal(result.birthDate, '1990-03-10');
  assert.equal(result.issueDate, '2020-02-01');
  assert.equal(result.expiryDate, '2030-04-15');
  assert.equal(result.nationality, 'PANAMEÑA');
});

test('standard passport MRZ reads names and document number; prose is rejected', () => {
  const result = parseMRZ('P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<\nL898902C36UTO7408122F1204159ZE184226B<<<<<10');
  assert.equal(result.passportNumber, 'L898902C3');
  assert.equal(result.firstName, 'ANNA MARIA');
  assert.equal(result.sex, 'F');
  assert.deepEqual(parseMRZ('CUALQUIER TEXTO MUY LARGO SIN ZONA MECANICA\nOTRO TEXTO SIN DATOS DE IDENTIDAD'), {});
});

test('Word replacements preserve drawings, hyperlinks, breaks and entities in split markers', () => {
  const xml = '<w:p><w:r><w:t>Texto &amp; {{nom</w:t></w:r><w:r><w:t>bre}} final</w:t><w:br/><w:drawing>IMAGE</w:drawing></w:r><w:hyperlink r:id="rId2"><w:r><w:t>Enlace</w:t></w:r></w:hyperlink></w:p>';
  const output = replaceTokensInWordXml(xml, buildComprehensiveReplacementMap({ '{{nombre}}': 'ANA & LUIS' }));
  assert.ok(output.includes('ANA &amp; LUIS'));
  assert.ok(output.includes('Texto &amp; '));
  assert.ok(!output.includes('&amp;amp;'));
  assert.ok(output.includes('<w:br/>'));
  assert.ok(output.includes('<w:drawing>IMAGE</w:drawing>'));
  assert.ok(output.includes('<w:hyperlink r:id="rId2">'));
  assert.ok(!output.includes('{{nom'));
  assert.ok(!output.includes('bre}}'));
  assert.ok(output.includes('<w:b/>'));
});

test('DOCX upload detects each marker once and rejects unmarked/invalid documents', async () => {
  const zip = new PizZip();
  zip.file('word/document.xml', '<w:document><w:body><w:p><w:r><w:t>{{nombre}} (cedula/pasaporte)</w:t></w:r></w:p></w:body></w:document>');
  const parsed = await parseDocxFile(zip.generate({ type: 'arraybuffer' }), 'fixture.docx');
  assert.deepEqual(parsed.placeholders, ['(cedula/pasaporte)', '{{nombre}}']);
  assert.equal(parsed.placeholderDefs[0].type, 'select');
  zip.file('word/document.xml', '<w:document><w:p><w:r><w:t>Sin campos</w:t></w:r></w:p></w:document>');
  await assert.rejects(parseDocxFile(zip.generate({ type: 'arraybuffer' }), 'fixture.docx'), /marcadores/);
});

test('signature edits require explicit activation and preserve following legal paragraphs', () => {
  const paragraph = (text: string) => `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`;
  const xml = '<w:body>' + paragraph('Cláusula previa') + paragraph('ACEPTO PODER OTORGO PODER:') + paragraph('ABOGADO CLIENTE') + paragraph('CÉDULA No. TEST PASAPORTE No. TEST') + paragraph('Cláusula posterior') + '</w:body>';
  assert.equal(formatAndAlignSignatureBlockInWordXml(xml), xml);
  const output = formatAndAlignSignatureBlockInWordXml(xml, { enabled: true, clientSignatureName: 'CLIENTE PRUEBA', lawyerSignatureTitle: 'LETRADO PRUEBA', clientSignatureDoc: 'DNI TEST', signatureBlankLines: 3 });
  assert.ok(output.includes('<w:tbl>'));
  assert.ok(output.includes('Cláusula posterior'));
  assert.ok(output.includes('CLIENTE PRUEBA'));
  assert.throws(() => formatAndAlignSignatureBlockInWordXml(paragraph('Sin bloque de firmas'), { enabled: true }), /compatible/);
});

test('generated Word archive contains corrected fields and a safe filename', async () => {
  const zip = new PizZip();
  zip.file('word/document.xml', '<w:document><w:body><w:p><w:r><w:t>{{nombre}} {{numero_identidad}} {{nacionalidad}}</w:t></w:r></w:p></w:body></w:document>');
  const uploaded = await parseDocxFile(zip.generate({ type: 'arraybuffer' }), 'fixture.docx');
  const generated = await generateAndDownloadDocx({ ...template, fileData: uploaded.fileBase64, placeholders: uploaded.placeholders }, { '{{nombre}}': 'CLIENTE CORREGIDO', '{{numero_identidad}}': 'TEST-EDIT', '{{nacionalidad}}': 'PANAMEÑA' }, 'prueba/archivo', client);
  assert.equal(generated.fileName, 'prueba_archivo.docx');
  const output = new PizZip(await generated.blob.arrayBuffer()).file('word/document.xml')!.asText();
  assert.ok(output.includes('CLIENTE CORREGIDO'));
  assert.ok(output.includes('TEST-EDIT'));
  assert.ok(output.includes('panameña'));
  assert.ok(!output.includes('{{'));
  await assert.rejects(generateAndDownloadDocx({ ...template, fileData: uploaded.fileBase64, placeholders: uploaded.placeholders }, { '{{nombre}}': 'CLIENTE' }), /Completa los campos/);
});

test('history saves exact file, updates counters and duplicate logs are idempotent', () => {
  saveClient(client); saveTemplate(template); saveDocumentLog(doc); saveDocumentLog(doc);
  assert.equal(getGeneratedDocuments().length, 1);
  assert.equal(getGeneratedDocuments()[0].fileBase64, doc.fileBase64);
  assert.equal(getClients()[0].documentCount, 1);
  assert.equal(getTemplates()[0].usageCount, 1);
  deleteDocumentLog(doc.id);
  assert.equal(getClients()[0].documentCount, 0);
  assert.equal(getTemplates()[0].usageCount, 0);
});

test('invalid backups leave current data intact; quota failure rolls back all affected keys', () => {
  saveClient(client); saveTemplate(template);
  assert.equal(importDatabaseJson(JSON.stringify({ clients: [], templates: [{ id: 'broken' }] })).success, false);
  assert.equal(getClients()[0].id, client.id);
  const backup = JSON.parse(exportFullDatabaseJson());
  backup.clients[0].fullName = 'NUEVO';
  backup.templates[0].name = 'NUEVA';
  failKey = 'sqp_templates_v2';
  assert.equal(importDatabaseJson(JSON.stringify(backup)).success, false);
  assert.equal(getClients()[0].fullName, client.fullName);
  assert.equal(getTemplates()[0].name, template.name);
  assert.equal(importDatabaseJson(JSON.stringify(backup)).success, true);
  assert.equal(getClients()[0].fullName, 'NUEVO');
});
