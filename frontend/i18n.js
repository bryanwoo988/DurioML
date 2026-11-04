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
    subtitle: "拍一张榴莲叶照片，看看可能是什么病",
    scope: "目前可识别：藻斑病、叶枯病、炭疽病、Phomopsis 叶斑、Rhizoctonia 叶枯、健康叶。暂不支持虫害。",
    pick: "📷 拍照 / 选择照片",
    status_detecting: "识别中…",
    results_title: "最可能的病害（前三）",
    low_confidence: "⚠️ 信心不高，无法确定。建议补拍清晰照片，或咨询农业专家。",
    disclaimer: "辅助判断工具，不能替代专家。严重病害请找专业人士确认。",
    err_prefix: "❌ ",
  },
  en: {
    subtitle: "Take a photo of a durian leaf to see possible diseases",
    scope: "Currently recognizes: algal leaf spot, leaf blight, anthracnose, Phomopsis spot, Rhizoctonia blight, healthy leaves. Pests are not supported yet.",
    pick: "📷 Take / choose a photo",
    status_detecting: "Analyzing…",
    results_title: "Most likely diseases (top 3)",
    low_confidence: "⚠️ Low confidence. Please retake a clearer photo or consult an agronomist.",
    disclaimer: "An assistive tool, not a replacement for experts. Consult a professional for serious cases.",
    err_prefix: "❌ ",
  },
  ms: {
    subtitle: "Ambil gambar daun durian untuk lihat kemungkinan penyakit",
    scope: "Boleh dikenal pasti: bintik alga, hawar daun, antraknos, bintik Phomopsis, hawar Rhizoctonia, daun sihat. Serangan perosak belum disokong.",
    pick: "📷 Ambil / pilih gambar",
    status_detecting: "Menganalisis…",
    results_title: "Penyakit paling berkemungkinan (3 teratas)",
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
  Leaf_Phomopsis:      { zh: "Phomopsis 叶斑",  en: "Phomopsis spot",   ms: "Bintik Phomopsis" },
  Leaf_Rhizoctonia:    { zh: "Rhizoctonia 叶枯", en: "Rhizoctonia blight", ms: "Hawar Rhizoctonia" },
};

// 取当前语言的病害名；没对应翻译时回退到 key 本身
function diseaseName(key, lang) {
  return (DISEASE_NAMES[key] && DISEASE_NAMES[key][lang]) || key;
}
