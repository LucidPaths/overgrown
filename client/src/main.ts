import { SIM_VERSION } from "@overgrown/sim/version";

const app = document.getElementById("app");
if (!app) {
  throw new Error("overgrown: #app element is missing from index.html");
}
app.textContent = `overgrown — sim v${SIM_VERSION}`;
