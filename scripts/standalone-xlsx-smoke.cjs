'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const { Worker } = require('node:worker_threads');
const Papa = require('papaparse');
const { strToU8, zipSync } = require('fflate');

const artifactRoot = path.resolve(process.argv[2] || process.cwd());
const workerPath = path.join(artifactRoot, 'src', 'lib', 'imports', 'xlsxParserWorker.cjs');
const MAX_FILE_BYTES = 5 * 1024 * 1024;

function createWorkbook(extraFiles = {}) {
  const files = {
    '[Content_Types].xml': strToU8('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>'),
    '_rels/.rels': strToU8('<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'),
    'xl/workbook.xml': strToU8('<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Clients" sheetId="1" r:id="rId1"/></sheets></workbook>'),
    'xl/_rels/workbook.xml.rels': strToU8('<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'),
    'xl/styles.xml': strToU8('<?xml version="1.0"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts><fills count="1"><fill><patternFill patternType="none"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="1"><xf xfId="0"/></cellXfs></styleSheet>'),
    'xl/worksheets/sheet1.xml': strToU8('<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Name</t></is></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>Synthetic Client</t></is></c></row></sheetData></worksheet>'),
    ...extraFiles,
  };
  return Buffer.from(zipSync(files, { level: 1 }));
}

function inspectArchive(buffer) {
  if (buffer.length > MAX_FILE_BYTES) throw new Error('oversized');
  if (buffer.length < 22 || buffer.subarray(0, 2).toString() !== 'PK') throw new Error('invalid signature');
  let eocd = -1;
  for (let offset = buffer.length - 22; offset >= Math.max(0, buffer.length - 65_557); offset--) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) { eocd = offset; break; }
  }
  if (eocd < 0) throw new Error('malformed archive');
  const count = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  const entries = [];
  for (let index = 0; index < count; index++) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) throw new Error('malformed archive');
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    entries.push(buffer.subarray(offset + 46, offset + 46 + nameLength).toString('utf8'));
    offset += 46 + nameLength + extraLength + commentLength;
  }
  if (!entries.includes('xl/workbook.xml')) throw new Error('invalid workbook');
  if (entries.some((entry) => /(?:^|\/)vbaProject\.bin$/i.test(entry))) throw new Error('macro-enabled');
}

function parseInWorker(buffer, timeoutMs) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(workerPath, {
      workerData: { buffer },
      resourceLimits: { maxOldGenerationSizeMb: 128, maxYoungGenerationSizeMb: 32, stackSizeMb: 4 },
    });
    let settled = false;
    const finish = async (operation) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      await worker.terminate();
      operation();
    };
    const timer = setTimeout(() => void finish(() => reject(new Error('timeout terminated'))), timeoutMs);
    worker.once('message', (message) => void finish(() => message?.ok ? resolve(message.sheets) : reject(new Error('malformed workbook'))));
    worker.once('error', () => void finish(() => reject(new Error('worker failure'))));
  });
}

async function expectFailure(operation, pattern) {
  let caught;
  try { await operation(); } catch (error) { caught = error; }
  assert(caught instanceof Error, 'Expected operation to fail');
  assert.match(caught.message, pattern);
}

(async () => {
  const workbook = createWorkbook();
  inspectArchive(workbook);
  const sheets = await parseInWorker(workbook, 5_000);
  assert.equal(sheets[0].sheet, 'Clients');
  assert.equal(sheets[0].data[1][0], 'Synthetic Client');

  await expectFailure(() => parseInWorker(Buffer.from('PK malformed'), 5_000), /malformed|worker failure/);
  await expectFailure(async () => inspectArchive(createWorkbook({ 'xl/vbaProject.bin': new Uint8Array([1]) })), /macro-enabled/);
  await expectFailure(async () => inspectArchive(Buffer.alloc(MAX_FILE_BYTES + 1)), /oversized/);
  await expectFailure(() => parseInWorker(workbook, 1), /timeout terminated/);

  const csv = Papa.parse('Name,Email\nSynthetic Client,synthetic@example.invalid', { skipEmptyLines: 'greedy' });
  assert.deepEqual(csv.errors, []);
  assert.deepEqual(csv.data[1], ['Synthetic Client', 'synthetic@example.invalid']);
  console.log('Standalone XLSX smoke passed: valid XLSX, malformed XLSX, macro rejection, size rejection, worker termination, and CSV parsing.');
})().catch((error) => {
  console.error(`Standalone XLSX smoke failed: ${error instanceof Error ? error.message : 'unknown failure'}`);
  process.exit(1);
});
