import { cp, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const dist = resolve(root, "dist");
await rm(dist, { recursive: true, force: true });
await mkdir(resolve(dist, "src"), { recursive: true });
await cp(resolve(root, "index.html"), resolve(dist, "index.html"));
await cp(resolve(root, "style.css"), resolve(dist, "style.css"));
for (const file of ["app.js", "game-data.js", "game-model.js"]) await cp(resolve(root, "src", file), resolve(dist, "src", file));
console.log("Сборка готова: dist/");

