// =============================================================
// DurioML 前端逻辑
// 流程：选照片 → 预览 → 上传到 /predict → 显示 top-3
// =============================================================

const fileInput = document.getElementById("fileInput");
const previewBox = document.getElementById("preview");
const previewImg = document.getElementById("previewImg");
const statusEl = document.getElementById("status");
const resultsBox = document.getElementById("results");
const resultList = document.getElementById("resultList");
const lowConfEl = document.getElementById("lowConfidence");

fileInput.addEventListener("change", async () => {
  const file = fileInput.files[0];
  if (!file) return;

  // 1. 显示预览
  previewImg.src = URL.createObjectURL(file);
  previewBox.classList.remove("hidden");
  resultsBox.classList.add("hidden");
  lowConfEl.classList.add("hidden");
  statusEl.textContent = "识别中…";

  // 2. 上传给后端
  const form = new FormData();
  form.append("file", file);

  try {
    const resp = await fetch("/predict", { method: "POST", body: form });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.detail || `服务器错误 ${resp.status}`);
    }
    const data = await resp.json();
    showResults(data);
  } catch (e) {
    statusEl.textContent = "❌ " + e.message;
  }
});

function showResults(data) {
  statusEl.textContent = "";
  resultList.innerHTML = "";

  data.top3.forEach((item, idx) => {
    const pct = Math.round(item.confidence * 100);
    const li = document.createElement("li");
    li.innerHTML = `
      <div class="rank-row">
        <span class="rank-name">${idx + 1}. ${item.name}</span>
        <span class="rank-pct">${pct}%</span>
      </div>
      <div class="bar"><span style="width:${pct}%"></span></div>
    `;
    resultList.appendChild(li);
  });

  if (data.low_confidence) {
    lowConfEl.classList.remove("hidden");
  }
  resultsBox.classList.remove("hidden");
}

// 注册 service worker（PWA：离线缓存界面、可“添加到主屏幕”）
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
