// A pool of mesh workers. Looks are keyed by geometry, so a crowd of the same outfit is sculpted once.
import { geoKey, type Built, type Look } from "./look";

export class MeshPool {
  private workers: Worker[] = [];
  private next = 0;
  private seq = 0;
  private pending = new Map<number, (b: Built) => void>();
  private byKey = new Map<string, Promise<Built>>();
  readonly done = new Map<string, Built>();
  /** total worker ms spent meshing, for the perf notes */
  ms = 0;

  constructor(n = Math.max(1, Math.min(6, (navigator.hardwareConcurrency || 4) - 1))) {
    for (let i = 0; i < n; i++) {
      const w = new Worker(new URL("./mesh-worker.ts", import.meta.url), { type: "module" });
      w.onmessage = (e: MessageEvent<{ id: number; built?: Built; error?: string }>) => {
        const cb = this.pending.get(e.data.id);
        this.pending.delete(e.data.id);
        if (e.data.error) { console.error(e.data.error); return; }
        this.ms += e.data.built!.raw.ms;
        cb?.(e.data.built!);
      };
      this.workers.push(w);
    }
  }

  get(look: Look): Promise<Built> {
    const key = geoKey(look);
    let p = this.byKey.get(key);
    if (!p) {
      p = new Promise<Built>((res) => {
        const id = ++this.seq;
        this.pending.set(id, (b) => { this.done.set(key, b); res(b); });
        this.workers[this.next++ % this.workers.length]!.postMessage({ id, look });
      });
      this.byKey.set(key, p);
    }
    return p;
  }

  /** The finished build for a look, or undefined (and the request goes out). */
  peek(look: Look): Built | undefined {
    const key = geoKey(look);
    const b = this.done.get(key);
    if (!b) void this.get(look);
    return b;
  }

  get busy(): number {
    return this.pending.size;
  }
}
