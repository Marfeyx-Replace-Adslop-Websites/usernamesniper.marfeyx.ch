import { readFile } from "node:fs/promises";
import { CLAIM_PLATFORMS } from "../claim-platforms-1.1.js";

if (CLAIM_PLATFORMS.length < 40 || CLAIM_PLATFORMS.length > 100) throw new Error("Username Sniper must expose 40 to 100 curated platforms.");
const ids = new Set();
for (const platform of CLAIM_PLATFORMS) {
  if (!platform.id || ids.has(platform.id)) throw new Error(`Duplicate or missing platform: ${platform.id}`);
  if (new URL(platform.claimUrl).protocol !== "https:") throw new Error(`Unsafe claim URL: ${platform.name}`);
  ids.add(platform.id);
}
const html = await readFile("index.html", "utf8");
for (const asset of ["styles-1.0.css", "app-1.1.js", "claim-platforms-1.1.js", "config.js", "assets/marfeyx-avatar.jpg"]) {
  if (!html.includes(asset) && asset !== "claim-platforms-1.1.js") throw new Error(`Index does not reference ${asset}`);
}
console.log(`Validated ${CLAIM_PLATFORMS.length} claim platforms.`);
