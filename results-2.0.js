import { CLAIM_PLATFORMS } from "./claim-platforms-2.0.js";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const RESULT_KEY = "marfeyx-completed-claim-v1";
const CLAIMED_KEY = "marfeyx-claimed-usernames-v1";
const MAX_AGE = 86_400_000;
const platformMap = new Map(CLAIM_PLATFORMS.map(platform => [platform.id, platform]));
const state = { username: "", results: new Map(), partial: false, filter: "all", claimed: loadClaimed() };

function loadSnapshot() {
  let snapshot; try { snapshot = JSON.parse(localStorage.getItem(RESULT_KEY) || "null"); } catch { snapshot = null; }
  if (!snapshot || Date.now() - Number(snapshot.savedAt) > MAX_AGE || !Array.isArray(snapshot.results) || typeof snapshot.username !== "string") { localStorage.removeItem(RESULT_KEY); $("#claim-results-empty").hidden = false; return; }
  state.username = snapshot.username; state.results = new Map(snapshot.results.map(result => [result.platformId, result])); state.partial = Boolean(snapshot.partial);
  $("#claim-results").hidden = false; $("#claim-results-title").textContent = `@${state.username} across ${state.results.size} platforms`; $("#claim-results-kicker").textContent = state.partial ? "Partial claim board" : "Claim board";
  $("#claim-results-summary").textContent = state.partial ? "This check was stopped early. Inconclusive platforms need a manual check." : "Likely available names are ready to confirm on each official platform."; document.title = `@${state.username} — username results`; renderResults();
}

function classify(result) { if (result.status === "found") return "taken"; if (result.status === "not_found" && !/invalid|unsupported/i.test(result.message || "")) return "available"; return "manual"; }
function isClaimed(id) { return Boolean(state.claimed[state.username.toLowerCase()]?.includes(id)); }
function toggleClaimed(id) { const key = state.username.toLowerCase(); const current = new Set(state.claimed[key] || []); current.has(id) ? current.delete(id) : current.add(id); state.claimed[key] = [...current]; localStorage.setItem(CLAIMED_KEY, JSON.stringify(state.claimed)); renderResults(); }
function renderResults() {
  const all = [...state.results.values()]; const counts = { available: all.filter(item => classify(item) === "available").length, taken: all.filter(item => classify(item) === "taken").length, manual: all.filter(item => classify(item) === "manual").length, claimed: all.filter(item => isClaimed(item.platformId)).length };
  Object.entries(counts).forEach(([key, value]) => $(`#claim-stat-${key}`).textContent = value);
  const query = $("#claim-result-search").value.trim().toLowerCase(); const rank = { available: 0, manual: 1, taken: 2 };
  const results = all.filter(result => { const platform = platformMap.get(result.platformId); const matches = state.filter === "all" || (state.filter === "claimed" ? isClaimed(result.platformId) : classify(result) === state.filter); return matches && (!query || `${platform?.name || result.platform} ${platform?.category || ""}`.toLowerCase().includes(query)); }).sort((a, b) => rank[classify(a)] - rank[classify(b)] || (platformMap.get(a.platformId)?.importance || 9) - (platformMap.get(b.platformId)?.importance || 9) || a.platform.localeCompare(b.platform));
  const grid = $("#claim-results-grid"); if (!results.length) { const empty = document.createElement("div"); empty.className = "empty-results"; empty.textContent = "No platforms match this filter."; grid.replaceChildren(empty); } else grid.replaceChildren(...results.map(createCard));
}

function createCard(result) {
  const platform = platformMap.get(result.platformId); const status = classify(result); const claimed = isClaimed(result.platformId); const card = document.createElement("article"); card.className = `claim-card ${status}${claimed ? " is-claimed" : ""}`;
  const icon = document.createElement("div"); icon.className = "claim-platform-icon"; icon.textContent = (platform?.name || result.platform || "?").slice(0, 1).toUpperCase();
  const identity = document.createElement("div"); identity.className = "claim-card-identity"; const title = document.createElement("h3"); title.textContent = platform?.name || result.platform; const meta = document.createElement("p"); meta.textContent = `${platform?.category || "Platform"} · @${state.username}`; identity.append(title, meta);
  const badge = document.createElement("span"); badge.className = `claim-status ${status}`; badge.textContent = claimed ? "Claimed" : ({ available: "Likely available", taken: "Taken", manual: "Manual check" })[status];
  const message = document.createElement("p"); message.className = "claim-card-message"; message.textContent = status === "available" ? "No public profile was detected. Confirm availability during signup." : status === "taken" ? "A public profile currently uses this name." : (result.message || "The platform blocked an automated availability check.");
  const actions = document.createElement("div"); actions.className = "claim-card-actions"; const link = document.createElement("a"); const takenUrl = safeUrl(result.profileUrl); link.href = status === "taken" && takenUrl ? takenUrl : platform?.claimUrl || "#"; link.target = "_blank"; link.rel = "noopener noreferrer"; link.className = status === "available" ? "primary-button small" : "secondary-button"; link.textContent = status === "available" ? `${platform?.claimLabel || "Claim username"} ↗` : status === "taken" ? "View profile ↗" : `${platform?.claimLabel || "Check manually"} ↗`; actions.append(link);
  if (status !== "taken") { const mark = document.createElement("button"); mark.type = "button"; mark.className = "claim-mark"; mark.textContent = claimed ? "✓ Marked claimed" : "Mark as claimed"; mark.addEventListener("click", () => toggleClaimed(result.platformId)); actions.append(mark); }
  card.append(icon, identity, badge, message, actions); return card;
}

function safeUrl(value) { try { const url = new URL(value); return url.protocol === "https:" ? url.href : ""; } catch { return ""; } }
function loadClaimed() { try { const value = JSON.parse(localStorage.getItem(CLAIMED_KEY) || "{}"); return value && typeof value === "object" ? value : {}; } catch { return {}; } }

$("#claim-result-search").addEventListener("input", renderResults);
$("#claim-result-filters").addEventListener("click", event => { const button = event.target.closest("button[data-filter]"); if (!button) return; state.filter = button.dataset.filter; $$("#claim-result-filters button").forEach(item => item.classList.toggle("active", item === button)); renderResults(); });
$("#year").textContent = new Date().getFullYear();
loadSnapshot();
