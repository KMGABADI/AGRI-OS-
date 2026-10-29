const initialized = new WeakSet<object>();
let regular: Promise<string> | undefined, bold: Promise<string> | undefined;
const load = async (url: string) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error("PDF font could not be loaded");
  const bytes = new Uint8Array(await r.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192)
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary);
};
export async function pdfFont(doc: any) {
  if (initialized.has(doc)) return;
  regular ??= load("/fonts/RifanSans.ttf");
  bold ??= load("/fonts/RifanSans-Bold.ttf");
  const [normal, b] = await Promise.all([regular, bold]);
  doc.addFileToVFS("RifanSans.ttf", normal);
  doc.addFont("RifanSans.ttf", "RifanSans", "normal");
  doc.addFileToVFS("RifanSans-Bold.ttf", b);
  doc.addFont("RifanSans-Bold.ttf", "RifanSans", "bold");
  doc.setFont("RifanSans", "normal");
  initialized.add(doc);
}
