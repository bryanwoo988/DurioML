# =============================================================
# DurioML 训练脚本 v2 —— 合并多个 dataset，加入「木虱危害」
# =============================================================
#
# 和 v1 的差别：
#   - 不再只读 VNDurLeaf，而是扫描 /kaggle/input 底下所有挂进来的 dataset
#   - 按文件夹名自动对应到统一的类别（见下面 CLASS_RULES）
#   - 去掉两个 dataset 之间完全重复的照片
#   - 全部混在一起后，重新按 70/15/15 切 train/val/test
#   - 训练完印出每个类别各自的测试准确率
#
# 在 Kaggle 上用法：
#   1. Notebook 右侧 Input → Add Input，把 VNDurLeaf 和
#      cthng123 的 "Durian Leaf Disease Dataset" 都挂进来
#   2. 第 1 格：!pip install ultralytics
#   3. 第 2 格：贴上本文件全部内容
#   4. 右上角 Save Version → Save & Run All (Commit)
# =============================================================

import hashlib
import os
import random
import shutil
from collections import defaultdict
from pathlib import Path

from PIL import Image, ImageOps

# ---- 1. 配置 --------------------------------------------------

INPUT_ROOT = Path(os.environ.get("DURIO_INPUT", "/kaggle/input"))       # 所有挂进来的 dataset
DATA_DIR = Path(os.environ.get("DURIO_DATA", "/kaggle/temp/data_v2"))   # 合并后的数据（缩小版）
MAX_SIDE = 384          # 照片长边缩到 384，加快训练
SPLIT = (0.70, 0.15, 0.15)   # train / val / test
SEED = 42               # 固定随机种子，每次切分结果一样
MIN_IMAGES = 20         # 少于这个数量的类别不训练（val/test 会分不到图）

MODEL = "yolo11n-cls.pt"
EPOCHS = 100
IMGSZ = 224
BATCH = 32
PROJECT = "/kaggle/working/durioml"
NAME = "cls_v2"

# 文件夹名里出现这些关键字 → 归到哪个类别。
# 顺序有意义：先比对的先用（例如 "Rhizoctonia leaf blight" 要算 Rhizoctonia，不是 Blight）。
CLASS_RULES = [
    (("allocaridara", "psyllid", "psylla"), "Leaf_Psyllid"),
    (("algal", "alga"), "Leaf_Algal"),
    (("colletotrichum", "anthracnose"), "Leaf_Colletotrichum"),
    (("rhizoctonia",), "Leaf_Rhizoctonia"),
    (("phomopsis",), "Leaf_Phomopsis"),
    (("blight",), "Leaf_Blight"),
    (("healthy", "normal"), "Leaf_Healthy"),
]

IMG_EXT = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}


def match_class(folder_name):
    name = folder_name.lower()
    for keywords, cls in CLASS_RULES:
        if any(k in name for k in keywords):
            return cls
    return None


def source_of(rel):
    # /kaggle/input/datasets/<作者>/<dataset名>/... → "<作者>/<dataset名>"
    parts = rel.parts
    if parts[0] == "datasets" and len(parts) > 2:
        return f"{parts[1]}/{parts[2]}"
    return parts[0]


# ---- 2. 扫描所有 dataset，合并、去重、重新切分 ------------------

items = defaultdict(list)      # 类别 → [(照片路径, 来源)]
unmatched = defaultdict(int)   # 认不出类别的文件夹 → 张数
seen, duplicates = set(), 0

for p in sorted(INPUT_ROOT.rglob("*")):
    if p.suffix.lower() not in IMG_EXT or not p.is_file():
        continue
    rel = p.relative_to(INPUT_ROOT)
    cls = None
    for folder in reversed(rel.parts[:-1]):   # 从最靠近照片的文件夹开始找
        cls = match_class(folder)
        if cls:
            break
    if not cls:
        unmatched[str(rel.parent)] += 1
        continue
    digest = hashlib.md5(p.read_bytes()).hexdigest()
    if digest in seen:          # 两个 dataset 里一模一样的照片只留一张
        duplicates += 1
        continue
    seen.add(digest)
    items[cls].append((p, source_of(rel)))

print("=" * 60)
print("各类别照片数（按来源）：")
sources = sorted({src for lst in items.values() for _, src in lst})
for cls in sorted(items):
    counts = {s: sum(1 for _, src in items[cls] if src == s) for s in sources}
    detail = ", ".join(f"{s}: {n}" for s, n in counts.items() if n)
    print(f"  {cls:22s} 共 {len(items[cls]):5d} 张  ({detail})")
print(f"去掉重复照片: {duplicates} 张")
if unmatched:
    print("⚠️ 以下文件夹认不出类别，已跳过（如果里面是有用的照片，告诉我改 CLASS_RULES）：")
    for folder, n in sorted(unmatched.items()):
        print(f"    {folder}  ({n} 张)")
print("=" * 60)

if DATA_DIR.exists():
    shutil.rmtree(DATA_DIR)

kept = []
for cls in sorted(items):
    lst = items[cls]
    if len(lst) < MIN_IMAGES:
        print(f"⚠️ {cls} 只有 {len(lst)} 张，少于 {MIN_IMAGES}，这次先不训练这一类")
        continue
    kept.append(cls)
    random.Random(SEED).shuffle(lst)
    n_train = int(len(lst) * SPLIT[0])
    n_val = int(len(lst) * SPLIT[1])
    parts = {
        "train": lst[:n_train],
        "val": lst[n_train:n_train + n_val],
        "test": lst[n_train + n_val:],
    }
    for split, part in parts.items():
        out_dir = DATA_DIR / split / cls
        out_dir.mkdir(parents=True, exist_ok=True)
        for i, (p, src) in enumerate(part):
            try:
                img = ImageOps.exif_transpose(Image.open(p)).convert("RGB")
            except Exception:
                print(f"    跳过读不了的照片: {p}")
                continue
            img.thumbnail((MAX_SIDE, MAX_SIDE))
            # 文件名带上来源，之后分析认错的照片时看得出是哪个 dataset
            img.save(out_dir / f"{src.replace('/', '_')}_{i:05d}.jpg", quality=92)

print(f"训练类别: {kept}")
print(f"数据已整理到 {DATA_DIR}")

# ---- 3. 训练 --------------------------------------------------

from ultralytics import YOLO

model = YOLO(MODEL)
model.train(
    data=str(DATA_DIR),
    epochs=EPOCHS,
    imgsz=IMGSZ,
    batch=BATCH,
    project=PROJECT,
    name=NAME,
    exist_ok=True,
    fliplr=0.5,
    degrees=15,
    hsv_h=0.015,
    hsv_s=0.5,
    hsv_v=0.4,
    translate=0.1,
    scale=0.5,
    patience=20,
)

# ---- 4. 导出 ONNX ---------------------------------------------

best_pt = model.trainer.best
best_model = YOLO(best_pt)
onnx_path = best_model.export(format="onnx", imgsz=IMGSZ, opset=12)

print("=" * 60)
print("训练完成！")
print(f"ONNX 模型（后端用）: {onnx_path}")
print("下载 best.onnx，替换掉 backend/models/ 里的旧模型")
print("=" * 60)

# ---- 5. 测试集评估 + 每个类别各自的准确率 ------------------------

test_metrics = best_model.val(data=str(DATA_DIR), split="test")
print("测试集 top-1 准确率:", test_metrics.top1)
print("测试集 top-5 准确率:", test_metrics.top5)

try:
    # 混淆矩阵：行是模型预测的类别，列是真实类别
    cm = test_metrics.confusion_matrix.matrix
    names = best_model.names
    print("每个类别的测试准确率（这一类的照片里，第一名猜对的比例）：")
    for i in range(len(names)):
        total = cm[:, i].sum()
        if total:
            print(f"  {names[i]:22s} {cm[i, i] / total:6.1%}  ({int(cm[i, i])}/{int(total)})")
except Exception as e:
    print("（每类准确率计算失败，不影响模型）", e)
