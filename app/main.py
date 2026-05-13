import os
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from app.api.v1 import chat, oss, recipes, meal_plan, shopping, speech, nutrition, feishu, auth, preferences, ingredients, cook_history
from app.common.logger import setup_logging, logger

setup_logging()

app = FastAPI(
    title="Personal Chief API",
    description="AI私厨 - 食谱推荐助手",
    version="0.1.0"
)

cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat.router, prefix="/api/v1", tags=["chat"])
app.include_router(oss.router, prefix="/api/v1", tags=["oss"])
app.include_router(recipes.router, prefix="/api/v1/recipes", tags=["recipes"])
app.include_router(meal_plan.router, prefix="/api/v1", tags=["meal-plan"])
app.include_router(shopping.router, prefix="/api/v1/shopping", tags=["shopping"])
app.include_router(speech.router, prefix="/api/v1", tags=["speech"])
app.include_router(nutrition.router, prefix="/api/v1/nutrition", tags=["nutrition"])
app.include_router(feishu.router, prefix="/api/v1/feishu", tags=["feishu"])
app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(preferences.router, prefix="/api/v1/preferences", tags=["preferences"])
app.include_router(ingredients.router, prefix="/api/v1/ingredients", tags=["ingredients"])
app.include_router(cook_history.router, prefix="/api/v1/cook-history", tags=["cook-history"])


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    body = await request.body()
    logger.error(f"[422] {request.method} {request.url.path} — {exc.errors()}")
    logger.error(f"[422] body: {body.decode()[:500]}")
    return JSONResponse(status_code=422, content={"detail": exc.errors()})

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"未处理异常 {request.method} {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(status_code=500, content={"detail": "服务器内部错误"})


@app.on_event("startup")
async def startup():
    auth.init_db()
    recipes.init_db()
    shopping.init_db()
    nutrition.init_db()
    preferences.init_db()
    ingredients.init_db()
    cook_history.init_db()
    feishu.init_db()

@app.get("/health")
async def health():
    return {"status": "ok"}

@app.get("/api/v1/health")
async def api_health():
    return {"status": "ok"}

static_dir = os.path.join(os.path.dirname(__file__), "static")
if os.path.exists(static_dir):
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")

@app.get("/{path:path}", include_in_schema=False)
async def serve_frontend(path: str):
    if path.startswith("api/"):
        from fastapi.responses import JSONResponse
        return JSONResponse({"error": "Not Found"}, status_code=404)
    
    file_path = os.path.join(static_dir, path)
    if os.path.isfile(file_path):
        return FileResponse(file_path)
    
    index_path = os.path.join(static_dir, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"message": "你的独家私厨上线了~", "status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8001, reload=True)
