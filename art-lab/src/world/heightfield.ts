// Height queries over the chunk reliefs the renderer holds (props stand on it, characters walk on it).
import { RC, type ChunkRelief } from "./relief";

export class HeightField {
  private reliefs = new Map<number, ChunkRelief>();
  private key(cx: number, cy: number): number {
    return (cx + 32768) * 65536 + (cy + 32768);
  }
  add(r: ChunkRelief): void {
    this.reliefs.set(this.key(r.cx, r.cy), r);
  }
  drop(cx: number, cy: number): void {
    this.reliefs.delete(this.key(cx, cy));
  }
  private corner(arr: "h" | "water", ti: number, tj: number): number {
    const cx = Math.floor(ti / 32), cy = Math.floor(tj / 32);
    const r = this.reliefs.get(this.key(cx, cy));
    if (!r) return NaN;
    return r[arr][(tj - cy * 32 + 1) * RC + (ti - cx * 32 + 1)]!;
  }
  private bilinear(arr: "h" | "water", x: number, z: number): number {
    const gx = x / 16, gz = z / 16;
    const i = Math.floor(gx), j = Math.floor(gz);
    const fx = gx - i, fz = gz - j;
    const a = this.corner(arr, i, j), b = this.corner(arr, i + 1, j), c = this.corner(arr, i, j + 1), d = this.corner(arr, i + 1, j + 1);
    return (a * (1 - fx) + b * fx) * (1 - fz) + (c * (1 - fx) + d * fx) * fz;
  }
  /** Ground height at world px (x, z); NaN if that chunk is not loaded. */
  height(x: number, z: number): number {
    return this.bilinear("h", x, z);
  }
  /** Water surface at (x, z), NaN if dry or not loaded. */
  water(x: number, z: number): number {
    const v = this.bilinear("water", x, z);
    return v;
  }
}
