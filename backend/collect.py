# =============================================================
# 收集模式 —— 拍照 + 选类别 → 存进 Google Drive 对应的文件夹
# =============================================================
#
# 文件夹结构（和训练用的 dataset 一样，一个类别一个文件夹）：
#   Google Drive / DurioML / Leaf_Algal / 20261105_093012_a1b2.jpg
#                          / Leaf_Psyllid / ...
#
# 同时在服务器本地存一份备份：backend/collected/<类别>/...
#
# 需要的环境变量（放在 backend/.env，get_drive_token.py 会帮你生成）：
#   COLLECT_TOKEN          收集模式的密码。没设的话收集功能整个关闭
#   GOOGLE_CLIENT_ID       ┐
#   GOOGLE_CLIENT_SECRET   ├ Google Drive 授权。没设的话只存本地备份
#   GOOGLE_REFRESH_TOKEN   ┘
#   DRIVE_ROOT_NAME        Drive 里的总文件夹名，默认 DurioML
# =============================================================

import hmac
import io
import os
import secrets
import threading
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, File, Form, Header, HTTPException, UploadFile

# 收集时可以选的类别。前面几个名字和训练类别一致，
# 所以 Drive 的文件夹下载下来可以直接拿去训练。
COLLECT_LABELS = [
    "Leaf_Algal",
    "Leaf_Blight",
    "Leaf_Colletotrichum",
    "Leaf_Phomopsis",
    "Leaf_Rhizoctonia",
    "Leaf_Psyllid",
    "Pest_Other",     # 其他虫害（先收集，以后再细分）
    "Leaf_Healthy",
    "Unsure",         # 看不出是什么，之后请专家认
]

BASE_DIR = Path(__file__).resolve().parent
LOCAL_DIR = Path(os.environ.get("COLLECT_DIR", BASE_DIR / "collected"))
DRIVE_ROOT_NAME = os.environ.get("DRIVE_ROOT_NAME", "DurioML")

router = APIRouter()


# ---- 密码检查 -------------------------------------------------

def check_token(token):
    expected = os.environ.get("COLLECT_TOKEN", "")
    if not expected:
        raise HTTPException(status_code=403, detail="收集模式未开启：服务器没有设定 COLLECT_TOKEN")
    if not token or not hmac.compare_digest(token, expected):
        raise HTTPException(status_code=401, detail="收集密码不对")


# ---- Google Drive ---------------------------------------------

class DriveUploader:
    """用你自己的 Google 帐号授权，把照片存进你的 Drive。"""

    def __init__(self):
        self._service = None
        self._folder_ids = {}          # 文件夹名 → Drive 文件夹 id（缓存，不用每次查）
        self._lock = threading.Lock()

    @staticmethod
    def configured():
        return all(os.environ.get(k) for k in
                   ("GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REFRESH_TOKEN"))

    def _get_service(self):
        if self._service is None:
            from google.oauth2.credentials import Credentials
            from googleapiclient.discovery import build

            creds = Credentials(
                token=None,
                refresh_token=os.environ["GOOGLE_REFRESH_TOKEN"],
                client_id=os.environ["GOOGLE_CLIENT_ID"],
                client_secret=os.environ["GOOGLE_CLIENT_SECRET"],
                token_uri="https://oauth2.googleapis.com/token",
                scopes=["https://www.googleapis.com/auth/drive.file"],
            )
            self._service = build("drive", "v3", credentials=creds, cache_discovery=False)
        return self._service

    def _folder(self, name, parent_id=None):
        """找到（或建立）文件夹，回传它的 id。"""
        cache_key = f"{parent_id}/{name}"
        if cache_key in self._folder_ids:
            return self._folder_ids[cache_key]
        service = self._get_service()
        q = (f"name = '{name}' and mimeType = 'application/vnd.google-apps.folder' "
             f"and trashed = false")
        if parent_id:
            q += f" and '{parent_id}' in parents"
        found = service.files().list(q=q, fields="files(id)", pageSize=1).execute().get("files", [])
        if found:
            folder_id = found[0]["id"]
        else:
            body = {"name": name, "mimeType": "application/vnd.google-apps.folder"}
            if parent_id:
                body["parents"] = [parent_id]
            folder_id = service.files().create(body=body, fields="id").execute()["id"]
        self._folder_ids[cache_key] = folder_id
        return folder_id

    def upload(self, label, filename, data, mimetype, description):
        from googleapiclient.http import MediaIoBaseUpload

        with self._lock:   # 避免同时建立两个同名文件夹
            root = self._folder(DRIVE_ROOT_NAME)
            folder = self._folder(label, root)
        media = MediaIoBaseUpload(io.BytesIO(data), mimetype=mimetype, resumable=False)
        body = {"name": filename, "parents": [folder], "description": description}
        return self._get_service().files().create(body=body, media_body=media, fields="id").execute()["id"]


drive = DriveUploader()


# ---- API ------------------------------------------------------

@router.get("/collect/labels")
def labels(x_collect_token: str = Header(default="")):
    """收集模式可选的类别，以及每个类别已经收集了几张（按本地备份计算）。"""
    check_token(x_collect_token)
    counts = {}
    for label in COLLECT_LABELS:
        folder = LOCAL_DIR / label
        counts[label] = sum(1 for _ in folder.glob("*")) if folder.exists() else 0
    return {"labels": COLLECT_LABELS, "counts": counts, "drive": drive.configured()}


@router.post("/collect")
def collect(
    file: UploadFile = File(...),
    label: str = Form(...),
    ai_guess: str = Form(default=""),
    x_collect_token: str = Header(default=""),
):
    """存一张照片：本地备份一份，再上传到 Google Drive 的类别文件夹。"""
    check_token(x_collect_token)
    if label not in COLLECT_LABELS:
        raise HTTPException(status_code=400, detail=f"不认识的类别: {label}")
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="请上传图片文件")

    data = file.file.read()   # 原图，不压缩，保留画质给训练用
    ext = {"image/png": ".png", "image/webp": ".webp", "image/heic": ".heic"}.get(file.content_type, ".jpg")
    filename = f"{datetime.now():%Y%m%d_%H%M%S}_{secrets.token_hex(2)}{ext}"

    # 1. 本地备份（就算 Drive 失败，照片也不会丢）
    local_path = LOCAL_DIR / label / filename
    local_path.parent.mkdir(parents=True, exist_ok=True)
    local_path.write_bytes(data)

    # 2. 上传 Google Drive
    drive_id, drive_error = None, None
    if drive.configured():
        try:
            # 把模型当时的猜测记在文件说明里，之后可以分析模型在哪里猜错
            drive_id = drive.upload(label, filename, data, file.content_type,
                                    description=f"label={label}; ai_guess={ai_guess}")
        except Exception as e:
            drive_error = str(e)[:200]

    count = sum(1 for _ in (LOCAL_DIR / label).glob("*"))
    return {
        "saved": filename,
        "label": label,
        "count": count,
        "drive": drive_id is not None,
        "drive_error": drive_error,
    }
