// Router: the live prototype by default; ?mode=stage for posed captures; ?mode=static for the bare world view.
const q = new URLSearchParams(location.search);
const canvas = document.getElementById("c") as HTMLCanvasElement;
const mode = q.get("mode") ?? "game";
if (mode === "stage") (await import("./stage")).runStage(canvas, q);
else if (mode === "static") (await import("./static-view")).runStatic(canvas, q);
else (await import("./game")).runGame(canvas, q);
export {};
