# =============================================================
# 一次性设定：授权 DurioML 把照片存进你的 Google Drive
# =============================================================
#
# 用法（在 backend 文件夹里）：
#   1. 先照 README 的步骤，在 Google Cloud 建好 OAuth 客户端，
#      把下载的 JSON 改名成 client_secret.json，放在 backend/ 里
#   2. pip install google-auth-oauthlib
#   3. python get_drive_token.py
#   4. 浏览器会打开 Google 登录页，选你的帐号 → 允许
#   5. 完成后会自动写好 backend/.env（含收集密码），终端机会显示密码
#
# 权限只有 drive.file：DurioML 只能看到、修改它自己建立的文件，
# 碰不到你 Drive 里的其他东西。
# =============================================================

import json
import secrets
from pathlib import Path

from google_auth_oauthlib.flow import InstalledAppFlow

HERE = Path(__file__).resolve().parent
SECRET_FILE = HERE / "client_secret.json"
ENV_FILE = HERE / ".env"
SCOPES = ["https://www.googleapis.com/auth/drive.file"]

if not SECRET_FILE.exists():
    raise SystemExit(f"找不到 {SECRET_FILE}，请先从 Google Cloud 下载 OAuth 客户端 JSON，改名放到这里。")

flow = InstalledAppFlow.from_client_secrets_file(str(SECRET_FILE), SCOPES)
# prompt=consent 确保 Google 一定会给 refresh token
creds = flow.run_local_server(port=0, access_type="offline", prompt="consent")

client = json.loads(SECRET_FILE.read_text())
client = client.get("installed") or client.get("web")

# 保留 .env 里原本的其他设定，只更新这几项
env = {}
if ENV_FILE.exists():
    for line in ENV_FILE.read_text().splitlines():
        if "=" in line and not line.strip().startswith("#"):
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip()

env["GOOGLE_CLIENT_ID"] = client["client_id"]
env["GOOGLE_CLIENT_SECRET"] = client["client_secret"]
env["GOOGLE_REFRESH_TOKEN"] = creds.refresh_token
env.setdefault("COLLECT_TOKEN", secrets.token_urlsafe(9))   # 收集模式的密码
env.setdefault("DRIVE_ROOT_NAME", "DurioML")

ENV_FILE.write_text("".join(f"{k}={v}\n" for k, v in env.items()))

print("=" * 50)
print("✅ 授权完成，设定已写进 backend/.env")
print(f"收集模式密码：{env['COLLECT_TOKEN']}")
print("（在手机上第一次进入收集模式时要输入这个密码）")
print("启动后端时记得加上 --env-file .env")
print("=" * 50)
