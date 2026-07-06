// EXCEL İÇE/DIŞA AKTARMA ORTAK YARDIMCI MODÜLÜ
const XLSX = require("xlsx");

/**
 * Yüklenen bir Excel dosyasının buffer'ını satır (JSON) dizisine çevirir.
 * İlk sayfa kullanılır, ilk satır başlık (header) kabul edilir.
 * @param {Buffer} buffer
 * @returns {Array<object>} satırlar (başlık -> değer)
 */
function parseExcelBuffer(buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const firstSheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];
  // defval: '' -> boş hücreleri de satıra dahil et (validasyon için gerekli)
  return XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });
}

/**
 * Başlıklar + (opsiyonel) örnek satırlarla bir şablon Excel dosyası (buffer) üretir.
 * @param {string[]} headers
 * @param {Array<object>} exampleRows
 * @returns {Buffer}
 */
function buildTemplateBuffer(headers, exampleRows = []) {
  const wb = XLSX.utils.book_new();
  const rows = exampleRows.length ? exampleRows : [{}];
  const ws = XLSX.utils.json_to_sheet(rows, { header: headers });
  XLSX.utils.book_append_sheet(wb, ws, "Şablon");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

/**
 * Hatalı satırlardan bir "Hatalı Satır Raporu" Excel dosyası (buffer) üretir.
 * @param {Array<{row:number, errors:string[], data:object}>} errorRows
 * @returns {Buffer}
 */
function buildErrorReportBuffer(errorRows) {
  const rows = errorRows.map((e) => ({
    "Excel Satırı": e.row,
    "Hata": e.errors.join(" | "),
    ...e.data
  }));
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "Hatalı Satırlar");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

module.exports = { parseExcelBuffer, buildTemplateBuffer, buildErrorReportBuffer };
