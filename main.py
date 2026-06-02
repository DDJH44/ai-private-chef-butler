"""Docker 入口：通过 uvicorn 启动 FastAPI 应用"""
import os
import uvicorn

if __name__ == "__main__":
    host = os.getenv("APP_HOST", "0.0.0.0")
    port = int(os.getenv("APP_PORT", "8001"))
    uvicorn.run("app.main:app", host=host, port=port, reload=False)
