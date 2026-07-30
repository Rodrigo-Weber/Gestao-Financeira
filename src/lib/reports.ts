import { jsPDF } from "jspdf";
import { strToU8, zipSync } from "fflate";
import type { FinanceData } from "../types";
import { calculateSummary, categorySpend } from "./finance";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dateBr = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR");
const statusLabel: Record<string, string> = { paid: "Pago", pending: "Pendente", overdue: "Atrasado", cancelled: "Cancelado" };

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function exportCsv(data: FinanceData) {
  const header = ["Data", "Descrição", "Tipo", "Status", "Categoria", "Conta", "Valor"];
  const rows = data.transactions.map((item) => [
    item.dueDate,
    item.description,
    item.kind,
    statusLabel[item.status],
    data.categories.find((category) => category.id === item.categoryId)?.name ?? "",
    data.accounts.find((account) => account.id === item.accountId)?.name ?? "",
    item.amount.toFixed(2).replace(".", ","),
  ]);
  const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(";")).join("\n");
  download(new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" }), "weber-financeiro.csv");
}

export async function exportExcel(data: FinanceData, month = new Date()) {
  const summary = calculateSummary(data, month);
  const overview: CellValue[][] = [
    ["Weber Financeiro", "Resumo mensal"],
    ["Saldo realizado", summary.realizedBalance],
    ["Saldo projetado", summary.projectedBalance],
    ["Receitas realizadas", summary.realizedIncome],
    ["Despesas realizadas", summary.realizedExpense],
    ["Despesas previstas", summary.pendingExpense],
  ];
  const transactionRows: CellValue[][] = [
    ["Data", "Descrição", "Tipo", "Status", "Categoria", "Conta", "Valor"],
    ...data.transactions.map((item) => [
      item.dueDate, item.description, item.kind, statusLabel[item.status],
      data.categories.find((category) => category.id === item.categoryId)?.name ?? "",
      data.accounts.find((account) => account.id === item.accountId)?.name ?? "", item.amount,
    ]),
  ];
  const debtRows: CellValue[][] = [
    ["Dívida", "Credor", "Saldo devedor", "Juros mensais", "Parcela mínima"],
    ...data.debts.map((debt) => [debt.name, debt.creditor, debt.outstandingBalance, debt.monthlyInterest / 100, debt.minimumPayment]),
  ];
  const bytes = createXlsx([
    { name: "Resumo", rows: overview, currencyColumns: [1] },
    { name: "Transações", rows: transactionRows, currencyColumns: [6], filter: true },
    { name: "Dívidas", rows: debtRows, currencyColumns: [2, 4], percentColumns: [3], filter: true },
  ]);
  download(new Blob([bytes.buffer as ArrayBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "weber-financeiro.xlsx");
}

type CellValue = string | number;
interface SheetDefinition { name: string; rows: CellValue[][]; currencyColumns?: number[]; percentColumns?: number[]; filter?: boolean }

function escapeXml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function columnName(index: number) {
  let result = "";
  for (let value = index + 1; value > 0; value = Math.floor((value - 1) / 26)) result = String.fromCharCode(65 + ((value - 1) % 26)) + result;
  return result;
}

function worksheetXml(sheet: SheetDefinition) {
  const rows = sheet.rows.map((row, rowIndex) => {
    const cells = row.map((value, columnIndex) => {
      const ref = `${columnName(columnIndex)}${rowIndex + 1}`;
      const style = rowIndex === 0 ? 1 : sheet.currencyColumns?.includes(columnIndex) ? 2 : sheet.percentColumns?.includes(columnIndex) ? 3 : 0;
      return typeof value === "number"
        ? `<c r="${ref}" s="${style}"><v>${value}</v></c>`
        : `<c r="${ref}" s="${style}" t="inlineStr"><is><t>${escapeXml(value)}</t></is></c>`;
    }).join("");
    return `<row r="${rowIndex + 1}">${cells}</row>`;
  }).join("");
  const lastCell = `${columnName(Math.max(0, sheet.rows[0]?.length - 1))}${Math.max(1, sheet.rows.length)}`;
  const filter = sheet.filter ? `<autoFilter ref="A1:${lastCell}"/>` : "";
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${lastCell}"/><sheetViews><sheetView workbookViewId="0" tabSelected="1"/></sheetViews><sheetFormatPr defaultRowHeight="15"/><sheetData>${rows}</sheetData>${filter}</worksheet>`;
}

function createXlsx(sheets: SheetDefinition[]) {
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`;
  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((sheet, index) => `<sheet name="${escapeXml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join("")}</sheets></workbook>`;
  const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join("")}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="2"><numFmt numFmtId="164" formatCode="&quot;R$&quot; #,##0.00"/><numFmt numFmtId="165" formatCode="0.00%"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Arial"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Arial"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0B654D"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border/></borders><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="1" borderId="0" xfId="0" applyFill="1" applyFont="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs></styleSheet>`;
  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(contentTypes),
    "_rels/.rels": strToU8(rootRels),
    "xl/workbook.xml": strToU8(workbook),
    "xl/_rels/workbook.xml.rels": strToU8(workbookRels),
    "xl/styles.xml": strToU8(styles),
  };
  sheets.forEach((sheet, index) => { files[`xl/worksheets/sheet${index + 1}.xml`] = strToU8(worksheetXml(sheet)); });
  return zipSync(files, { level: 6 });
}

export function exportPdf(data: FinanceData, month = new Date()) {
  const doc = new jsPDF();
  const summary = calculateSummary(data, month);
  const categories = categorySpend(data, month).slice(0, 5);
  doc.setFillColor(7, 28, 23);
  doc.rect(0, 0, 210, 42, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.text("Weber Financeiro", 16, 19);
  doc.setFontSize(10);
  doc.text(`Relatório gerado em ${new Date().toLocaleDateString("pt-BR")}`, 16, 28);
  doc.setTextColor(24, 36, 32);
  doc.setFontSize(13);
  doc.text("Resumo do mês", 16, 56);
  doc.setFontSize(10);
  doc.text(`Saldo realizado: ${brl.format(summary.realizedBalance)}`, 16, 67);
  doc.text(`Saldo projetado: ${brl.format(summary.projectedBalance)}`, 16, 75);
  doc.text(`Receitas: ${brl.format(summary.realizedIncome)}`, 108, 67);
  doc.text(`Despesas: ${brl.format(summary.realizedExpense)}`, 108, 75);
  doc.setFontSize(13);
  doc.text("Maiores categorias", 16, 92);
  categories.forEach((item, index) => {
    doc.setFontSize(10);
    doc.text(`${item.name}: ${brl.format(item.value)}`, 16, 103 + index * 8);
  });
  doc.setFontSize(13);
  doc.text("Últimas transações", 16, 151);
  data.transactions.slice(0, 10).forEach((item, index) => {
    const sign = item.kind === "income" ? "+" : "-";
    doc.setFontSize(9);
    doc.text(`${dateBr(item.dueDate)}  ${item.description}`, 16, 162 + index * 9);
    doc.text(`${sign} ${brl.format(item.amount)}`, 155, 162 + index * 9);
  });
  doc.save("weber-financeiro.pdf");
}
