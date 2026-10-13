// Material slots. A mesh stores slot ids; each character supplies a palette (lit colour + shade colour per slot)
// as uniforms, so dye, greying and colour morphs never rebuild a mesh.
export const M = {
  skin: 0, // skin, fur, feathers or scales: the body's base
  skin2: 1, // secondary covering: muzzle, belly, chest blaze
  mark: 2, // markings: ear tips, socks, stripes, spots
  hair: 3, // hair, mane, crest, head feathers
  cloth1: 4, // dye channel A
  cloth2: 5, // dye channel B
  leather: 6,
  metal: 7,
  wood: 8,
  boot: 9,
  horn: 10, // beak, claws, tusks, horns, nails, hooves
  dark: 11, // nose leather, mouth inside, pads
  gold: 12,
  inner: 13, // ear insides, tongue, gums
  scar: 14, // scar tissue (aging)
  glow: 15, // magic, unlit
} as const;
export const MATS = 16;

export type RGB = [number, number, number];

export interface MatDef {
  /** lit albedo, 0..1 */
  lit: RGB;
  /** shade albedo: what the colour becomes on the dark side (before the scene's shade tint) */
  shade: RGB;
  /** 0 matte, 1 metal, 2 glossy (eyes, beaks), 3 unlit glow */
  kind: number;
}

export function hex(h: number): RGB {
  return [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
}

/**
 * The shade colour of a material is chosen, not computed by multiplying with grey (the GGXrd rule): a less solid
 * material lets light through and its shade stays lighter and warmer. Skin and fur shade toward a warm red,
 * cloth toward a cooler, more saturated version of itself, metal toward a deep blue.
 */
export function shadeOf(c: RGB, kind: "skin" | "fur" | "cloth" | "metal" | "hard" = "cloth"): RGB {
  const [r, g, b] = c;
  switch (kind) {
    case "skin": return [r * 0.78, g * 0.5, b * 0.52];
    case "fur": return [r * 0.66, g * 0.48, b * 0.5];
    case "metal": return [r * 0.32, g * 0.36, b * 0.5];
    case "hard": return [r * 0.6, g * 0.5, b * 0.52];
    default: {
      // cooler and a little more saturated
      const l = (r + g + b) / 3;
      return [Math.max(0, (r - l) * 1.15 + l) * 0.55, Math.max(0, (g - l) * 1.15 + l) * 0.55, Math.max(0, (b - l) * 1.15 + l) * 0.68];
    }
  }
}

export function mat(c: number | RGB, kind: Parameters<typeof shadeOf>[1] = "cloth", k = 0): MatDef {
  const lit = typeof c === "number" ? hex(c) : c;
  return { lit, shade: shadeOf(lit, kind), kind: k };
}

/** Cloth dyes: medium chroma, so hits, magic and loot (the pop colours) still out-shout clothes. */
export const DYES: RGB[] = [
  hex(0xb8473e), // madder red
  hex(0x3d6fae), // woad blue
  hex(0xd39b32), // weld yellow
  hex(0x5f8a3a), // moss green
  hex(0x7d4a9a), // lichen purple
  hex(0x2f8a82), // verdigris teal
  hex(0xc56a86), // rose
  hex(0x7a5a40), // walnut brown
  hex(0xe2d8bf), // undyed wool
  hex(0x3a3a48), // soot black
];
