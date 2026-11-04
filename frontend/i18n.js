// =============================================================
// 三语文案字典 —— 中文 / English / Bahasa Melayu
// =============================================================
//
// 要改语言或加语言：
//   - UI 文字：改 UI_TEXT 里对应的 key
//   - 病害名字：改 DISEASE_NAMES，key 必须和后端返回的 key 一致
//     （后端 /predict 返回的 "key" 字段，如 Leaf_Algal）
//   - 外观名字：改 THEME_NAMES
//
// 文字里的 {name}、{n} 会被替换成实际内容。
// =============================================================

const UI_TEXT = {
  zh: {
    tagline: "榴莲叶病虫害识别",
    hero_title: "拍一片叶子",
    hero_sub: "对准一片榴莲叶，尽量把病斑拍清楚，几秒就有结果。",
    scope_prefix: "目前可识别：",
    scope_sep: "、",
    scope_suffix: "。其他病虫害暂时无法识别。",
    pick: "拍照",
    pick_gallery: "相册",
    status_detecting: "识别中…",
    results_title: "最可能的病虫害",
    top_label: "最可能",
    low_confidence: "信心不高，无法确定。建议补拍清晰一点的照片，或请教农业专家。",
    disclaimer: "辅助判断工具，不能替代专家。严重病害请找专业人士确认。",
    err_prefix: "出错了：",

    settings_title: "设置",
    settings_language: "语言",
    settings_theme: "外观",
    settings_collect: "收集照片",

    collect_on: "进入收集模式",
    collect_off: "退出收集模式",
    collect_on_desc: "拍照后选类别，存进 Google Drive",
    mode_pill: "收集模式 · {name}",
    collect_title: "这张是什么？按一下存进对应的文件夹",
    collect_pw_title: "收集模式密码",
    collect_ask_token: "请输入收集模式的密码",
    collect_bad_token: "密码不对，或服务器没有开启收集模式",
    collect_uploading: "上传中…",
    collect_saved: "已存到「{name}」，这一类共 {n} 张",
    collect_local_only: "只存在服务器，Google Drive 还没设定",
    collect_drive_error: "已存在服务器，但上传 Google Drive 失败，之后可以补传",
    collect_ai_hint: "AI 猜",

    name_title: "你的名字",
    name_text: "你拍的照片会用这个名字标记，方便知道是谁拍的。",
    name_placeholder: "例如：阿明",
    name_change: "更改名字",
    join_title: "欢迎！",
    join_text: "你被邀请帮忙收集榴莲叶照片。先填你的名字，按 Enter 就可以开始拍了。",

    invite: "邀请朋友帮忙拍",
    invite_desc: "朋友扫 QR code，填一次名字就能拍",
    invite_text: "让朋友用手机相机扫这个 QR code。拿到这个 QR 的人都能上传照片，只分享给信任的人。",
    copy_link: "复制链接",
    copied: "已复制",

    ok: "确定",
    cancel: "取消",
    close: "关闭",
  },
  en: {
    tagline: "Durian leaf health check",
    hero_title: "Snap a leaf",
    hero_sub: "Fill the frame with one durian leaf and keep the spots in focus. Results in seconds.",
    scope_prefix: "Currently recognizes: ",
    scope_sep: ", ",
    scope_suffix: ". Other problems can't be recognized yet.",
    pick: "Take photo",
    pick_gallery: "Gallery",
    status_detecting: "Analyzing…",
    results_title: "Most likely problems",
    top_label: "Most likely",
    low_confidence: "Low confidence. Try a clearer photo or ask an agronomist.",
    disclaimer: "An assistive tool, not a replacement for experts. Consult a professional for serious cases.",
    err_prefix: "Error: ",

    settings_title: "Settings",
    settings_language: "Language",
    settings_theme: "Appearance",
    settings_collect: "Photo collection",

    collect_on: "Enter collect mode",
    collect_off: "Exit collect mode",
    collect_on_desc: "Pick a category after each photo and save it to Google Drive",
    mode_pill: "Collecting · {name}",
    collect_title: "What is this? Tap to save it to that folder",
    collect_pw_title: "Collect mode password",
    collect_ask_token: "Enter the collect mode password",
    collect_bad_token: "Wrong password, or collect mode is not enabled on the server",
    collect_uploading: "Uploading…",
    collect_saved: "Saved to “{name}” — {n} photos in this folder",
    collect_local_only: "Saved on the server only; Google Drive is not set up yet",
    collect_drive_error: "Saved on the server, but the Google Drive upload failed; it can be re-uploaded later",
    collect_ai_hint: "AI guess",

    name_title: "Your name",
    name_text: "Your photos will be tagged with this name so we know who took them.",
    name_placeholder: "e.g. Ali",
    name_change: "Change name",
    join_title: "Welcome!",
    join_text: "You've been invited to help collect durian leaf photos. Enter your name and press Enter to start.",

    invite: "Invite a friend to help",
    invite_desc: "They scan the QR code and enter their name once",
    invite_text: "Ask your friend to scan this QR code with their phone camera. Anyone with this code can upload photos, so only share it with people you trust.",
    copy_link: "Copy link",
    copied: "Copied",

    ok: "OK",
    cancel: "Cancel",
    close: "Close",
  },
  ms: {
    tagline: "Semakan kesihatan daun durian",
    hero_title: "Ambil gambar daun",
    hero_sub: "Fokus pada sehelai daun durian dan pastikan bintik jelas. Keputusan dalam beberapa saat.",
    scope_prefix: "Boleh dikenal pasti: ",
    scope_sep: ", ",
    scope_suffix: ". Masalah lain belum boleh dikenal pasti.",
    pick: "Ambil gambar",
    pick_gallery: "Galeri",
    status_detecting: "Menganalisis…",
    results_title: "Masalah paling berkemungkinan",
    top_label: "Paling mungkin",
    low_confidence: "Keyakinan rendah. Cuba gambar yang lebih jelas atau rujuk pakar pertanian.",
    disclaimer: "Alat bantuan, bukan pengganti pakar. Rujuk profesional untuk kes serius.",
    err_prefix: "Ralat: ",

    settings_title: "Tetapan",
    settings_language: "Bahasa",
    settings_theme: "Penampilan",
    settings_collect: "Kumpul gambar",

    collect_on: "Masuk mod kumpul",
    collect_off: "Keluar mod kumpul",
    collect_on_desc: "Pilih kategori selepas setiap gambar dan simpan ke Google Drive",
    mode_pill: "Mengumpul · {name}",
    collect_title: "Apakah ini? Tekan untuk simpan ke folder itu",
    collect_pw_title: "Kata laluan mod kumpul",
    collect_ask_token: "Masukkan kata laluan mod kumpul",
    collect_bad_token: "Kata laluan salah, atau mod kumpul tidak diaktifkan di pelayan",
    collect_uploading: "Memuat naik…",
    collect_saved: "Disimpan ke “{name}” — {n} gambar dalam folder ini",
    collect_local_only: "Disimpan di pelayan sahaja; Google Drive belum disediakan",
    collect_drive_error: "Disimpan di pelayan, tetapi muat naik ke Google Drive gagal; boleh dimuat naik semula nanti",
    collect_ai_hint: "Teka AI",

    name_title: "Nama anda",
    name_text: "Gambar anda akan ditanda dengan nama ini supaya kami tahu siapa yang mengambilnya.",
    name_placeholder: "cth. Ali",
    name_change: "Tukar nama",
    join_title: "Selamat datang!",
    join_text: "Anda dijemput membantu mengumpul gambar daun durian. Masukkan nama dan tekan Enter untuk mula.",

    invite: "Jemput rakan membantu",
    invite_desc: "Rakan imbas kod QR dan masukkan nama sekali",
    invite_text: "Minta rakan imbas kod QR ini dengan kamera telefon. Sesiapa yang ada kod ini boleh memuat naik gambar, jadi kongsi dengan orang yang dipercayai sahaja.",
    copy_link: "Salin pautan",
    copied: "Disalin",

    ok: "OK",
    cancel: "Batal",
    close: "Tutup",
  },
};

// 病害名字的三语显示。key = 后端返回的类别 key。
const DISEASE_NAMES = {
  Leaf_Healthy:        { zh: "健康",             en: "Healthy",            ms: "Sihat" },
  Leaf_Algal:          { zh: "藻斑病",           en: "Algal leaf spot",    ms: "Bintik alga" },
  Leaf_Blight:         { zh: "叶枯病",           en: "Leaf blight",        ms: "Hawar daun" },
  Leaf_Colletotrichum: { zh: "炭疽病",           en: "Anthracnose",        ms: "Antraknos" },
  Leaf_Psyllid:        { zh: "木虱危害",         en: "Psyllid damage",     ms: "Serangan psilid" },
  Leaf_Phomopsis:      { zh: "Phomopsis 叶斑",   en: "Phomopsis spot",     ms: "Bintik Phomopsis" },
  Pest_Other:          { zh: "其他虫害",         en: "Other pest",         ms: "Perosak lain" },
  Unsure:              { zh: "不确定",           en: "Not sure",           ms: "Tidak pasti" },
  Leaf_Rhizoctonia:    { zh: "Rhizoctonia 叶枯", en: "Rhizoctonia blight", ms: "Hawar Rhizoctonia" },
};

// 8 种外观。颜色在 style.css 的 [data-theme="..."] 里。
const THEME_NAMES = {
  leaf:       { zh: "晨叶",   en: "Morning Leaf", ms: "Daun Pagi" },
  durian:     { zh: "榴莲金", en: "Durian Gold",  ms: "Emas Durian" },
  mint:       { zh: "薄荷",   en: "Mint",         ms: "Pudina" },
  mist:       { zh: "晨雾",   en: "Mist",         ms: "Kabus" },
  clay:       { zh: "红土",   en: "Clay",         ms: "Tanah Liat" },
  rainforest: { zh: "雨林",   en: "Rainforest",   ms: "Hutan Hujan" },
  midnight:   { zh: "午夜",   en: "Midnight",     ms: "Tengah Malam" },
  graphite:   { zh: "石墨",   en: "Graphite",     ms: "Grafit" },
};

// 取当前语言的病害名；没对应翻译时回退到 key 本身
function diseaseName(key, lang) {
  return (DISEASE_NAMES[key] && DISEASE_NAMES[key][lang]) || key;
}

function themeName(id, lang) {
  return (THEME_NAMES[id] && THEME_NAMES[id][lang]) || id;
}

// 把 {name}、{n} 这类占位符换成实际内容
function fillTemplate(text, values) {
  return text.replace(/\{(\w+)\}/g, (_, k) => (values[k] ?? ""));
}
