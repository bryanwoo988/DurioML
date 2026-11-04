// =============================================================
// DurioML 前端逻辑（三语、8 种外观）
//
// 识别：拍照 → 上传 /predict → 显示前三名
// 收集模式：再选一个类别 → 上传 /collect → 存进 Google Drive 对应文件夹
//   文件名带拍照者名字和拍照时间，例如 阿明_20261105_143022_a1b2.jpg
// 邀请朋友：设置里产生 QR code，朋友扫了填一次名字就能帮忙拍
// =============================================================

const $ = (id) => document.getElementById(id);

const THEMES = ["leaf", "durian", "mint", "mist", "clay", "rainforest", "midnight", "graphite"];
const LANGS = ["zh", "en", "ms"];
const LANG_CHIP = { zh: "中", en: "EN", ms: "BM" };

// ---- 本机存储（无痕模式等情况下可能不能用，所以都包起来）------

function storageGet(key) {
  try { return localStorage.getItem(key); } catch (e) { return null; }
}
function storageSet(key, value) {
  try {
    if (value === null || value === undefined) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch (e) {}
}

// ---- 状态 ----------------------------------------------------

let currentLang = detectLang();
let modelClasses = [];       // 模型认得的类别（/classes）
let lastData = null;         // 最近一次识别结果
let currentFile = null;      // 最近拍的照片
let capturedAt = "";         // 拍照时间（手机当地时间）
let collectMode = false;
let collectLabels = [];
let collectCounts = {};

function t() {
  return UI_TEXT[currentLang];
}

// ---- 语言 ----------------------------------------------------

function detectLang() {
  const saved = storageGet("durioml_lang");
  if (saved && UI_TEXT[saved]) return saved;
  const nav = (navigator.language || "zh").toLowerCase();
  if (nav.startsWith("ms")) return "ms";
  if (nav.startsWith("en")) return "en";
  return "zh";
}

function setLang(lang) {
  currentLang = lang;
  storageSet("durioml_lang", lang);
  applyLang();
}

function applyLang() {
  const text = t();
  document.documentElement.lang = currentLang;
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (text[key]) el.textContent = text[key];
  });
  $("langChip").textContent = LANG_CHIP[currentLang];
  document.querySelectorAll("#langSeg button").forEach((b) => {
    b.classList.toggle("active", b.dataset.lang === currentLang);
  });
  renderThemeGrid();
  renderScope();
  renderCollectMode();
  if (lastData) renderResults(lastData);
  if (collectMode && currentFile && !$("collectBox").classList.contains("hidden")) renderLabelGrid();
}

$("langChip").addEventListener("click", () => {
  setLang(LANGS[(LANGS.indexOf(currentLang) + 1) % LANGS.length]);
});
document.querySelectorAll("#langSeg button").forEach((b) => {
  b.addEventListener("click", () => setLang(b.dataset.lang));
});

// ---- 外观（8 种）----------------------------------------------

function currentTheme() {
  return document.documentElement.getAttribute("data-theme") || "leaf";
}

function applyTheme(id) {
  document.documentElement.setAttribute("data-theme", id);
  storageSet("durioml_theme", id);
  // 手机浏览器顶部状态栏的颜色跟着变
  const bg = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim();
  document.querySelector('meta[name="theme-color"]').setAttribute("content", bg);
  renderThemeGrid();
}

function renderThemeGrid() {
  const grid = $("themeGrid");
  grid.textContent = "";
  THEMES.forEach((id) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "theme-opt" + (id === currentTheme() ? " active" : "");
    btn.setAttribute("aria-label", themeName(id, currentLang));

    // 小预览卡自己带 data-theme，所以画出来的是那个外观的颜色
    const swatch = document.createElement("span");
    swatch.className = "theme-swatch";
    swatch.setAttribute("data-theme", id);
    ["sw-card", "sw-dot", "sw-btn"].forEach((cls) => {
      const part = document.createElement("span");
      part.className = cls;
      swatch.appendChild(part);
    });

    const name = document.createElement("span");
    name.className = "theme-name";
    name.textContent = themeName(id, currentLang);

    btn.append(swatch, name);
    btn.addEventListener("click", () => applyTheme(id));
    grid.appendChild(btn);
  });
}

// ---- 提示条 ----------------------------------------------------

let toastTimer = null;
function toast(message, ms = 3200) {
  const el = $("toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), ms);
}

// ---- 对话框 ----------------------------------------------------
// openModal 回传 Promise：按确定 → 输入的文字（没有输入框就是 true）；按取消 → null

let modalResolve = null;

function openModal({ title, text = "", input = null, body = null, okText, cancelText }) {
  $("modalTitle").textContent = title;
  $("modalText").textContent = text;
  $("modalText").classList.toggle("hidden", !text);
  const bodyEl = $("modalBody");
  bodyEl.textContent = "";
  if (body) bodyEl.appendChild(body);

  const inputEl = $("modalInput");
  inputEl.classList.toggle("hidden", !input);
  if (input) {
    inputEl.type = input.type || "text";
    inputEl.placeholder = input.placeholder || "";
    inputEl.value = input.value || "";
  }
  $("modalOk").textContent = okText || t().ok;
  $("modalCancel").textContent = cancelText || t().cancel;
  $("modalCancel").classList.toggle("hidden", cancelText === null);

  $("modal").classList.remove("hidden");
  $("modal").setAttribute("aria-hidden", "false");
  if (input) setTimeout(() => inputEl.focus(), 50);

  return new Promise((resolve) => { modalResolve = resolve; });
}

function closeModal(result) {
  $("modal").classList.add("hidden");
  $("modal").setAttribute("aria-hidden", "true");
  if (modalResolve) {
    const resolve = modalResolve;
    modalResolve = null;
    resolve(result);
  }
}

$("modalForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const inputEl = $("modalInput");
  closeModal(inputEl.classList.contains("hidden") ? true : inputEl.value.trim());
});
$("modalCancel").addEventListener("click", () => closeModal(null));
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (!$("modal").classList.contains("hidden")) closeModal(null);
  else if (!$("sheet").classList.contains("hidden")) closeSheet();
});

// ---- 设置面板 --------------------------------------------------

function openSheet() {
  renderThemeGrid();
  $("sheet").classList.remove("hidden");
  $("sheet").setAttribute("aria-hidden", "false");
}
function closeSheet() {
  $("sheet").classList.add("hidden");
  $("sheet").setAttribute("aria-hidden", "true");
}
$("settingsBtn").addEventListener("click", openSheet);
$("modePill").addEventListener("click", openSheet);
document.querySelectorAll("#sheet [data-close]").forEach((el) => el.addEventListener("click", closeSheet));

// ---- 拍照 / 选照片 → 识别 ----------------------------------------

function localTimestamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

async function handleFile(file) {
  if (!file) return;
  currentFile = file;
  capturedAt = localTimestamp();
  lastData = null;

  $("hero").classList.add("hidden");
  $("previewImg").src = URL.createObjectURL(file);
  $("photoCard").classList.remove("hidden");
  $("scanOverlay").classList.remove("hidden");
  $("results").classList.add("hidden");
  $("collectBox").classList.add("hidden");
  $("status").textContent = "";

  const form = new FormData();
  form.append("file", file);
  try {
    const resp = await fetch("/predict", { method: "POST", body: form });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.detail || `${resp.status}`);
    }
    lastData = await resp.json();
    renderResults(lastData);
  } catch (e) {
    $("status").textContent = t().err_prefix + e.message;
  } finally {
    $("scanOverlay").classList.add("hidden");
  }
  // 识别失败也照样可以分类收集
  if (collectMode) renderLabelGrid();
  $("photoCard").scrollIntoView({ behavior: "smooth", block: "start" });
}

["fileInput", "galleryInput"].forEach((id) => {
  $(id).addEventListener("change", (e) => {
    handleFile(e.target.files[0]);
    e.target.value = "";   // 清掉，下次选同一张也会触发
  });
});

// ---- 识别结果 --------------------------------------------------

function renderResults(data) {
  const [top, ...rest] = data.top3;
  const topPct = Math.round(top.confidence * 100);
  $("ring").style.setProperty("--p", topPct);
  $("ringPct").textContent = `${topPct}%`;
  $("topName").textContent = diseaseName(top.key, currentLang);

  const list = $("resultList");
  list.textContent = "";
  rest.forEach((item, idx) => {
    const pct = Math.round(item.confidence * 100);
    const li = document.createElement("li");

    const row = document.createElement("div");
    row.className = "rank-row";
    const name = document.createElement("span");
    name.className = "rank-name";
    name.textContent = `${idx + 2}. ${diseaseName(item.key, currentLang)}`;
    const pctEl = document.createElement("span");
    pctEl.className = "rank-pct";
    pctEl.textContent = `${pct}%`;
    row.append(name, pctEl);

    const bar = document.createElement("div");
    bar.className = "bar";
    const fill = document.createElement("span");
    fill.style.width = `${pct}%`;
    bar.appendChild(fill);

    li.append(row, bar);
    list.appendChild(li);
  });

  $("lowConfidence").classList.toggle("hidden", !data.low_confidence);
  $("results").classList.remove("hidden");
}

// ---- 「目前可识别」 ---------------------------------------------

function renderScope() {
  const el = $("scope");
  if (!modelClasses.length) {
    el.classList.add("hidden");
    return;
  }
  const text = t();
  const names = modelClasses.map((k) => diseaseName(k, currentLang));
  el.textContent = text.scope_prefix + names.join(text.scope_sep) + text.scope_suffix;
  el.classList.remove("hidden");
}

async function loadClasses() {
  try {
    const data = await (await fetch("/classes")).json();
    modelClasses = data.classes || [];
  } catch (e) {
    modelClasses = [];
  }
  renderScope();
}

// ---- 收集模式 --------------------------------------------------
// 密码和名字存在这台手机上，下次不用再输入。

function contributor() {
  return storageGet("durioml_contributor") || "";
}

function renderCollectMode() {
  const text = t();
  $("collectToggleTitle").textContent = collectMode ? text.collect_off : text.collect_on;
  $("nameBtn").classList.toggle("hidden", !collectMode);
  $("inviteBtn").classList.toggle("hidden", !collectMode);
  $("nameDesc").textContent = contributor();
  $("modePill").classList.toggle("hidden", !collectMode);
  $("modePillText").textContent = fillTemplate(text.mode_pill, { name: contributor() });
  if (!collectMode) $("collectBox").classList.add("hidden");
}

// 用 /collect/labels 验证密码，顺便拿到类别和每类数量
async function loadCollectLabels(token) {
  const resp = await fetch("/collect/labels", { headers: { "X-Collect-Token": token } });
  if (!resp.ok) return false;
  const data = await resp.json();
  collectLabels = data.labels;
  collectCounts = data.counts;
  return true;
}

async function askName(isInvite) {
  const text = t();
  const name = await openModal({
    title: isInvite ? text.join_title : text.name_title,
    text: isInvite ? text.join_text : text.name_text,
    input: { placeholder: text.name_placeholder, value: contributor() },
    cancelText: isInvite ? null : undefined,
  });
  if (name) storageSet("durioml_contributor", name.slice(0, 24));
  return contributor();
}

async function turnOnCollect(token, isInvite) {
  let ok = false;
  try { ok = await loadCollectLabels(token); } catch (e) {}
  if (!ok) {
    storageSet("durioml_collect_token", null);
    toast(t().collect_bad_token);
    return false;
  }
  storageSet("durioml_collect_token", token);
  // 第一次进入收集模式要先填名字；朋友一定要填
  while (!contributor()) {
    const name = await askName(isInvite);
    if (!name && !isInvite) return false;
  }
  collectMode = true;
  storageSet("durioml_collect_mode", "1");
  renderCollectMode();
  if (currentFile) renderLabelGrid();
  return true;
}

async function enterCollectMode() {
  let token = storageGet("durioml_collect_token");
  if (!token) {
    const text = t();
    token = await openModal({
      title: text.collect_pw_title,
      text: text.collect_ask_token,
      input: { type: "password" },
    });
    if (!token) return;
  }
  if (await turnOnCollect(token, false)) closeSheet();
}

function exitCollectMode() {
  collectMode = false;
  storageSet("durioml_collect_mode", null);
  renderCollectMode();
}

$("collectToggle").addEventListener("click", () => {
  if (collectMode) exitCollectMode();
  else enterCollectMode();
});

$("nameBtn").addEventListener("click", async () => {
  await askName(false);
  renderCollectMode();
});

// 一个类别一个按钮，显示已收集张数；模型猜的那个加上「AI 猜」标记
function renderLabelGrid() {
  const text = t();
  const aiKey = lastData && lastData.top3 && lastData.top3[0] ? lastData.top3[0].key : null;
  const grid = $("labelGrid");
  grid.textContent = "";
  collectLabels.forEach((label) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "label-btn" + (label === aiKey ? " ai-pick" : "");

    const name = document.createElement("span");
    name.className = "lb-name";
    name.textContent = diseaseName(label, currentLang);
    const count = document.createElement("span");
    count.className = "lb-count";
    count.textContent = `${collectCounts[label] || 0}`;
    btn.append(name, count);

    if (label === aiKey) {
      const ai = document.createElement("span");
      ai.className = "lb-ai";
      ai.textContent = text.collect_ai_hint;
      btn.appendChild(ai);
    }
    btn.addEventListener("click", () => saveToLabel(label));
    grid.appendChild(btn);
  });
  $("collectBox").classList.remove("hidden");
}

async function saveToLabel(label) {
  const text = t();
  if (!currentFile) return;
  const buttons = $("labelGrid").querySelectorAll("button");
  buttons.forEach((b) => (b.disabled = true));
  toast(text.collect_uploading, 60000);

  const form = new FormData();
  form.append("file", currentFile);
  form.append("label", label);
  form.append("contributor", contributor());
  form.append("taken_at", capturedAt);
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
      toast(text.collect_bad_token);
      return;
    }
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.detail || `${resp.status}`);

    collectCounts[label] = data.count;
    let msg = fillTemplate(text.collect_saved, { name: diseaseName(label, currentLang), n: data.count });
    if (data.drive_error) msg += " · " + text.collect_drive_error;
    else if (!data.drive) msg += " · " + text.collect_local_only;
    toast(msg, 4500);
    // 存好就收起来，避免同一张存两次；拍下一张会再出现
    $("collectBox").classList.add("hidden");
    currentFile = null;
  } catch (e) {
    toast(text.err_prefix + e.message);
    buttons.forEach((b) => (b.disabled = false));
  }
}

// ---- 邀请朋友（QR code）-----------------------------------------

async function copyText(value) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch (e) {
    // http（非 https）时 clipboard API 不能用，退回旧方法
    const ta = document.createElement("textarea");
    ta.value = value;
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}

$("inviteBtn").addEventListener("click", async () => {
  const text = t();
  let data;
  try {
    const resp = await fetch(`/collect/invite?origin=${encodeURIComponent(location.origin)}`, {
      headers: { "X-Collect-Token": storageGet("durioml_collect_token") || "" },
    });
    data = await resp.json();
    if (!resp.ok) throw new Error(data.detail || `${resp.status}`);
  } catch (e) {
    toast(text.err_prefix + e.message);
    return;
  }

  const box = document.createElement("div");
  const qr = document.createElement("div");
  qr.className = "qr-box";
  const img = document.createElement("img");
  img.alt = "QR code";
  img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(data.svg);
  qr.appendChild(img);
  const link = document.createElement("p");
  link.className = "qr-link";
  link.textContent = data.url;
  box.append(qr, link);

  const copy = await openModal({
    title: text.invite,
    text: text.invite_text,
    body: box,
    okText: text.copy_link,
    cancelText: text.close,
  });
  if (copy && (await copyText(data.url))) toast(text.copied);
});

// 朋友扫 QR 进来：网址带 ?join=邀请码
async function handleJoinLink() {
  const params = new URLSearchParams(location.search);
  const token = params.get("join");
  if (!token) return false;
  // 把邀请码从网址拿掉，免得朋友转发网址时把邀请码也带出去
  history.replaceState(null, "", location.pathname);
  await turnOnCollect(token, true);
  return true;
}

// 上次是收集模式的话，打开 app 自动恢复（用存着的密码验证一次）
async function restoreCollectMode() {
  const token = storageGet("durioml_collect_token");
  if (storageGet("durioml_collect_mode") !== "1" || !token || !contributor()) return;
  try {
    if (await loadCollectLabels(token)) {
      collectMode = true;
      renderCollectMode();
    }
  } catch (e) {}
}

// ---- 初始化 --------------------------------------------------

applyTheme(currentTheme());
applyLang();
loadClasses();
handleJoinLink().then((joined) => { if (!joined) restoreCollectMode(); });

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
