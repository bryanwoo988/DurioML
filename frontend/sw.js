// =============================================================
// Service Worker —— 让 DurioML 成为可安装的 PWA
// =============================================================
//
// 作用：把界面文件缓存起来，
//  - 可以“添加到主屏幕”，像 app 一样打开
//  - 没网时也能打开界面（但识别仍需联网，因为模型在服务器上）
//
// 注意：这里只缓存“界面”。真正的识别请求 (/predict) 不缓存，
// 因为那需要实时联服务器。将来若要做“离线识别”，
// 要把模型下载进浏览器，那是另一套做法（第三阶段再说）。
// =============================================================

const CACHE = "durioml-v2";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./i18n.js",
  "./app.js",
  "./manifest.json",
];

// 安装时缓存界面文件
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

// 清理旧缓存
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// 拦截请求：
//  - /predict 这类接口 → 永远走网络（不缓存）
//  - 其他（界面文件）→ 先用缓存，没有再走网络
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (url.pathname.startsWith("/predict") || url.pathname.startsWith("/health")) {
    return; // 交给浏览器正常联网
  }
  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request))
  );
});
