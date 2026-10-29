export async function parseBoundary(file: File) {
  if (file.size > 10 * 1024 * 1024)
    throw new Error("Keep boundary files under 10 MB");
  let data: any;
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "zip") {
    const shp = await import("shpjs");
    data = await shp.default(await file.arrayBuffer());
    if (Array.isArray(data))
      data = {
        type: "FeatureCollection",
        features: data.flatMap((d: any) => d.features || []),
      };
  } else if (ext === "kml" || ext === "gpx") {
    const tj = await import("@tmcw/togeojson");
    const xml = new DOMParser().parseFromString(
      await file.text(),
      "application/xml",
    );
    if (xml.querySelector("parsererror"))
      throw new Error("Invalid XML boundary");
    data = ext === "kml" ? tj.kml(xml) : tj.gpx(xml);
  } else data = JSON.parse(await file.text());
  if (
    !data ||
    !["Feature", "FeatureCollection", "Polygon", "MultiPolygon"].includes(
      data.type,
    )
  )
    throw new Error("Upload valid GeoJSON geographic features");
  return data;
}
