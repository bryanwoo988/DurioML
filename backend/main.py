# =============================================================
# DurioML 后端 —— FastAPI
# =============================================================
#
# 做的事：
#   1. 提供拍照页（frontend/ 里的静态网页）
#   2. 提供 /predict 接口：收一张照片 → 回传 top-3 病害 + 信心分数
#   3. 收集模式 /collect：照片按类别存进 Google Drive（见 collect.py）
#
# 用 onnxruntime 载入训练导出的 best.onnx，在 CPU 上就能跑，
# 不需要 GPU，所以一台便宜 VPS 就够。
#
# 本地运行：
#   cd backend
#   pip install -r requirements.txt
#   uvicorn main:app --host 0.0.0.0 --port 8000 --env-file .env
# 然后浏览器打开 http://localhost:8000
# =============================================================

import ast
from contextlib import asynccontextmanager
from pathlib import Path

import numpy as np
import onnxruntime as ort
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from PIL import Image, ImageOps
import io

from collect import router as collect_router

# ---- 路径配置 -------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "models" / "best.onnx"
CLASSES_PATH = BASE_DIR.parent / "train" / "classes.txt"
FRONTEND_DIR = BASE_DIR.parent / "frontend"

IMG_SIZE = 224   # 必须和训练时的 imgsz 一致

# ---- 类别名（顺序必须和训练时完全一致）------------------------
# 从 train/classes.txt 读。也可以在这里改成中文显示名。
def load_classes():
    if CLASSES_PATH.exists():
        return [l.strip() for l in CLASSES_PATH.read_text(encoding="utf-8").splitlines() if l.strip()]
    # 兜底：万一文件不在
    # YOLO 按文件夹名的字母顺序编号，所以这里也要按字母排
    return ["Leaf_Algal", "Leaf_Blight", "Leaf_Colletotrichum",
            "Leaf_Healthy", "Leaf_Phomopsis", "Leaf_Rhizoctonia"]

CLASSES = load_classes()

# 病害的中文显示名（key 要和 classes.txt 对得上）
# 显示给用户看的名字，可自由改
DISPLAY_NAME = {
    "Leaf_Healthy": "健康",
    "Leaf_Algal": "藻斑病",
    "Leaf_Blight": "叶枯病",
    "Leaf_Colletotrichum": "炭疽病",
    "Leaf_Phomopsis": "Phomopsis 叶斑",
    "Leaf_Rhizoctonia": "Rhizoctonia 叶枯",
}

# ---- 载入模型（服务启动时载一次，常驻内存）--------------------
session = None
input_name = None

def load_model():
    global session, input_name
    if not MODEL_PATH.exists():
        # 模型还没放进来时，不让服务崩，只是 /predict 会报错提示
        print(f"[警告] 找不到模型: {MODEL_PATH}")
        print("        训练完把 best.onnx 放到 backend/models/ 再重启。")
        return
    session = ort.InferenceSession(str(MODEL_PATH), providers=["CPUExecutionProvider"])
    input_name = session.get_inputs()[0].name

    # Ultralytics 导出 ONNX 时会把类别名写进模型 metadata。
    # 优先用模型自带的类别顺序，避免和 classes.txt 对不上。
    global CLASSES
    meta = session.get_modelmeta().custom_metadata_map
    if "names" in meta:
        try:
            names = ast.literal_eval(meta["names"])  # 形如 {0: 'Leaf_Algal', ...}
            CLASSES = [names[i] for i in sorted(names)]
        except Exception:
            pass
    print(f"[model] 已载入 {MODEL_PATH.name}  classes={CLASSES}")

# ---- 图片预处理：和训练时保持一致 -----------------------------
def preprocess(image_bytes: bytes) -> np.ndarray:
    img = Image.open(io.BytesIO(image_bytes))
    img = ImageOps.exif_transpose(img).convert("RGB")  # 手机照片按拍摄方向转正

    # 和 YOLO 分类验证时一样：短边缩到 224，再从中间裁出 224x224（不压扁变形）
    w, h = img.size
    scale = IMG_SIZE / min(w, h)
    img = img.resize((max(IMG_SIZE, round(w * scale)), max(IMG_SIZE, round(h * scale))), Image.BILINEAR)
    w, h = img.size
    left, top = (w - IMG_SIZE) // 2, (h - IMG_SIZE) // 2
    img = img.crop((left, top, left + IMG_SIZE, top + IMG_SIZE))
    arr = np.asarray(img, dtype=np.float32) / 255.0   # 归一化到 0~1
    arr = np.transpose(arr, (2, 0, 1))                # HWC → CHW
    arr = np.expand_dims(arr, axis=0)                 # 加 batch 维 → (1,3,224,224)
    return arr

def softmax(x: np.ndarray) -> np.ndarray:
    e = np.exp(x - np.max(x))
    return e / e.sum()

# ---- FastAPI 应用 --------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    load_model()   # 服务启动时载入模型一次
    yield

app = FastAPI(title="DurioML API", lifespan=lifespan)

@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    """收一张照片，回传 top-3 病害 + 信心分数（0~1）。"""
    if session is None:
        raise HTTPException(status_code=503, detail="模型未载入：请先把 best.onnx 放到 backend/models/")

    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="请上传图片文件")

    image_bytes = await file.read()
    try:
        x = preprocess(image_bytes)
    except Exception:
        raise HTTPException(status_code=400, detail="无法读取这张图片")

    # 推理
    outputs = session.run(None, {input_name: x})
    logits = np.asarray(outputs[0]).reshape(-1)

    # YOLO 分类的输出通常已经是概率；保险起见再过一次 softmax 归一化
    probs = softmax(logits) if logits.min() < 0 or logits.max() > 1 else logits / logits.sum()

    # 取前三名
    top_idx = probs.argsort()[::-1][:3]
    results = []
    for i in top_idx:
        key = CLASSES[i] if i < len(CLASSES) else f"class_{i}"
        results.append({
            "name": DISPLAY_NAME.get(key, key),
            "key": key,
            "confidence": round(float(probs[i]), 4),  # 0~1
        })

    # 最高分太低时，提示「无法确定」
    low_confidence = results[0]["confidence"] < 0.5

    return JSONResponse({
        "top3": results,
        "low_confidence": low_confidence,
    })

@app.get("/health")
def health():
    return {"status": "ok", "model_loaded": session is not None}

@app.get("/classes")
def classes():
    """当前模型认得的类别，前端用它显示「目前可识别」。"""
    return {"classes": CLASSES if session is not None else []}

app.include_router(collect_router)

# ---- 把前端静态文件挂上（放最后，让 /predict /health 优先匹配）----
app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")
