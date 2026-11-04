// =============================================================
// 三语文案字典 —— 中文 / English / Bahasa Melayu
// =============================================================
//
// 要改语言或加语言：
//   - UI 文字：改 UI_TEXT 里对应的 key
//   - 病害名字：改 DISEASE_NAMES，key 必须和后端返回的 key 一致
//     （后端 /predict 返回的 "key" 字段，如 Leaf_Algal）
//
// 加第四种语言：在三个地方各加一段，再在 index.html 的 <select> 加一个 <option>。
// =============================================================

const UI_TEXT = {
  zh: {
    subtitle: "拍一张榴莲叶照片，看看可能是什么病虫害",
    scope_prefix: "目前可识别：",
    scope_sep: "、",
    scope_suffix: "。其他病虫害暂时无法识别。",
    pick: "📷 拍照 / 选择照片",
    status_detecting: "识别中…",
    results_title: "最可能的病虫害（前三）",
    low_confidence: "⚠️ 信心不高，无法确定。建议补拍清晰照片，或咨询农业专家。",
    disclaimer: "辅助判断工具，不能替代专家。严重病害请找专业人士确认。",
    err_prefix: "❌ ",
  },
  en: {
    subtitle: "Take a photo of a durian leaf to see possible diseases or pests",
    scope_prefix: "Currently recognizes: ",
    scope_sep: ", ",
    scope_suffix: ". Other problems can't be recognized yet.",
    pick: "📷 Take / choose a photo",
    status_detecting: "Analyzing…",
    results_title: "Most likely problems (top 3)",
    low_confidence: "⚠️ Low confidence. Please retake a clearer photo or consult an agronomist.",
    disclaimer: "An assistive tool, not a replacement for experts. Consult a professional for serious cases.",
    err_prefix: "❌ ",
  },
  ms: {
    subtitle: "Ambil gambar daun durian untuk lihat kemungkinan penyakit atau perosak",
    scope_prefix: "Boleh dikenal pasti: ",
    scope_sep: ", ",
    scope_suffix: ". Masalah lain belum boleh dikenal pasti.",
    pick: "📷 Ambil / pilih gambar",
    status_detecting: "Menganalisis…",
    results_title: "Masalah paling berkemungkinan (3 teratas)",
    low_confidence: "⚠️ Keyakinan rendah. Sila ambil gambar lebih jelas atau rujuk pakar pertanian.",
    disclaimer: "Alat bantuan, bukan pengganti pakar. Rujuk profesional untuk kes serius.",
    err_prefix: "❌ ",
  },
};

// 病害名字的三语显示。key = 后端返回的类别 key。
const DISEASE_NAMES = {
  Leaf_Healthy:        { zh: "健康",            en: "Healthy",          ms: "Sihat" },
  Leaf_Algal:          { zh: "藻斑病",          en: "Algal leaf spot",  ms: "Bintik alga" },
  Leaf_Blight:         { zh: "叶枯病",          en: "Leaf blight",      ms: "Hawar daun" },
  Leaf_Colletotrichum: { zh: "炭疽病",          en: "Anthracnose",      ms: "Antraknos" },
  Leaf_Psyllid:        { zh: "木虱危害",        en: "Psyllid damage",   ms: "Serangan psilid" },
  Leaf_Phomopsis:      { zh: "Phomopsis 叶斑",  en: "Phomopsis spot",   ms: "Bintik Phomopsis" },
  Leaf_Rhizoctonia:    { zh: "Rhizoctonia 叶枯", en: "Rhizoctonia blight", ms: "Hawar Rhizoctonia" },
};

// 取当前语言的病害名；没对应翻译时回退到 key 本身
function diseaseName(key, lang) {
  return (DISEASE_NAMES[key] && DISEASE_NAMES[key][lang]) || key;
}
