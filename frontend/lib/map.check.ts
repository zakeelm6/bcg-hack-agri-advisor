// Run: node --experimental-strip-types lib/map.check.ts  (fails loudly if the static-map projection breaks)
import assert from "node:assert/strict";
import { mercator, staticMap, type LatLng } from "./map.ts";

assert.deepEqual(mercator([0, 0]).map((v) => Math.round(v) + 0), [0, 0]);
assert.equal(Math.round(mercator([0, 180])[0]), 20037508); // edge of the Web Mercator world

// A square field: its outline must sit centred in the image, inside the frame.
const field: LatLng[] = [[32.63, -8.44], [32.63, -8.43], [32.62, -8.43], [32.62, -8.44]];
const { url, outline } = staticMap(field[0], field, 800, 450);
const pts = outline.split(" ").map((p) => p.split(",").map(Number));
const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
assert.ok(xs.every((x) => x > 0 && x < 800) && ys.every((y) => y > 0 && y < 450), "outline inside frame");
assert.ok(Math.abs((Math.min(...xs) + Math.max(...xs)) / 2 - 400) < 1, "centred horizontally");
assert.ok(Math.abs((Math.min(...ys) + Math.max(...ys)) / 2 - 225) < 1, "centred vertically");
assert.ok(ys[0] < ys[2], "north is up");
assert.match(url, /size=800,450/);

// No boundary yet: still a valid image around the farm.
assert.equal(staticMap([32.63, -8.44], undefined, 800, 450).outline, "");
console.log("map.check ok");
