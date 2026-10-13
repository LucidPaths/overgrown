// Character lab router: ?mode=stage (posed captures) | game (the live prototype) | sketch (explorations).
const q = new URLSearchParams(location.search);
const canvas = document.getElementById("c") as HTMLCanvasElement;
const mode = q.get("mode") ?? "game";
const show = (e: unknown) => {
  const el = document.createElement("pre");
  el.className = "err";
  el.textContent = e instanceof Error ? `${e.message}\n${e.stack}` : String(e);
  document.body.appendChild(el);
  console.error(e);
};
window.addEventListener("error", (e) => show(e.error ?? e.message));
try {
  if (mode === "stage") (await import("./stage")).runStage(canvas, q);
  else await (await import("./game")).runGame(canvas, q);
} catch (e) {
  show(e);
}

export {};
