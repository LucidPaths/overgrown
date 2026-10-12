// Router: the live prototype by default (statically imported: one less round trip on a slow network);
// ?mode=stage for posed captures; ?mode=static for the bare world view.
import { runGame } from "./game";
const q = new URLSearchParams(location.search);
const canvas = document.getElementById("c") as HTMLCanvasElement;
const mode = q.get("mode") ?? "game";
if (mode === "stage") (await import("./stage")).runStage(canvas, q);
else if (mode === "static") (await import("./static-view")).runStatic(canvas, q);
else runGame(canvas, q);
