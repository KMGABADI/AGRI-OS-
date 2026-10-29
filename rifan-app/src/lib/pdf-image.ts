/** Rasterize branded images at print resolution so a batch does not embed full source PNGs. */
export async function pdfImage(url: string, maxDimension = 600) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("PDF image could not be loaded");
  const bitmap = await createImageBitmap(await response.blob());
  const scale = Math.min(
    1,
    maxDimension / Math.max(bitmap.width, bitmap.height),
  );
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("PDF image renderer is unavailable");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.9);
}
