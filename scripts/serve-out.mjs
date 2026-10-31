// Minimal static server for the exported site in out/: dir/ → dir/index.html, unknown paths → 404.html.
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";

const root = join(process.cwd(), "out");
const port = Number(process.env.PORT ?? 4173);
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".mp4": "video/mp4",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

function resolve(urlPath) {
  const safe = normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[/\\])+/, "");
  let file = join(root, safe);
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
  return existsSync(file) ? file : null;
}

createServer((req, res) => {
  const file = resolve(new URL(req.url ?? "/", "http://localhost").pathname);
  const status = file ? 200 : 404;
  const body = file ?? join(root, "404.html");
  res.writeHead(status, { "Content-Type": types[extname(body)] ?? "application/octet-stream" });
  createReadStream(body).pipe(res);
}).listen(port, () => console.log(`Serving out/ on http://localhost:${port}`));
