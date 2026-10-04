import { App } from "./app/App";

const root = document.getElementById("app");
if (!root) {
  throw new Error("Missing app root element.");
}

const app = new App(root);
app.start();

if (import.meta.env.DEV) {
  // Handy for inspecting the model from the browser console: app.model, app.spec, ...
  (window as unknown as { app: App }).app = app;
}
