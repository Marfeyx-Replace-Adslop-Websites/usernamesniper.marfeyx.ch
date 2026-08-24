import { CLAIM_PLATFORMS } from "./claim-platforms-2.0.js";

const $ = (selector, root = document) => root.querySelector(selector);
const ACTIVE_KEY = "marfeyx-active-claim-v2";
const COMPLETED_KEY = "marfeyx-completed-claim-v1";
const CLAIMED_KEY = "marfeyx-claimed-usernames-v1";

const state = {
  username: "",
  selectedCategories: new Set(CLAIM_PLATFORMS.map(platform => platform.category)),
  requestedIds: [],
  results: new Map(),
  startedAt: null,
  timer: null,
  controller: null,
  scanning: false,
  stopped: false,
  claimed: loadClaimed()
};

const platformMap = new Map(CLAIM_PLATFORMS.map(platform => [platform.id, platform]));
const form = $("#claim-form");
const input = $("#claim-username");
const errorBox = $("#claim-error");
const progressSection = $("#claim-progress");

function normalizeUsername(value) {
  return value.trim().replace(/^@+/, "");
}

function validUsername(value) {
  return /^[\p{L}\p{N}][\p{L}\p{N}._-]{0,31}$/u.test(value);
}

function selectedPlatforms() {
  return CLAIM_PLATFORMS.filter(platform => state.selectedCategories.has(platform.category));
}

function renderCategories() {
  const categories = [...new Set(CLAIM_PLATFORMS.map(platform => platform.category))];
  const container = $("#claim-categories");
  const all = document.createElement("button");
  all.type = "button";
  all.className = state.selectedCategories.size === categories.length ? "active" : "";
  all.textContent = "All";
  all.addEventListener("click", () => {
    const selectAll = state.selectedCategories.size !== categories.length;
    state.selectedCategories = new Set(selectAll ? categories : [categories[0]]);
    renderCategories();
  });
  const buttons = categories.map(category => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = state.selectedCategories.has(category) ? "active" : "";
    button.textContent = category;
    button.addEventListener("click", () => {
      if (state.selectedCategories.has(category) && state.selectedCategories.size > 1) state.selectedCategories.delete(category);
      else state.selectedCategories.add(category);
      renderCategories();
    });
    return button;
  });
  container.replaceChildren(all, ...buttons);
  const count = selectedPlatforms().length;
  $("#selected-platform-count").textContent = `${count} platform${count === 1 ? "" : "s"} selected`;
}

function resetCheck() {
  localStorage.removeItem(COMPLETED_KEY);
  progressSection.classList.remove("scan-complete");
  state.results.clear();
  state.stopped = false;
  errorBox.textContent = "";
  progressSection.hidden = true;
  updateProgress(0, 0);
}

async function startCheck(event) {
  event.preventDefault();
  const username = normalizeUsername(input.value);
  errorBox.textContent = "";
  if (!validUsername(username)) {
    errorBox.textContent = "Use 1-32 letters, numbers, dots, underscores or hyphens; start with a letter or number.";
    input.focus();
    return;
  }
  const platforms = selectedPlatforms();
  if (!platforms.length) {
    errorBox.textContent = "Choose at least one platform group.";
    return;
  }

  resetCheck();
  state.username = username;
  state.requestedIds = platforms.map(platform => platform.id);
  state.startedAt = Date.now();
  state.scanning = true;
  state.controller = new AbortController();
  input.disabled = true;
  $("#claim-submit").disabled = true;
  progressSection.hidden = false;
  $("#claim-progress-title").textContent = `Building claim board for @${username}`;
  $("#claim-progress-label").textContent = "Preparing official platform links...";
  progressSection.scrollIntoView({ behavior: "smooth", block: "start" });
  startTimer();

  try {
    await buildLocalBoard();
    finishCheck(state.stopped);
  } catch (error) {
    handleCheckError(error);
  } finally {
    state.scanning = false;
    clearInterval(state.timer);
    input.disabled = false;
    $("#claim-submit").disabled = false;
  }
}

async function buildLocalBoard() {
  for (let index = 0; index < state.requestedIds.length; index += 1) {
    if (state.stopped) return;
    const platform = platformMap.get(state.requestedIds[index]);
    $("#claim-progress-label").textContent = platform ? `Preparing ${platform.name}` : "Preparing platform";
    await wait(document.hidden ? 10 : 35, state.controller.signal);
    state.results.set(state.requestedIds[index], createManualResult(platform, state.requestedIds[index]));
    updateProgress(state.results.size, state.requestedIds.length);
    saveActiveCheck();
  }
}

function createManualResult(platform, id) {
  return {
    platformId: id,
    platform: platform?.name || id,
    status: "manual",
    message: "Browser-only mode does not send this username to a server or database. Open the official page to confirm availability.",
    profileUrl: ""
  };
}

function updateProgress(checked, total) {
  const percent = total ? Math.min(100, Math.round((checked / total) * 100)) : 0;
  $("#claim-progress-percent").textContent = `${percent}%`;
  $("#claim-progress-bar").style.width = `${percent}%`;
  $("#claim-checked").textContent = checked;
  $("#claim-available-live").textContent = state.results.size;
}

function finishCheck(partial = false) {
  progressSection.classList.add("scan-complete");
  clearInterval(state.timer);
  state.scanning = false;
  for (const id of state.requestedIds) {
    if (!state.results.has(id)) state.results.set(id, createManualResult(platformMap.get(id), id));
  }
  localStorage.setItem(COMPLETED_KEY, JSON.stringify({
    savedAt: Date.now(),
    partial,
    mode: "local",
    username: state.username,
    requestedIds: state.requestedIds,
    results: [...state.results.values()]
  }));
  clearActiveCheck();
  setTimeout(() => location.assign("results/"), 120);
}

function saveActiveCheck() {
  localStorage.setItem(ACTIVE_KEY, JSON.stringify({
    username: state.username,
    requestedIds: state.requestedIds,
    startedAt: state.startedAt,
    results: [...state.results.values()]
  }));
}

function clearActiveCheck() {
  localStorage.removeItem(ACTIVE_KEY);
}

async function resumeActiveCheck() {
  if (state.scanning) return;
  let saved;
  try { saved = JSON.parse(localStorage.getItem(ACTIVE_KEY) || "null"); }
  catch { clearActiveCheck(); return; }
  if (!saved || !validUsername(saved.username || "") || !Array.isArray(saved.requestedIds)) return;

  resetCheck();
  state.username = saved.username;
  state.requestedIds = saved.requestedIds.filter(id => platformMap.has(id)).slice(0, 100);
  state.results = new Map((Array.isArray(saved.results) ? saved.results : []).map(result => [result.platformId, result]));
  state.startedAt = Number(saved.startedAt) || Date.now();
  state.scanning = true;
  state.controller = new AbortController();
  input.value = state.username;
  input.disabled = true;
  $("#claim-submit").disabled = true;
  progressSection.hidden = false;
  $("#claim-progress-title").textContent = `Rebuilding claim board for @${state.username}`;
  startTimer();
  try {
    await buildLocalBoard();
    finishCheck(state.stopped);
  } catch (error) {
    handleCheckError(error);
  } finally {
    state.scanning = false;
    clearInterval(state.timer);
    input.disabled = false;
    $("#claim-submit").disabled = false;
  }
}

function handleCheckError(error) {
  if (error.name === "AbortError") return;
  errorBox.textContent = error.message || "The claim board could not be prepared.";
  if (!state.results.size) progressSection.hidden = true;
  form.scrollIntoView({ behavior: "smooth", block: "center" });
}

function startTimer() {
  clearInterval(state.timer);
  const tick = () => {
    const seconds = Math.max(0, Math.floor((Date.now() - state.startedAt) / 1000));
    $("#claim-elapsed").textContent = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  };
  tick();
  state.timer = setInterval(tick, 1000);
}

function wait(ms, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => { clearTimeout(timer); reject(new DOMException("Stopped", "AbortError")); }, { once: true });
  });
}

function loadClaimed() {
  try {
    const value = JSON.parse(localStorage.getItem(CLAIMED_KEY) || "{}");
    return value && typeof value === "object" ? value : {};
  } catch { return {}; }
}

form.addEventListener("submit", startCheck);
$("#claim-stop").addEventListener("click", () => {
  state.stopped = true;
  clearActiveCheck();
  state.controller?.abort();
  finishCheck(true);
});
$("#year").textContent = new Date().getFullYear();

renderCategories();
resumeActiveCheck();
