import { buildLook } from "../src/body/look";
import { toCharGeo } from "../src/render/char-mesh";
const built = buildLook({ species: 0, gear: ["tunic", "trousers", "boots", "belt"], weapon: "sword" });
for (const [name, P, I] of [["raw", built.raw.pos, built.raw.index], ["geo", toCharGeo(built.raw).pos, toCharGeo(built.raw).index]] as const) {
  let long = 0, max = 0;
  const xs: number[] = [];
  for (let t = 0; t < I.length; t += 3) {
    for (let e = 0; e < 3; e++) {
      const a = I[t + e]!, b = I[t + ((e + 1) % 3)]!;
      const d = Math.hypot(P[a * 3]! - P[b * 3]!, P[a * 3 + 1]! - P[b * 3 + 1]!, P[a * 3 + 2]! - P[b * 3 + 2]!);
      if (d > 2) { long++; if (xs.length < 5) xs.push(P[a * 3]!, P[b * 3]!); }
      max = Math.max(max, d);
    }
  }
  console.log(name, "edges > 2px:", long, "max", max.toFixed(2), xs.map((x) => x.toFixed(1)).join(" "));
}
