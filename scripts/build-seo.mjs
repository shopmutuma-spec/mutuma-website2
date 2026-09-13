import { writeFileSync } from "node:fs";
import { products } from "../js/products.js";
const pages = ["/", "/shop", "/categories", "/about.html", "/contact.html", "/delivery.html", "/returns.html", "/privacy.html", "/terms.html"];
const urls = [...pages, ...products.map((product) => `/product?id=${encodeURIComponent(product.id)}`)];
const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls.map((path) => `    <url><loc>https://mutumas.com${path.replace(/&/g, "&amp;")}</loc></url>`).join("\n") + '\n</urlset>\n';
writeFileSync("sitemap.xml", xml);
console.log(`Generated sitemap with ${urls.length} public URLs from the bundled catalog.`);
