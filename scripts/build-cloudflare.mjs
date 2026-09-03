import { cp, mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const output = path.join(root, "dist");
const staticDirectories = new Set(["categories", "css", "hero", "images", "js", "products"]);
const staticFiles = new Set(["_headers", "_redirects", "robots.txt", "sitemap.xml"]);
const staticExtensions = new Set([".html", ".ico", ".jpeg", ".jpg", ".png", ".svg", ".webmanifest", ".webp"]);

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const entry of await readdir(root, { withFileTypes: true })) {
    const include = entry.isDirectory()
        ? staticDirectories.has(entry.name)
        : staticFiles.has(entry.name) || staticExtensions.has(path.extname(entry.name).toLowerCase());
    if (!include) continue;
    await cp(path.join(root, entry.name), path.join(output, entry.name), { recursive: true });
}

console.log("Prepared clean Cloudflare output in dist/.");
