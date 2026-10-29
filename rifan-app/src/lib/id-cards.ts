import type { Row } from "../model";
import { names } from "../model";
import { pdfImage } from "./pdf-image";
import { pdfFont } from "./pdf-font";
import { api } from "./workspace";
import { download } from "./export";
export const cardMembers = async (ids: string[]) =>
  api<Row[]>("/api/cards/records", {
    method: "POST",
    body: JSON.stringify({ ids }),
  });
export function printCards(ids: string[]) {
  if (!ids.length) return;
  const job = crypto.randomUUID();
  sessionStorage.setItem("rifan-print-" + job, JSON.stringify(ids));
  const opened = window.open("/print/cards?job=" + job, "_blank");
  if (!opened)
    throw new Error(
      "Allow pop-ups for this workspace to open the printable card sheet.",
    );
}
export const imageData = pdfImage;
async function draw(doc: any, f: Row, logo: string) {
  await pdfFont(doc);
  const QR = await import("qrcode");
  const qr = await QR.toDataURL("RIFAN:" + f.farmerID, {
    margin: 0,
    width: 150,
    color: { dark: "#194c2b", light: "#ffffff" },
  });
  const w = 100,
    h = 64;
  doc.setFillColor(255, 255, 251);
  doc.rect(0, 0, w, h, "F");
  doc.setFillColor(25, 76, 43);
  doc.rect(0, 0, w, 14, "F");
  doc.addImage(logo, "JPEG", 3, 2, 10, 10);
  doc.setTextColor(255, 255, 255);
  doc.setFont("RifanSans", "bold");
  doc.setFontSize(9);
  doc.text("RIFAN CONNECT", 16, 6);
  doc.setFontSize(4.1);
  doc.text("RICE FARMERS ASSOCIATION OF NIGERIA", 16, 9.3);
  doc.setFontSize(4);
  doc.text("FARMER MEMBERSHIP IDENTITY CARD", 16, 12);
  doc.setDrawColor(180, 154, 70);
  doc.setLineWidth(0.65);
  doc.line(0, 14, w, 14);
  doc.setGState(doc.GState({ opacity: 0.045 }));
  doc.addImage(logo, "JPEG", 38, 18, 38, 38);
  doc.setGState(doc.GState({ opacity: 1 }));
  doc.setFillColor(237, 242, 228);
  doc.roundedRect(5, 20, 20, 24, 2, 2, "F");
  if (f.photo && String(f.photo).startsWith("/api/files/")) {
    try {
      const photo = await imageData(f.photo);
      doc.addImage(
        photo,
        photo.startsWith("data:image/png") ? "PNG" : "JPEG",
        5,
        20,
        20,
        24,
      );
    } catch {
      doc.setTextColor(104, 128, 79);
      doc.setFontSize(17);
      doc.text((f.firstName[0] + f.lastName[0]).toUpperCase(), 15, 35, {
        align: "center",
      });
    }
  } else {
    doc.setTextColor(104, 128, 79);
    doc.setFontSize(17);
    doc.text((f.firstName[0] + f.lastName[0]).toUpperCase(), 15, 35, {
      align: "center",
    });
  }
  doc.setTextColor(25, 76, 43);
  doc.setFont("RifanSans", "bold");
  doc.setFontSize(8.5);
  doc.text(doc.splitTextToSize(names(f).toUpperCase(), 65).slice(0, 2), 30, 23);
  doc.setFontSize(6);
  doc.text(String(f.farmerID), 30, 33);
  doc.setFont("RifanSans", "normal");
  doc.setFontSize(5);
  doc.text(`${f.state} / ${f.lga}`.toUpperCase(), 30, 38);
  doc.text(`PHONE: ${f.primaryPhone || "NOT RECORDED"}`, 30, 42);
  doc.text(
    `REGISTERED: ${f.registrationDate || f.registrationYear || "NOT RECORDED"}`,
    5,
    50,
  );
  doc.text(
    `STATUS: ${String(f.membershipStatus || f.profileStatus || "PENDING").toUpperCase()}`,
    5,
    54,
  );
  doc.addImage(qr, "PNG", 82, 44, 13, 13);
  doc.setFillColor(25, 76, 43);
  doc.rect(0, 59, w, 5, "F");
  doc.setTextColor(225, 226, 192);
  doc.setFontSize(4.6);
  doc.text("GROWING TOGETHER. FEEDING A NATION.", 50, 62.3, {
    align: "center",
  });
}
export async function exportCards(
  farmers: Row[],
  logoUrl = "/rifan-logo.png",
  separate = false,
) {
  if (!farmers.length) throw new Error("Select at least one member");
  if (farmers.length > 500)
    throw new Error(
      "Export up to 500 cards per batch to keep printing reliable.",
    );
  const { jsPDF } = await import("jspdf");
  const logo = await imageData(logoUrl);
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: [100, 64],
    putOnlyUsedFonts: true,
    compress: true,
  });
  const files: Record<string, Uint8Array> = {};
  for (let i = 0; i < farmers.length; i++) {
    if (i && !separate) doc.addPage([100, 64], "landscape");
    const current = separate
      ? new jsPDF({
          orientation: "landscape",
          unit: "mm",
          format: [100, 64],
          putOnlyUsedFonts: true,
          compress: true,
        })
      : doc;
    await draw(current, farmers[i], logo);
    if (separate)
      files[
        `${String(farmers[i].farmerID).replace(/[^A-Za-z0-9_-]/g, "_")}.pdf`
      ] = new Uint8Array(current.output("arraybuffer"));
  }
  await api("/api/cards/log", {
    method: "POST",
    body: JSON.stringify({
      ids: farmers.map((f) => f.id),
      kind: separate ? "ZIP" : "PDF",
    }),
  });
  if (separate) {
    const { zipSync } = await import("fflate");
    download(
      "RIFAN-member-cards.zip",
      zipSync(files) as BlobPart,
      "application/zip",
    );
  } else
    doc.save(
      farmers.length === 1
        ? `${farmers[0].farmerID}-id.pdf`
        : "RIFAN-member-cards-" + farmers.length + ".pdf",
    );
}
