import os
import uvicorn

if __name__ == "__main__":
    is_dev = os.getenv("APP_ENV", "production") != "production"
    uvicorn.run("app.main:app", host="0.0.0.0", port=8001, reload=is_dev)
