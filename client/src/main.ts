import { SIM_VERSION } from "@overgrown/sim/version";
import { Application, Text, TextStyle, TextureStyle } from "pixi.js";

const root = document.getElementById("app");
if (!root) {
  throw new Error("overgrown: #app element is missing from index.html");
}

// Pixel art: sample textures with nearest-neighbor. Must be set before any texture exists.
TextureStyle.defaultOptions.scaleMode = "nearest";

try {
  const app = new Application();
  await app.init({
    resizeTo: window,
    background: "#1d2b22",
    antialias: false,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  });
  root.appendChild(app.canvas);

  const debugText = new Text({
    text: `overgrown · sim v${SIM_VERSION}`,
    style: new TextStyle({ fill: "#ffffff", fontSize: 12, fontFamily: "monospace" }),
  });
  debugText.position.set(4, 4);
  app.stage.addChild(debugText);
} catch (error) {
  console.error(error);
  const message = error instanceof Error ? error.message : String(error);
  root.textContent = `overgrown couldn't start the renderer: ${message}`;
}
