import { test } from 'node:test';
import assert from 'node:assert/strict';
import PizZip from 'pizzip';
import { formatGenerationDate, fieldDefault, isGenerationDate } from '../src/services/fieldMapping';
import { parseDocxFile, generateAndDownloadDocx } from '../src/services/docxService';
import type { Template } from '../src/types';

test('certification date uses the attached format and the Panama calendar day', () => {
  assert.equal(formatGenerationDate(new Date('2026-11-11T04:59:59Z')), '10 de noviembre 2026');
  assert.equal(formatGenerationDate(new Date('2026-11-11T05:00:00Z')), '11 de noviembre 2026');
  assert.equal(formatGenerationDate(new Date('2027-01-01T04:00:00Z')), '31 de diciembre 2026');
  assert.equal(isGenerationDate('(FECHA)'), true);
  assert.equal(isGenerationDate('{{fecha_nacimiento}}'), false);
  assert.equal(isGenerationDate('(fecha_firma)'), false);
});

test('FECHA is refreshed on generation instead of using an old saved value and retains typography', async context => {
  context.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-10T17:00:00Z') });
  const xml = '<w:document><w:body><w:p><w:r><w:rPr><w:rFonts w:ascii="Arial"/><w:b/><w:sz w:val="24"/></w:rPr><w:t xml:space="preserve">Panamá, (FECHA).</w:t></w:r></w:p></w:body></w:document>';
  const zip = new PizZip();
  zip.file('word/document.xml', xml);
  const parsed = await parseDocxFile(zip.generate({ type: 'arraybuffer' }), 'certificacion.docx');
  assert.deepEqual(parsed.placeholders, ['(FECHA)']);
  assert.equal(fieldDefault('(FECHA)'), '10 de noviembre 2026');
  const template: Template = { ...parsed, id: 'test-date', name: 'Certificación de prueba', description: '', category: 'General', fileName: 'certificacion.docx', fileData: parsed.fileBase64, createdAt: '', updatedAt: '', usageCount: 0 };
  context.mock.timers.setTime(new Date('2026-11-11T05:00:00Z').getTime());
  for (const data of [{ '(FECHA)': '10 de noviembre 2026' }, {}] as Record<string, string>[]) {
    const generated = await generateAndDownloadDocx(template, data, undefined, undefined, undefined, false);
    const output = new PizZip(await generated.blob.arrayBuffer()).file('word/document.xml')!.asText();
    assert.equal(output, xml.replace('(FECHA)', '11 DE NOVIEMBRE 2026'));
  }
});
