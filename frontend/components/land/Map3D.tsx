"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { Map, NavigationControl, setWorkerUrl, type RasterDEMSourceSpecification } from "maplibre-gl";
import { useEffect, useRef } from "react";
import { IMAGERY, IMAGERY_ATTR, TERRAIN, TERRAIN_ATTR, type LatLng } from "@/lib/map";

setWorkerUrl("/maplibre-gl-worker.mjs"); // copied to public/ by predev/prebuild (see package.json)

// 3D view: satellite imagery draped on real terrain (MapLibre), field outline on top. Loaded only when opened.
export default function Map3D({ center, boundary }: { center: LatLng; boundary?: LatLng[] }) {
  const el = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const dem: RasterDEMSourceSpecification = { type: "raster-dem", tiles: [TERRAIN], tileSize: 256, encoding: "terrarium", maxzoom: 15, attribution: TERRAIN_ATTR };
    const map = new Map({
      container: el.current!,
      style: {
        version: 8,
        sources: {
          imagery: { type: "raster", tiles: [IMAGERY], tileSize: 256, maxzoom: 19, attribution: IMAGERY_ATTR },
          terrain: dem,
          relief: dem, // separate source for hillshade, as MapLibre recommends alongside terrain
        },
        layers: [
          { id: "imagery", type: "raster", source: "imagery" },
          { id: "relief", type: "hillshade", source: "relief", paint: { "hillshade-exaggeration": 0.25 } },
        ],
      },
      center: [center[1], center[0]],
      zoom: 15,
      pitch: 65,
      bearing: -20,
      maxPitch: 80,
    });
    map.addControl(new NavigationControl({ visualizePitch: true }));
    map.on("load", () => {
      map.setTerrain({ source: "terrain", exaggeration: 2 }); // flat farmland needs a lift to read as 3D
      if (!boundary?.length) return;
      const ring = [...boundary, boundary[0]].map(([lat, lng]) => [lng, lat]);
      map.addSource("field", { type: "geojson", data: { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [ring] } } });
      map.addLayer({ id: "field-fill", type: "fill", source: "field", paint: { "fill-color": "#E09A2E", "fill-opacity": 0.25 } });
      map.addLayer({ id: "field-line", type: "line", source: "field", paint: { "line-color": "#E09A2E", "line-width": 3 } });
      const lngs = ring.map((p) => p[0]), lats = ring.map((p) => p[1]);
      map.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], { padding: 60, pitch: 65, bearing: -20 });
    });
    return () => map.remove();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={el} className="h-full w-full" />;
}
