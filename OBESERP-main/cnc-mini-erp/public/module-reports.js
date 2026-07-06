(function () {
  "use strict";

  if (window.__obesModuleReportsLoaded) return;
  window.__obesModuleReportsLoaded = true;

  const REPORT_STYLE_ID = "obes-module-report-style";

  function ready(callback) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", callback, { once: true });
    } else {
      callback();
    }
  }

  function injectStyle() {
    if (document.getElementById(REPORT_STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = REPORT_STYLE_ID;
    style.textContent = `
      .report-actions{
        display:inline-flex;
        align-items:center;
        gap:8px;
        padding:4px;
        border:1px solid #e2e8f2;
        border-radius:14px;
        background:#f8fbff;
      }
      .report-actions.report-inline{
        margin-left:auto;
        flex-shrink:0;
      }
      .report-panel-tools{
        margin-left:auto;
        display:inline-flex;
        align-items:center;
        justify-content:flex-end;
        gap:12px;
        flex-wrap:wrap;
      }
      .report-panel-tools > span{
        color:#7a8799;
        font-size:13px;
        font-weight:700;
        white-space:nowrap;
      }
      .report-toolbar{
        display:flex;
        justify-content:flex-end;
        align-items:center;
        gap:10px;
        margin:0 0 12px;
      }
      .report-btn{
        height:36px;
        min-width:38px;
        border:0;
        border-radius:10px;
        padding:0 11px;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        gap:8px;
        color:#243247;
        background:#fff;
        font:800 12px "Inter",Arial,sans-serif;
        cursor:pointer;
        box-shadow:0 6px 14px rgba(31,54,91,.06);
        transition:transform .16s ease, box-shadow .16s ease, color .16s ease;
      }
      .report-btn:hover{
        transform:translateY(-1px);
        box-shadow:0 10px 22px rgba(31,54,91,.10);
      }
      .report-btn.excel{color:#15803d}
      .report-btn.pdf{color:#dc2626}
      .report-btn i{font-size:14px}
      @media(max-width:700px){
        .report-actions{gap:4px}
        .report-btn span{display:none}

      .report-btn{width:36px;min-width:36px;padding:0}
      }
    `;
    document.head.appendChild(style);
  }

  function cleanText(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .replace(/\u00a0/g, " ")
      .trim();
  }

  function getModuleName() {
    const title =
      cleanText(document.querySelector(".page-title h1")?.textContent) ||
      cleanText(document.querySelector(".page-head h2")?.textContent) ||
      cleanText(document.querySelector("h1")?.textContent) ||
      cleanText(document.title).replace(/^OBES ERP\s*-\s*/i, "") ||
      "Modul Raporu";
    return title || "Modul Raporu";
  }

  function getFileSafeName(name) {
    return cleanText(name)
      .replace(/[\\/:*?"<>|]+/g, "-")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase() || "modul-raporu";
  }

  function isElementVisible(element) {
    if (!element) return false;
    const style = window.getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden" && element.offsetParent !== null;
  }

  function shouldSkipColumn(header, columnCells) {
    const label = cleanText(header).toLowerCase();
    if (["islem", "iÅŸlem", "aksiyon", "actions"].includes(label)) return true;
    return columnCells.some((cell) => cell && cell.querySelector("button,a.action-btn,.btn-danger,.action-btn"));
  }

  function extractTable(table, index) {
    if (!isElementVisible(table)) return null;

    const headerCells = Array.from(table.querySelectorAll("thead th"));
    const bodyRows = Array.from(table.querySelectorAll("tbody tr")).filter(isElementVisible);
    const fallbackHeaderCells = headerCells.length ? headerCells : Array.from(table.querySelectorAll("tr:first-child th, tr:first-child td"));

    if (!fallbackHeaderCells.length && !bodyRows.length) return null;

    const columnCount = Math.max(
      fallbackHeaderCells.length,
      ...bodyRows.map((row) => row.children.length),
      0
    );

    const headers = Array.from({ length: columnCount }, (_, columnIndex) => {
      const text = cleanText(fallbackHeaderCells[columnIndex]?.textContent);
      return text || `Sutun ${columnIndex + 1}`;
    });

    const skipColumns = headers.map((header, columnIndex) => {
      const columnCells = bodyRows.map((row) => row.children[columnIndex]).filter(Boolean);
      return shouldSkipColumn(header, columnCells);
    });

    const rows = bodyRows
      .map((row) => Array.from({ length: columnCount }, (_, columnIndex) => {
        if (skipColumns[columnIndex]) return null;
        return cleanText(row.children[columnIndex]?.innerText || row.children[columnIndex]?.textContent);
      }).filter((value) => value !== null))
      .filter((row) => row.some(Boolean) && !row.join(" ").toLowerCase().includes("kayÄ±t bulunamadÄ±") && !row.join(" ").toLowerCase().includes("kayit bulunamadi"));

    const visibleHeaders = headers.filter((_, columnIndex) => !skipColumns[columnIndex]);
    if (!visibleHeaders.length || !rows.length) return null;

    const panelTitle =
      cleanText(table.closest(".panel")?.querySelector(".panel-header h3")?.textContent) ||
      cleanText(table.closest(".card")?.querySelector("h3,h2")?.textContent) ||
      `Tablo ${index + 1}`;

    return {
      title: panelTitle,
      headers: visibleHeaders,
      rows
    };
  }

  function extractSummaries() {
    const cards = Array.from(document.querySelectorAll(".summary-card,.stat-card,.kpi-card,.metric-card"))
      .filter(isElementVisible)
      .map((card) => {
        const label =
          cleanText(card.querySelector("p")?.textContent) ||
          cleanText(card.querySelector("span")?.textContent) ||
          cleanText(card.querySelector("h3")?.textContent);
        const value =
          cleanText(card.querySelector("h4")?.textContent) ||
          cleanText(card.querySelector(".value")?.textContent) ||
          cleanText(card.querySelector("strong")?.textContent);
        return label && value ? [label, value] : null;
      })
      .filter(Boolean);

    return cards.length
      ? [{ title: "Ozet", headers: ["Alan", "Deger"], rows: cards }]
      : [];
  }

  function collectReport() {
    const tables = Array.from(document.querySelectorAll("table"))
      .map(extractTable)
      .filter(Boolean);

    const sections = tables.length ? tables : extractSummaries();
    return {
      moduleName: getModuleName(),
      generatedAt: new Date(),
      sections
    };
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatDate(date) {
    return date.toLocaleString("tr-TR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function buildReportHtml(report) {
    const sectionHtml = report.sections.map((section) => `
      <section class="report-section">
        <h2>${escapeHtml(section.title)}</h2>
        <table>
          <thead>
            <tr>${section.headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr>
          </thead>
          <tbody>
            ${section.rows.map((row) => `
              <tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>
            `).join("")}
          </tbody>
        </table>
      </section>
    `).join("");

    return `<!doctype html>
      <html lang="tr">
      <head>
        <meta charset="utf-8">
        <title>${escapeHtml(report.moduleName)} Raporu</title>
        <style>
          *{box-sizing:border-box}
          body{margin:0;padding:28px;font-family:Arial,sans-serif;color:#172033;background:#fff}
          .report-cover{border-bottom:3px solid #1464ff;padding-bottom:18px;margin-bottom:22px}
          .brand{font-weight:800;font-size:13px;letter-spacing:.14em;color:#2563eb;text-transform:uppercase}
          h1{font-size:26px;margin:8px 0 6px}
          .meta{color:#667085;font-size:13px}
          .report-section{margin:22px 0 30px;break-inside:avoid}
          h2{font-size:17px;margin:0 0 12px;color:#243247}
          table{width:100%;border-collapse:collapse}
          th,td{border:1px solid #dfe7f2;padding:9px 10px;text-align:left;font-size:12px;vertical-align:top}
          th{background:#f5f8fc;color:#344054;font-size:11px;text-transform:uppercase;letter-spacing:.04em}
          tr:nth-child(even) td{background:#fbfcfe}
          @media print{
            body{padding:18mm}
            .report-section{page-break-inside:avoid}
          }
        </style>
      </head>
      <body>
        <div class="report-cover">
          <img src="uploads/documents/obes-logo.png" alt="OBES ERP" style="height:60px;">
          <h1>${escapeHtml(report.moduleName)} Raporu</h1>
          <div class="meta">Olusturma zamani: ${escapeHtml(formatDate(report.generatedAt))}</div>
        </div>
        ${sectionHtml}
      </body>
      </html>`;
  }

  function showNoDataMessage() {
    if (window.appAlert) {
      window.appAlert("Bu modulde rapora aktarilacak gorunur tablo bulunamadi.", "warning");
    } else {
      window.alert("Bu modulde rapora aktarilacak gorunur tablo bulunamadi.");
    }
  }

  function exportExcel() {
    const report = collectReport();
    if (!report.sections.length) {
      showNoDataMessage();
      return;
    }

    const workbookHtml = buildReportHtml(report);
    const blob = new Blob(["\ufeff", workbookHtml], {
      type: "application/vnd.ms-excel;charset=utf-8"
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${getFileSafeName(report.moduleName)}-raporu.xls`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    if (window.appAlert) window.appAlert("Excel raporu indiriliyor.", "success");
  }

  function exportPdf() {
    const report = collectReport();
    if (!report.sections.length) {
      showNoDataMessage();
      return;
    }

    const reportWindow = window.open("", "_blank", "width=1200,height=800");
    if (!reportWindow) {
      if (window.appAlert) window.appAlert("PDF penceresi acilamadi. Tarayici popup iznini kontrol et.", "warning");
      return;
    }

    reportWindow.document.open();
    reportWindow.document.write(buildReportHtml(report));
    reportWindow.document.close();
    reportWindow.focus();
    setTimeout(() => {
      reportWindow.print();
    }, 350);

    if (window.appAlert) window.appAlert("PDF icin yazdirma penceresi hazirlaniyor.", "info");
  }

  function createButton(type, label, iconClass, handler) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `report-btn ${type}`;
    button.innerHTML = `<i class="fa-solid ${iconClass}"></i><span>${label}</span>`;
    button.title = `${label} raporu al`;
    button.addEventListener("click", handler);
    return button;
  }

  function installButtons() {
    injectStyle();
    if (document.querySelector(".report-actions")) return;
    if (!document.querySelector("table,.summary-card,.stat-card,.kpi-card,.metric-card")) return;

    const holder = document.createElement("div");
    holder.className = "report-actions";
    holder.appendChild(createButton("excel", "Excel", "fa-file-excel", exportExcel));
    holder.appendChild(createButton("pdf", "PDF", "fa-file-pdf", exportPdf));

    const firstTable = document.querySelector("table");
    const listPanel = firstTable?.closest(".panel");
    const panelHeader = listPanel?.querySelector(".panel-header");
    if (panelHeader) {
      holder.classList.add("report-inline");
      let tools = panelHeader.querySelector(".report-panel-tools");
      if (!tools) {
        tools = document.createElement("div");
        tools.className = "report-panel-tools";
        Array.from(panelHeader.children).forEach((child) => {
          if (!child.matches("h1,h2,h3,h4,.report-panel-tools")) {
            tools.appendChild(child);
          }
        });
        panelHeader.appendChild(tools);
      }
      tools.appendChild(holder);
      return;
    }

    const tableWrap = firstTable?.closest(".table-wrap") || firstTable?.parentElement;
    if (tableWrap?.parentElement) {
      const toolbar = document.createElement("div");
      toolbar.className = "report-toolbar";
      toolbar.appendChild(holder);
      tableWrap.parentElement.insertBefore(toolbar, tableWrap);
      return;
    }

    const pageHead = document.querySelector(".page-head");
    if (pageHead) {
      pageHead.appendChild(holder);
    }
  }

  ready(installButtons);

  window.OBESModuleReports = {
    collect: collectReport,
    excel: exportExcel,
    pdf: exportPdf
  };
})();
