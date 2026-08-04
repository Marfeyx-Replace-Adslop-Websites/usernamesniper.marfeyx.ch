import { cp, mkdir, rm } from "node:fs/promises";

const files = ["index.html", "privacy.html", "terms.html", "404.html", "styles-1.0.css", "app-1.0.js", "app-1.1.js", "claim-platforms-1.0.js", "claim-platforms-1.1.js", "config.js", "CNAME", ".nojekyll", "robots.txt", "sitemap.xml"];
await rm("dist", { recursive: true, force: true });
await mkdir("dist/assets", { recursive: true });
for (const file of files) await cp(file, `dist/${file}`);
await cp("assets/marfeyx-avatar.jpg", "dist/assets/marfeyx-avatar.jpg");
console.log(`Built ${files.length + 1} static assets in dist/`);
