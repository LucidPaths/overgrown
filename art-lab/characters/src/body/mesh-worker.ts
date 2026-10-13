// Sculpts and meshes characters off the main thread. One message in (a Look), one out (the mesh and its rig);
// the typed arrays are transferred, not copied.
import { buildLook, type Look } from "./look";

self.onmessage = (e: MessageEvent<{ id: number; look: Look }>) => {
  const { id, look } = e.data;
  try {
    const b = buildLook(look);
    const r = b.raw;
    const copy = { ...r, pos: r.pos.slice(), nrm: r.nrm.slice(), mat: r.mat.slice(), boneIdx: r.boneIdx.slice(), boneW: r.boneW.slice(), layer: r.layer.slice(), index: r.index.slice() };
    const out = { ...b, raw: copy };
    (self as unknown as Worker).postMessage({ id, built: out }, [copy.pos.buffer, copy.nrm.buffer, copy.mat.buffer, copy.boneIdx.buffer, copy.boneW.buffer, copy.layer.buffer, copy.index.buffer]);
  } catch (err) {
    (self as unknown as Worker).postMessage({ id, error: err instanceof Error ? `${err.message}\n${err.stack}` : String(err) });
  }
};
