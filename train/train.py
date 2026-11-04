# =============================================================
# DurioML 训练脚本 —— YOLO 分类模式
# =============================================================
#
# 这个脚本做一件事：用「已经按病害分好文件夹」的照片，
# 微调一个 YOLO 分类模型，让它学会认榴莲叶病害，
# 最后导出成 best.onnx（后端要用的格式）。
#
# -------------------------------------------------------------
# 怎么在 Kaggle 上跑（推荐，免费 GPU）：
# -------------------------------------------------------------
# 1. 新建 Kaggle Notebook
# 2. 右侧 Settings → Accelerator → 选 GPU T4
# 3. 右侧 Add Input → 搜 "VNDurLeaf" 把 dataset 挂进来
# 4. 把本文件内容贴进一个 code cell
# 5. 改下面的 DATA_DIR 成 dataset 实际路径
#    （在 Kaggle 左边文件树里看，通常像 /kaggle/input/xxx）
# 6. 运行。结束后在输出目录能下载 best.onnx
#
# -------------------------------------------------------------
# dataset 要长这样（YOLO 分类的标准结构，文件夹名=类别名）：
# -------------------------------------------------------------
#   DATA_DIR/
#   ├── train/
#   │   ├── Leaf_Healthy/        <- 健康叶的照片都放这里
#   │   ├── Leaf_Algal/
#   │   └── ...（每个病一个文件夹）
#   ├── val/
#   │   ├── Leaf_Healthy/
#   │   └── ...
#   └── test/   （可选）
#       └── ...
#
# VNDurLeaf 本身已经分好 train/val/test，直接用即可。
# =============================================================

from ultralytics import YOLO

# ---- 1. 配置（你主要改这几行）----------------------------------

# dataset 根目录（里面要有 train/ 和 val/ 子文件夹）
# Kaggle 上通常是 /kaggle/input/<dataset名>/<可能还有一层>
DATA_DIR = "/kaggle/input/datasets/nguynphancminh/durianleafsubset2/dataset_split"   # ← 按实际路径改

# 用哪个预训练模型做底子：
#   yolo11n-cls.pt  最小最快，手机/CPU 部署首选（先用这个）
#   yolo11s-cls.pt  稍大、更准一点
MODEL = "yolo11n-cls.pt"

EPOCHS = 100        # 训练轮数。先 100，看验证曲线再调
IMGSZ = 224         # 输入图片尺寸，分类常用 224
BATCH = 32          # 一次喂多少张。Kaggle T4 设 32~64；设 -1 自动
PROJECT = "/kaggle/working/durioml"  # 输出文件夹（Kaggle 右侧 Output 看得到）
NAME = "cls_v1"     # 本次训练的名字
EXIST_OK = True     # 重跑时覆盖同名文件夹，路径不变

# ---- 1.5 先把照片缩小一份（大幅加快训练）-----------------------
# 原图很大，每一轮都要重新解码大图，CPU 跟不上，GPU 只能等。
# 先缩成长边 384 存一份到 /kaggle/temp（不会占用 Output 空间），
# 训练时每轮读小图，速度会快很多。模型输入只有 224，缩小不影响准确率。
from pathlib import Path
from PIL import Image, ImageOps

SMALL_DIR = Path("/kaggle/temp/data_small")
MAX_SIDE = 384

if not SMALL_DIR.exists():
    src = Path(DATA_DIR)
    n = 0
    for p in src.rglob("*"):
        if p.suffix.lower() in {".jpg", ".jpeg", ".png"}:
            out = (SMALL_DIR / p.relative_to(src)).with_suffix(".jpg")
            out.parent.mkdir(parents=True, exist_ok=True)
            img = ImageOps.exif_transpose(Image.open(p)).convert("RGB")  # 按照片的拍摄方向转正
            img.thumbnail((MAX_SIDE, MAX_SIDE))
            img.save(out, quality=92)
            n += 1
    print(f"已缩小 {n} 张照片 → {SMALL_DIR}")

TRAIN_DATA = str(SMALL_DIR)

# ---- 2. 训练 --------------------------------------------------

# 载入预训练模型（第一次会自动下载权重）
model = YOLO(MODEL)

# 开始训练。结果会存到 PROJECT/NAME/
results = model.train(
    data=TRAIN_DATA,
    epochs=EPOCHS,
    imgsz=IMGSZ,
    batch=BATCH,
    project=PROJECT,
    name=NAME,
    exist_ok=EXIST_OK,
    # ---- 数据增强（模拟真实拍照的各种变化，帮模型更耐用）----
    fliplr=0.5,     # 50% 概率左右翻转
    degrees=15,     # 随机旋转 ±15 度（拍照角度歪）
    hsv_h=0.015,    # 色调抖动
    hsv_s=0.5,      # 饱和度抖动（不同光线）
    hsv_v=0.4,      # 亮度抖动
    translate=0.1,  # 随机平移
    scale=0.5,      # 随机缩放（远近）
    patience=20,    # 连续 20 轮没进步就早停，省时间
)

# ---- 3. 导出成 ONNX（后端要用的格式）---------------------------

# best.pt 是训练过程中验证集表现最好的那个模型
# 用 trainer 记录的路径，重复训练时文件夹名变成 cls_v12 也不会找错
best_pt = model.trainer.best
best_model = YOLO(best_pt)

# 导出 ONNX。opset=12 对浏览器/各种运行时兼容性好
onnx_path = best_model.export(format="onnx", imgsz=IMGSZ, opset=12)

print("=" * 50)
print("训练完成！")
print(f"PyTorch 模型: {best_pt}")
print(f"ONNX 模型（后端用）: {onnx_path}")
print("把这个 best.onnx 下载下来，放进 backend/models/")
print("=" * 50)

# ---- 4.（可选）快速看看模型在验证集上的表现 --------------------
# 训练日志里会打印 top-1 / top-5 准确率，
# 以及混淆矩阵图（存在 runs 文件夹里），用来看哪两类容易认错。
metrics = best_model.val(data=TRAIN_DATA, split="val")
print("验证集 top-1 准确率:", metrics.top1)
print("验证集 top-5 准确率:", metrics.top5)

# ---- 5. 用测试集做最终评估（训练和挑模型都没用过这批图，分数最可信）----
test_metrics = best_model.val(data=TRAIN_DATA, split="test")
print("测试集 top-1 准确率:", test_metrics.top1)
print("测试集 top-5 准确率:", test_metrics.top5)
