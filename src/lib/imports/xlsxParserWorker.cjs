'use strict';

const { parentPort, workerData } = require('node:worker_threads');

(async () => {
  try {
    const imported = require('read-excel-file/node');
    const readXlsxFile = imported.default || imported;
    const sheets = await readXlsxFile(Buffer.from(workerData.buffer), { trim: true });
    parentPort.postMessage({ ok: true, sheets });
  } catch {
    // Parser details can contain paths or internals and must not cross the
    // worker boundary into a user-visible error.
    parentPort.postMessage({ ok: false });
  }
})();
