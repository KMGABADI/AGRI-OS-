import { pdfImage } from "./pdf-image";
import { pdfFont } from "./pdf-font";
import { api } from "./workspace";
import type { Row } from "../model";
export function download(
  name: string,
  content: BlobPart,
  type = "text/csv;charset=utf-8",
) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function safeCell(value: any) {
  const s = String(value ?? "");
  return /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
}
export async function exportRows(name: string, rows: Row[], keys?: string[]) {
  const columns = keys || [
    "farmerID",
    "firstName",
    "middleName",
    "lastName",
    "gender",
    "primaryPhone",
    "country",
    "state",
    "lga",
    "ward",
    "community",
    "crop",
    "farmSize",
    "plantingDate",
    "harvestDate",
    "profileStatus",
    "kycComplete",
    "registrationDate",
    "membershipStatus",
    "paymentStatus",
  ];
  const quote = (v: any) => '"' + safeCell(v).replaceAll('"', '""') + '"';
  await api("/api/export/log", {
    method: "POST",
    body: JSON.stringify({
      entity: "farmers",
      details: `Exported ${rows.length} records as CSV`,
    }),
  });
  download(
    name + ".csv",
    "\uFEFF" +
      [columns, ...rows.map((r) => columns.map((k) => r[k]))]
        .map((row) => row.map(quote).join(","))
        .join("\r\n"),
  );
}
export async function exportSpreadsheet(name: string, rows: Row[]) {
  await api("/api/export/log", {
    method: "POST",
    body: JSON.stringify({
      entity: "farmers",
      details: `Exported ${rows.length} records as XLSX`,
    }),
  });
  const XLSX = await import("xlsx");
  const clean = rows.map((r) =>
    Object.fromEntries(
      Object.entries(r)
        .filter(
          ([k, v]) =>
            ![
              "bvn",
              "nin",
              "accountNumber",
              "documents",
              "farmBoundary",
            ].includes(k) && typeof v !== "object",
        )
        .map(([k, v]) => [k, typeof v === "string" ? safeCell(v) : v]),
    ),
  );
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(clean),
    "RIFAN Members",
  );
  XLSX.writeFile(wb, name + ".xlsx");
}
export async function memberPDF(
  farmer: Row,
  type: "id" | "certificate",
  logo = "/rifan-logo.png",
) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: type === "id" ? [100, 64] : "a4",
  });
  await pdfFont(doc);
  const w = doc.internal.pageSize.getWidth(),
    h = doc.internal.pageSize.getHeight();
  doc.setFillColor(252, 251, 246);
  doc.rect(0, 0, w, h, "F");
  doc.setDrawColor(180, 154, 70);
  doc.setLineWidth(type === "id" ? 0.8 : 1.5);
  doc.rect(3, 3, w - 6, h - 6);
  const image = await pdfImage(logo);
  doc.setGState(doc.GState({ opacity: 0.045 }));
  doc.addImage(image, "JPEG", w * 0.3, h * 0.15, w * 0.4, w * 0.4);
  doc.setGState(doc.GState({ opacity: 1 }));
  doc.addImage(image, "JPEG", w * 0.05, h * 0.1, h * 0.25, h * 0.25);
  doc.setTextColor(25, 76, 43);
  doc.setFont("RifanSans", "bold");
  doc.setFontSize(type === "id" ? 10 : 23);
  doc.text("RIFAN CONNECT", w * 0.34, h * 0.2);
  doc.setFontSize(type === "id" ? 5 : 10);
  doc.text("RICE FARMERS ASSOCIATION OF NIGERIA", w * 0.34, h * 0.27);
  doc.setFontSize(type === "id" ? 6 : 15);
  doc.text(
    type === "id" ? "MEMBERSHIP IDENTITY CARD" : "CERTIFICATE OF REGISTRATION",
    w / 2,
    h * 0.43,
    { align: "center" },
  );
  doc.setFontSize(type === "id" ? 11 : 27);
  doc.text(`${farmer.firstName} ${farmer.lastName}`, w / 2, h * 0.58, {
    align: "center",
  });
  doc.setFont("RifanSans", "normal");
  doc.setFontSize(type === "id" ? 6 : 12);
  doc.text(
    `${farmer.farmerID}   |   ${farmer.state} · ${farmer.lga}`,
    w / 2,
    h * 0.69,
    { align: "center" },
  );
  doc.text(
    `Registered: ${farmer.registrationDate || "Not recorded"}   |   Status: ${farmer.membershipStatus || farmer.profileStatus}`,
    w / 2,
    h * 0.79,
    { align: "center" },
  );
  doc.setFontSize(type === "id" ? 5 : 9);
  doc.text("Growing together. Feeding a nation.", w / 2, h * 0.91, {
    align: "center",
  });
  await api("/api/cards/log", {
    method: "POST",
    body: JSON.stringify({
      ids: [farmer.id],
      kind: type === "id" ? "PDF" : "Certificate",
    }),
  });
  doc.save(`${farmer.farmerID}-${type}.pdf`);
}
