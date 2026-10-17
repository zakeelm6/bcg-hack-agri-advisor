// Map sources: keyless, free. Esri imagery needs its attribution shown; the AWS terrain tiles are Mapzen's open DEM.
export const IMAGERY = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
export const IMAGERY_ATTR = "Imagery © Esri, Maxar, Earthstar Geographics";
export const TERRAIN = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";
export const TERRAIN_ATTR = "Terrain © Mapzen, AWS Open Data";

export type LatLng = [number, number];

const R = 6378137;
// Web Mercator (EPSG:3857), the projection the imagery is served in.
export const mercator = ([lat, lng]: LatLng): [number, number] =>
  [(R * lng * Math.PI) / 180, R * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))];

// Static map: one image of the field from Esri's export endpoint, plus the boundary as SVG pixel coordinates.
// No map library is loaded for this view.
export function staticMap(center: LatLng, boundary: LatLng[] | undefined, w: number, h: number) {
  const pts = (boundary?.length ? boundary : [center]).map(mercator);
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  let cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  // Field fills ~60% of the frame; with no field drawn, show ~1.2 km around the farm.
  let spanX = Math.max(Math.max(...xs) - Math.min(...xs), 1) / 0.6, spanY = Math.max(Math.max(...ys) - Math.min(...ys), 1) / 0.6;
  if (!boundary?.length) spanX = spanY = 1200;
  if (spanX / spanY < w / h) spanX = (spanY * w) / h; else spanY = (spanX * h) / w; // match the image aspect
  const [x0, x1, y0, y1] = [cx - spanX / 2, cx + spanX / 2, cy - spanY / 2, cy + spanY / 2];
  const url = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=${x0},${y0},${x1},${y1}&bboxSR=3857&imageSR=3857&size=${w},${h}&format=jpg&f=image`;
  const outline = (boundary ?? []).map(mercator).map(([x, y]) => [((x - x0) / (x1 - x0)) * w, ((y1 - y) / (y1 - y0)) * h].map((v) => v.toFixed(1)).join(",")).join(" ");
  return { url, outline };
}
