import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";

const root = resolve(process.argv.includes("--dist") ? "dist" : ".");
const mime = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml" };
const server = createServer((request, response) => {
  const requestPath = decodeURIComponent((request.url ?? "/").split("?")[0]);
  const relative = normalize(requestPath).replace(/^([/\\])+/, "");
  let file = join(root, relative || "index.html");
  if (!file.startsWith(root) || !existsSync(file)) file = join(root, "index.html");
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
  response.writeHead(200, { "Content-Type": mime[extname(file)] ?? "application/octet-stream", "Cache-Control": "no-store" });
  createReadStream(file).pipe(response);
});
server.listen(4173, "127.0.0.1", () => console.log("Игра запущена: http://localhost:4173"));

