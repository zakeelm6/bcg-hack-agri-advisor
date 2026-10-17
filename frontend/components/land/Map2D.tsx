"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/farm";
import { IMAGERY, IMAGERY_ATTR, type LatLng } from "@/lib/map";
import { Button } from "@/components/ui";

type Api = { start: () => void; done: () => void; cancel: () => void };

// Measure view: Leaflet satellite map + leaflet-measure for the area. Loaded only when this view is opened.
// The plugin's own (English-only) panel is hidden; big translated buttons drive it instead.
export default function Map2D({ center, boundary, onSave }: { center: LatLng; boundary?: LatLng[]; onSave: (pts: LatLng[], m2: number) => void }) {
  const t = useT();
  const el = useRef<HTMLDivElement>(null);
  const api = useRef<Api>(null);
  const save = useRef(onSave);
  save.current = onSave;
  const [drawing, setDrawing] = useState(false);
  const [tooFew, setTooFew] = useState(false);

  useEffect(() => {
    let map: import("leaflet").Map | undefined;
    let alive = true;
    (async () => {
      const L = (await import("leaflet")).default;
      (window as any).L = L; // leaflet-measure's bundle extends the global L
      await import("leaflet-measure");
      if (!alive || !el.current) return;
      const M = (L.Control as any).Measure;
      // Leaflet >= 1.8 auto-pans to the invisible capture marker on every tap (ljagis/leaflet-measure#171).
      M.include({
        _setCaptureMarkerIcon(this: any) {
          this._captureMarker.options.autoPanOnFocus = false;
          this._captureMarker.setIcon(L.divIcon({ iconSize: this._map.getSize().multiplyBy(2) }));
        },
      });

      map = L.map(el.current).setView(center, 15);
      L.tileLayer(IMAGERY, { maxZoom: 19, attribution: IMAGERY_ATTR }).addTo(map);
      const field = L.polygon(boundary ?? [], { color: "#E09A2E", weight: 3, fillOpacity: 0.2 }).addTo(map);
      if (boundary?.length) map.fitBounds(field.getBounds(), { padding: [24, 24] });

      const measure = new M({ primaryAreaUnit: "hectares", activeColor: "#E09A2E", completedColor: "#E09A2E" }).addTo(map);
      let keep = false;
      map.on("measurefinish", (m: any) => {
        setDrawing(false);
        if (!keep) return;
        const pts: LatLng[] = m.points.map((p: { lat: number; lng: number }) => [p.lat, p.lng]);
        field.setLatLngs(pts);
        map!.fitBounds(field.getBounds(), { padding: [24, 24] });
        save.current(pts, m.area);
      });
      api.current = {
        start: () => { setTooFew(false); setDrawing(true); measure._startMeasure(); },
        done: () => {
          if (measure._latlngs.length < 3) return setTooFew(true);
          keep = true;
          measure._handleMeasureDoubleClick(); // fires measurefinish with area (m²) and points
          keep = false;
          measure._layer.clearLayers(); // drop the plugin's own result shape and English popup
        },
        cancel: () => { keep = false; measure._finishMeasure(); },
      };
    })();
    return () => { alive = false; map?.remove(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative h-full w-full">
      <div ref={el} className="h-full w-full [&_.leaflet-control-measure]:hidden" />
      <div className="absolute inset-x-3 bottom-3 z-[1000] flex flex-col gap-2">
        {drawing && <p className="rounded-lg bg-surface/95 px-3 py-2 text-center text-sm font-medium">{tooFew ? t("drawMore") : t("drawHelp")}</p>}
        {drawing ? (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => api.current?.cancel()}>{t("cancel")}</Button>
            <Button variant="accent" icon="check" onClick={() => api.current?.done()}>{t("done")}</Button>
          </div>
        ) : (
          <Button variant="accent" icon="walk" className="shadow-2" onClick={() => api.current?.start()}>{boundary?.length ? t("redrawField") : t("drawField")}</Button>
        )}
      </div>
    </div>
  );
}
