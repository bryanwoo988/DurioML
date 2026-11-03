// =============================================================
// DurioML 前端逻辑（三语）
// 流程：选照片 → 预览 → 上传 /predict → 显示 top-3（按当前语言）
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

// 把所有带 data-i18n 的元素按当前语言填好文字
function applyLang() {
  const t = UI_TEXT[currentLang];
  document.documentElement.lang = currentLang;
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (t[key]) el.textContent = t[key];
  });
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

// ---- 初始化 --------------------------------------------------
applyLang();

// service worker（PWA）
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
