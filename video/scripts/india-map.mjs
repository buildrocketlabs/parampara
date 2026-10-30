// Builds src/data/india-states.json (the vision map's state outlines) from DataMeet's Survey of India
// based states shapefile (github.com/datameet/maps, States/Admin2.shp and .dbf, CC BY 4.0). Drawn,
// never generated: India's outline must be the official one.
//   download States/Admin2.shp and Admin2.dbf into an empty folder, then
//   node scripts/india-map.mjs <that folder> src/data/india-states.json
// Equirectangular at 22 N, fitted 1000 wide; rings simplified (Douglas Peucker, 0.9 px); islands
// under 6 px² dropped.
import { readFileSync, writeFileSync } from "node:fs";
const [dir, out] = process.argv.slice(2);
const shp = readFileSync(`${dir}/Admin2.shp`), dbf = readFileSync(`${dir}/Admin2.dbf`);
// dbf: names
const nRec = dbf.readUInt32LE(4), hLen = dbf.readUInt16LE(8), rLen = dbf.readUInt16LE(10);
const fields = []; for (let o = 32; dbf[o] !== 0x0d; o += 32) fields.push({ name: dbf.toString("latin1", o, o + 11).replace(/\0.*$/, ""), len: dbf[o + 16] });
const rows = []; for (let i = 0; i < nRec; i++) { let o = hLen + i * rLen + 1; const r = {}; for (const f of fields) { r[f.name] = dbf.toString("utf8", o, o + f.len).trim(); o += f.len; } rows.push(r); }
// shp: polygons
const shapes = []; let o = 100;
while (o < shp.length) {
  const len = shp.readInt32BE(o + 4) * 2; const c = o + 8; const type = shp.readInt32LE(c);
  if (type === 5) { const np = shp.readInt32LE(c + 36), npt = shp.readInt32LE(c + 40); const parts = []; for (let i = 0; i < np; i++) parts.push(shp.readInt32LE(c + 44 + 4 * i));
    const p0 = c + 44 + 4 * np; const rings = [];
    for (let i = 0; i < np; i++) { const a = parts[i], b = i + 1 < np ? parts[i + 1] : npt; const ring = []; for (let j = a; j < b; j++) ring.push([shp.readDoubleLE(p0 + 16 * j), shp.readDoubleLE(p0 + 16 * j + 8)]); rings.push(ring); }
    shapes.push(rings); } else shapes.push([]);
  o = c + len;
}
// projection: equirectangular scaled by cos(22°), fit 1000 wide
const k = Math.cos((22 * Math.PI) / 180);
let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
for (const s of shapes) for (const r of s) for (const [x, y] of r) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
const W = 1000, S = W / ((maxX - minX) * k), H = (maxY - minY) * S;
const P = ([x, y]) => [(x - minX) * k * S, (maxY - y) * S];
function dp(pts, eps) { if (pts.length < 3) return pts; let dmax = 0, idx = 0; const [ax, ay] = pts[0], [bx, by] = pts[pts.length - 1]; const L = Math.hypot(bx - ax, by - ay) || 1e-9;
  for (let i = 1; i < pts.length - 1; i++) { const d = Math.abs((by - ay) * pts[i][0] - (bx - ax) * pts[i][1] + bx * ay - by * ax) / L; if (d > dmax) { dmax = d; idx = i; } }
  return dmax > eps ? [...dp(pts.slice(0, idx + 1), eps).slice(0, -1), ...dp(pts.slice(idx), eps)] : [pts[0], pts[pts.length - 1]]; }
const EPS = 0.9, MIN_AREA = 6;
const area = (r) => Math.abs(r.reduce((s, [x, y], i) => { const [x2, y2] = r[(i + 1) % r.length]; return s + x * y2 - x2 * y; }, 0) / 2);
const states = shapes.map((rings, i) => {
  let best = null, bestA = 0, d = "";
  for (const ring of rings) { const pr = ring.map(P); const a = area(pr); if (a < MIN_AREA) continue; const h = Math.floor(pr.length / 2); const sr = [...dp(pr.slice(0, h + 1), EPS).slice(0, -1), ...dp(pr.slice(h), EPS)]; if (sr.length < 4) continue;
    if (a > bestA) { bestA = a; best = pr; }
    d += "M" + sr.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join("L") + "Z"; }
  let cx = 0, cy = 0; if (best) { for (const [x, y] of best) { cx += x; cy += y; } cx /= best.length; cy /= best.length; }
  return { name: rows[i]?.ST_NM ?? rows[i]?.NAME ?? Object.values(rows[i] ?? {})[0], d, c: [Math.round(cx), Math.round(cy)] };
}).filter((s) => s.d);
writeFileSync(out, JSON.stringify({ source: "DataMeet India community, States/Admin2 (Survey of India based), CC BY 4.0, github.com/datameet/maps", width: W, height: Math.round(H), projection: { lon0: minX, lat1: maxY, k, scale: S }, states }));
console.log(fields.map((f) => f.name), states.length, "states", Math.round(H), "tall", (JSON.stringify(states).length / 1024).toFixed(0) + " KB");
console.log(states.map((s) => `${s.name} ${s.c}`).join(" | "));
