/// <reference lib="webworker" />
import { processExcelWorkbook } from "../screens/excel-workbook.ts";
import { CsvImportError } from "../engine.ts";
const scope = self as DedicatedWorkerGlobalScope;
scope.onmessage = event => {
  const { bytes, sourceName, worksheetName } = event.data;
  void processExcelWorkbook(bytes, sourceName, worksheetName).then(result => scope.postMessage({ result })).catch(error => {
    scope.postMessage({ error: error instanceof CsvImportError ? { code: error.code, message: error.message, recovery: error.recovery }
      : { message: `The Excel workbook cannot be read: “${sourceName}”`, recovery: "Correct the workbook and choose it again." } });
  });
};
export {};
