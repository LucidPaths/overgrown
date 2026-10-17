const d = new URLSearchParams(location.search).get("d") ?? "paper";
const canvas = document.getElementById("c") as HTMLCanvasElement;
const t0 = performance.now();
const run = async () => {
  if (d === "paper") (await import("./paper")).drawPaper(canvas);
  else if (d === "ink") (await import("./ink")).drawInk(canvas);
  else if (d === "voxel") await (await import("./voxel")).drawVoxel(canvas);
  console.log(`sketch ${d} drawn in ${Math.round(performance.now() - t0)} ms`);
  (window as unknown as { sketchDone: boolean }).sketchDone = true;
};
run().catch((e) => { console.error(e); (window as unknown as { sketchDone: boolean }).sketchDone = true; });
export {};
