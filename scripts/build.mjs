import { cp, mkdir, rm } from "node:fs/promises";

const files = ["index.html", "privacy.html", "terms.html", "404.html", "styles-2.0.css", "app-2.0.js", "results-2.0.js", "claim-platforms-2.0.js", "CNAME", ".nojekyll", "robots.txt", "sitemap.xml"];
await rm("dist", { recursive: true, force: true });
await mkdir("dist/assets", { recursive: true });
await mkdir("dist/results", { recursive: true });
for (const file of files) await cp(file, `dist/${file}`);
await cp("assets/marfeyx-avatar.jpg", "dist/assets/marfeyx-avatar.jpg");
await cp("results/index.html", "dist/results/index.html");
console.log(`Built ${files.length + 1} static assets in dist/`);
