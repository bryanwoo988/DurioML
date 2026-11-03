# DurioML 后端镜像
# 只打包后端 + 前端静态文件。模型(best.onnx)通过挂载卷传入，不打进镜像。
FROM python:3.11-slim

WORKDIR /app

# 先装依赖（利用 Docker 缓存，依赖没变就不重装）
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

# 复制代码
COPY backend ./backend
COPY frontend ./frontend
COPY train/classes.txt ./train/classes.txt

WORKDIR /app/backend

EXPOSE 8000

# 启动（生产环境不加 --reload）
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
