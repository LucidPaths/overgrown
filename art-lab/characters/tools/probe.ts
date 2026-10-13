import { buildSpecies, SPECIES } from "../src/body/species";
import { applyGear } from "../src/body/gear";
import { Field, newAttrs } from "../src/sdf/field";
const { model, j, b } = buildSpecies(SPECIES[0]!);
applyGear(model, b, j, ["tunic", "trousers", "boots", "belt"]);
const f = new Field(model);
const at = newAttrs(model);
const h = j.headC;
for (const p of [[0, h[1], h[2] + b.head[2]], [0, h[1] + 2, h[2] + b.head[2] * 0.9], [b.head[0], h[1], h[2]]] as const) {
  const d = f.full(p[0], p[1], p[2], at);
  console.log(p.map((v) => v.toFixed(1)).join(","), "d", d.toFixed(2), "layer", at.layer, "mat", [...at.mats].map((v, i) => [i, v]).filter((e) => e[1]! > 0.01).map((e) => `${e[0]}:${e[1]!.toFixed(2)}`).join(" "));
}
console.log("shells", model.shells.map((s) => (s ? `shell(base ${s.base}, t ${s.thickness})` : "solid")).join(" | "));
for (let l = 0; l < model.shells.length; l++) console.log(l, model.prims.filter((p) => p.layer === l).map((p) => `${p.kind}/${p.op}`).join(" "));
import { buildLook } from "../src/body/look";
const built = buildLook({ species: 0, gear: ["tunic", "trousers", "boots", "belt"], weapon: "sword" });
const r = built.raw;
const hist = new Map<string, number>();
for (let v = 0; v < r.vertexCount; v++) {
  const x = r.pos[v * 3]!, y = r.pos[v * 3 + 1]!, z = r.pos[v * 3 + 2]!;
  if (y > h[1] - 3 && y < h[1] + 2 && z > h[2] + 2) {
    const k = `m0=${r.mat[v * 4]} m1=${r.mat[v * 4 + 1]} L${r.layer[v]}`;
    hist.set(k, (hist.get(k) ?? 0) + 1);
  }
}
console.log([...hist.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8));
let shown = 0;
for (let v = 0; v < r.vertexCount && shown < 4; v++) {
  const x = r.pos[v * 3]!, y = r.pos[v * 3 + 1]!, z = r.pos[v * 3 + 2]!;
  if (y > h[1] - 3 && y < h[1] + 2 && z > h[2] + 2 && r.layer[v] === 2) {
    shown++;
    const ff = f as unknown as { layerDist(i: number, x: number, y: number, z: number, a: null): number; chain(p: unknown[], x: number, y: number, z: number, a: null): number; plans: { prims: unknown[] }[] };
    console.log([x, y, z].map((q) => q.toFixed(2)).join(","), "body", ff.layerDist(0, x, y, z, null).toFixed(2), "tunic", ff.layerDist(2, x, y, z, null).toFixed(2), "mask", ff.chain(ff.plans[2]!.prims, x, y, z, null).toFixed(2));
  }
}
