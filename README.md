# DurioML

榴莲叶片病虫害识别 —— 用户拍照 → 模型判断 → 排出最可能的前三种病害。

> 本仓库是「骨架 / starter」。它帮你把整条链路跑通：**训练 → 导出模型 → 后端 API → PWA 拍照页 → Docker 部署**。
> 代码配中文注解，让你边做边懂。

---

## 架构总览

```
用户手机拍照
      │
      ▼
PWA 前端 (frontend/)  ──拍照、上传、显示结果
      │  POST /predict  (一张图片)
      ▼
FastAPI 后端 (backend/) ──载入 ONNX 模型，回传 top-3 病害 + 信心分数
      │
      ▼
YOLO 分类模型 (train/ 训练导出的 best.onnx)
```

- **训练**：在 Kaggle 免费 GPU 上跑 `train/train.py`，几分钟到一两小时出一个模型。
- **运营**：模型在 **CPU** 上就能跑，不用租 GPU 服务器，一台便宜 VPS 即可。

---

## 授权说明（重要）

- 本项目使用 **Ultralytics YOLO**，其授权为 **AGPL-3.0**。
- 因此本仓库源码采用 **AGPL-3.0**（见 `LICENSE`），**必须公开**。
- **你的照片 / dataset 不受影响，不用公开** —— AGPL 管的是软件代码，不是数据。
- 若将来要「闭源商用」，需改用授权宽松的模型（如 timm）或购买 Ultralytics Enterprise License。

---

## 目录结构

```
DurioML/
├── train/
│   ├── train.py              训练脚本（Kaggle 可直接跑）
│   └── classes.txt           类别清单（顺序必须和训练一致）
├── backend/
│   ├── main.py               FastAPI：收照片 → 回传 top-3
│   ├── requirements.txt
│   └── models/               放训练导出的 best.onnx（自己放，git 不追踪）
├── frontend/
│   ├── index.html            拍照页
│   ├── app.js                上传照片、显示排名
│   ├── style.css
│   ├── manifest.json         PWA 配置
│   ├── sw.js                 service worker
│   └── icons/                PWA 图标（自己放）
├── Dockerfile
├── docker-compose.yml        后端 + Caddy(自动 HTTPS)
├── Caddyfile
├── LICENSE                   AGPL-3.0
└── README.md
```

---

## 快速开始

### 第 1 步：训练模型（Kaggle）

1. 下载公开 dataset（已分好类）：[VNDurLeaf](https://www.kaggle.com/datasets/nguynphancminh/durianleafsubset2)
   - **下载前确认它的授权允许你的用途。**
2. 新建 Kaggle Notebook，右侧 Settings → Accelerator 选 **GPU (T4)**。
3. 把 dataset 挂进 Notebook，把 `train/train.py` 的内容贴进去，改好 `DATA_DIR` 路径。
4. 运行。结束后会得到 `best.pt` 和 `best.onnx`。
5. 下载 `best.onnx`，放进 `backend/models/`。

详见 `train/train.py` 顶部注释。

### 第 2 步：本地跑后端 + 前端

```bash
# 后端
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

浏览器打开 `http://localhost:8000` 就能看到拍照页。手机和电脑在同一 WiFi，用电脑的局域网 IP（如 `http://192.168.x.x:8000`）也能在手机上测。

### 第 3 步：部署（上线时）

```bash
# 在 VPS 上（已装 Docker）
# 先把 Caddyfile 里的域名改成你自己的
docker compose up -d
```

Caddy 会自动申请 HTTPS 证书。详见 `docker-compose.yml`。

---

## 收集模式（拍照 → 选类别 → 存进 Google Drive）

只有知道密码的人能用。拍照后模型先猜一次，你再按正确的类别，
照片会存进 Google Drive 的 `DurioML/<类别>/` 文件夹，服务器上也留一份备份（`backend/collected/`）。
文件夹结构和训练用的 dataset 一样，可以直接拿去训练分类模型，也可以拿到 Roboflow 画框。

### 一次性设定 Google Drive（约 20–30 分钟）

1. 打开 https://console.cloud.google.com ，左上角新建项目，名字填 `DurioML`
2. 左边菜单 **APIs & Services → Library**，搜 `Google Drive API` → **Enable**
3. **APIs & Services → OAuth consent screen**（新版叫 Google Auth Platform）
   - User type 选 **External**，App name 填 `DurioML`，email 填你自己的
   - Scopes 不用加
   - **Publishing status 按 Publish app，改成 In production**
     （停在 Testing 的话，授权 7 天后会失效，要重新授权）
4. **APIs & Services → Credentials → Create Credentials → OAuth client ID**
   - Application type 选 **Desktop app** → Create → **Download JSON**
   - 把下载的文件改名成 `client_secret.json`，放进 `backend/` 文件夹
5. 在 Mac 终端机（`backend` 文件夹里，已经 `source .venv/bin/activate`）：
   ```bash
   pip install -r requirements.txt google-auth-oauthlib
   python get_drive_token.py
   ```
   浏览器会打开 Google 登录页：选你的帐号 → 如果出现「Google 尚未验证这个应用」，点 **进阶 → 前往 DurioML** → 允许。
   完成后终端机会显示**收集模式密码**，设定会自动写进 `backend/.env`。
6. 以后启动后端都加上 `--env-file .env`：
   ```bash
   uvicorn main:app --host 0.0.0.0 --port 8000 --env-file .env
   ```

`backend/.env` 和 `client_secret.json` 等于你 Google 帐号的钥匙，**不会**被 git 上传（已写进 `.gitignore`），也不要传给别人。

### 使用

页面最下面点 **收集模式** → 输入密码 → 拍照 → 按类别。
没有设定 Google Drive 时，照片只存在服务器的 `backend/collected/`，页面会提示。

---

## 路线图

- [x] 第一阶段：公开 dataset 打通链路（分类，top-3）
- [ ] 第二阶段：上线，收集真实用户照片
- [ ] 第三阶段：用自己的照片重训，提高准确率
- [ ] （可选）升级为检测模型（画框、标出病征位置）

---

## 数据来源

- Training data: [VNDurLeaf](https://www.kaggle.com/datasets/nguynphancminh/durianleafsubset2) (Kaggle, Nguyễn Phan Đức Minh), Apache License 2.0

---

## 注意事项

- 本工具是**辅助判断**，不能替代农业专家。严重病害请找专业人士确认。
- 识别结果带信心分数；分数低时应提示用户「无法确定」。
- 用药建议须符合当地农药法规。
