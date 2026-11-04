// =============================================================
// DurioML 前端逻辑（三语）
// 流程：选照片 → 预览 → 上传 /predict → 显示 top-3（按当前语言）
// 收集模式：再选一个类别 → 上传 /collect → 存进 Google Drive 对应文件夹
// =============================================================

const fileInput = document.getElementById("fileInput");
const previewBox = document.getElementById("preview");
const previewImg = document.getElementById("previewImg");
const statusEl = document.getElementById("status");
const resultsBox = document.getElementById("results");
const resultList = document.getElementById("resultList");
const lowConfEl = document.getElementById("lowConfidence");
const langSelect = document.getElementById("langSelect");

// ---- 语言 ----------------------------------------------------
// 读取上次选的语言（记住用户偏好）；没有就按浏览器语言猜，默认中文
function detectLang() {
  try {
    const saved = localStorage.getItem("durioml_lang");
    if (saved && UI_TEXT[saved]) return saved;
  } catch (e) {}
  const nav = (navigator.language || "zh").toLowerCase();
  if (nav.startsWith("ms")) return "ms";
  if (nav.startsWith("en")) return "en";
  return "zh";
}

let currentLang = detectLang();
let lastData = null;  // 存最近一次结果，切语言时重新渲染
let modelClasses = [];  // 后端模型认得的类别（从 /classes 拿）

// 把所有带 data-i18n 的元素按当前语言填好文字
function applyLang() {
  const t = UI_TEXT[currentLang];
  document.documentElement.lang = currentLang;
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (t[key]) el.textContent = t[key];
  });
  renderScope();
  renderCollectMode();
  // 结果区如果已有数据，用新语言重画
  if (lastData) renderResults(lastData);
}

langSelect.value = currentLang;
langSelect.addEventListener("change", () => {
  currentLang = langSelect.value;
  try { localStorage.setItem("durioml_lang", currentLang); } catch (e) {}
  applyLang();
});

// ---- 选照片 → 上传 ------------------------------------------
fileInput.addEventListener("change", async () => {
  const file = fileInput.files[0];
  if (!file) return;

  const t = UI_TEXT[currentLang];
  currentFile = file;
  lastData = null;
  collectStatus.textContent = "";

  previewImg.src = URL.createObjectURL(file);
  previewBox.classList.remove("hidden");
  resultsBox.classList.add("hidden");
  lowConfEl.classList.add("hidden");
  statusEl.textContent = t.status_detecting;

  const form = new FormData();
  form.append("file", file);

  try {
    const resp = await fetch("/predict", { method: "POST", body: form });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.detail || `${resp.status}`);
    }
    const data = await resp.json();
    lastData = data;
    statusEl.textContent = "";
    renderResults(data);
  } catch (e) {
    statusEl.textContent = t.err_prefix + e.message;
  }
  // 识别失败也照样可以分类收集
  if (collectMode) renderLabelGrid();
});

// ---- 渲染结果（按当前语言）----------------------------------
function renderResults(data) {
  resultList.innerHTML = "";

  data.top3.forEach((item, idx) => {
    const pct = Math.round(item.confidence * 100);
    const name = diseaseName(item.key, currentLang);  // 用 key 查三语名

    // 用安全的 DOM 方法，不用 innerHTML 拼字符串
    const li = document.createElement("li");

    const row = document.createElement("div");
    row.className = "rank-row";
    const nameSpan = document.createElement("span");
    nameSpan.className = "rank-name";
    nameSpan.textContent = `${idx + 1}. ${name}`;
    const pctSpan = document.createElement("span");
    pctSpan.className = "rank-pct";
    pctSpan.textContent = `${pct}%`;
    row.appendChild(nameSpan);
    row.appendChild(pctSpan);

    const bar = document.createElement("div");
    bar.className = "bar";
    const fill = document.createElement("span");
    fill.style.width = `${pct}%`;
    bar.appendChild(fill);

    li.appendChild(row);
    li.appendChild(bar);
    resultList.appendChild(li);
  });

  lowConfEl.classList.toggle("hidden", !data.low_confidence);
  resultsBox.classList.remove("hidden");
}

// ---- 「目前可识别」：按模型实际认得的类别显示 ----------------
const scopeEl = document.getElementById("scope");

function renderScope() {
  if (!modelClasses.length) {
    scopeEl.classList.add("hidden");
    return;
  }
  const t = UI_TEXT[currentLang];
  const names = modelClasses.map((k) => diseaseName(k, currentLang));
  scopeEl.textContent = t.scope_prefix + names.join(t.scope_sep) + t.scope_suffix;
  scopeEl.classList.remove("hidden");
}

async function loadClasses() {
  try {
    const resp = await fetch("/classes");
    const data = await resp.json();
    modelClasses = data.classes || [];
  } catch (e) {
    modelClasses = [];  // 没网或后端没开：不显示这一行
  }
  renderScope();
}

// ---- 收集模式 ------------------------------------------------
// 只有知道密码的人（你自己）能用。密码存在这台手机上，下次不用再输入。
const collectBox = document.getElementById("collectBox");
const labelGrid = document.getElementById("labelGrid");
const collectStatus = document.getElementById("collectStatus");
const collectBadge = document.getElementById("collectBadge");
const collectToggle = document.getElementById("collectToggle");

let currentFile = null;      // 最近拍的照片
let collectMode = false;
let collectLabels = [];      // 可选类别
let collectCounts = {};      // 每个类别已收集几张

function storageGet(key) {
  try { return localStorage.getItem(key); } catch (e) { return null; }
}
function storageSet(key, value) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch (e) {}
}

function fillTemplate(text, values) {
  return text.replace(/\{(\w+)\}/g, (_, k) => values[k] ?? "");
}

function renderCollectMode() {
  const t = UI_TEXT[currentLang];
  collectToggle.textContent = collectMode ? t.collect_off : t.collect_on;
  collectBadge.classList.toggle("hidden", !collectMode);
  if (!collectMode) collectBox.classList.add("hidden");
  else if (currentFile && !collectBox.classList.contains("hidden")) renderLabelGrid();
}

// 用 /collect/labels 验证密码，顺便拿到类别和数量
async function loadCollectLabels(token) {
  const resp = await fetch("/collect/labels", { headers: { "X-Collect-Token": token } });
  if (!resp.ok) return false;
  const data = await resp.json();
  collectLabels = data.labels;
  collectCounts = data.counts;
  return true;
}

async function enterCollectMode() {
  const t = UI_TEXT[currentLang];
  let token = storageGet("durioml_collect_token");
  if (!token) {
    token = (window.prompt(t.collect_ask_token) || "").trim();
    if (!token) return;
  }
  let ok = false;
  try { ok = await loadCollectLabels(token); } catch (e) {}
  if (!ok) {
    storageSet("durioml_collect_token", null);
    window.alert(t.collect_bad_token);
    return;
  }
  storageSet("durioml_collect_token", token);
  storageSet("durioml_collect_mode", "1");
  collectMode = true;
  renderCollectMode();
  if (currentFile) renderLabelGrid();
}

function exitCollectMode() {
  collectMode = false;
  storageSet("durioml_collect_mode", null);
  collectStatus.textContent = "";
  renderCollectMode();
}

collectToggle.addEventListener("click", () => {
  if (collectMode) exitCollectMode();
  else enterCollectMode();
});

// 一个类别一个按钮，显示已收集张数；模型猜的那一个加框提示
function renderLabelGrid() {
  const t = UI_TEXT[currentLang];
  const aiKey = lastData && lastData.top3 && lastData.top3[0] ? lastData.top3[0].key : null;
  labelGrid.innerHTML = "";
  collectLabels.forEach((label) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "label-btn" + (label === aiKey ? " ai-pick" : "");

    const name = document.createElement("span");
    name.textContent = diseaseName(label, currentLang);
    btn.appendChild(name);
    if (label === aiKey) {
      const ai = document.createElement("span");
      ai.className = "ai";
      ai.textContent = ` · ${t.collect_ai_hint}`;
      btn.appendChild(ai);
    }
    const count = document.createElement("span");
    count.className = "count";
    count.textContent = String(collectCounts[label] || 0);
    btn.appendChild(count);

    btn.addEventListener("click", () => saveToLabel(label));
    labelGrid.appendChild(btn);
  });
  collectBox.classList.remove("hidden");
}

async function saveToLabel(label) {
  const t = UI_TEXT[currentLang];
  if (!currentFile) return;
  labelGrid.querySelectorAll("button").forEach((b) => (b.disabled = true));
  collectStatus.textContent = t.collect_uploading;

  const form = new FormData();
  form.append("file", currentFile);
  form.append("label", label);
  const top = lastData && lastData.top3 && lastData.top3[0];
  form.append("ai_guess", top ? `${top.key}:${top.confidence}` : "");

  try {
    const resp = await fetch("/collect", {
      method: "POST",
      headers: { "X-Collect-Token": storageGet("durioml_collect_token") || "" },
      body: form,
    });
    if (resp.status === 401 || resp.status === 403) {
      storageSet("durioml_collect_token", null);
      exitCollectMode();
      collectStatus.textContent = t.err_prefix + t.collect_bad_token;
      return;
    }
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.detail || `${resp.status}`);

    collectCounts[label] = data.count;
    let msg = fillTemplate(t.collect_saved, { name: diseaseName(label, currentLang), n: data.count });
    if (data.drive_error) msg += " " + t.collect_drive_error;
    else if (!data.drive) msg += " " + t.collect_local_only;
    collectStatus.textContent = msg;
    // 存好了就收起按钮，避免同一张存两次；拍下一张会再出现
    collectBox.classList.add("hidden");
    currentFile = null;
  } catch (e) {
    collectStatus.textContent = t.err_prefix + e.message;
    labelGrid.querySelectorAll("button").forEach((b) => (b.disabled = false));
  }
}

// 上次是收集模式的话，打开 app 自动恢复（用存着的密码验证一次）
async function restoreCollectMode() {
  const token = storageGet("durioml_collect_token");
  if (storageGet("durioml_collect_mode") !== "1" || !token) return;
  try {
    if (await loadCollectLabels(token)) {
      collectMode = true;
      renderCollectMode();
    }
  } catch (e) {}
}

// ---- 初始化 --------------------------------------------------
applyLang();
restoreCollectMode();
loadClasses();

// service worker（PWA）
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
