from fastapi import APIRouter, UploadFile, File, Query, Depends
from app.auth import get_current_user
from fastapi.responses import JSONResponse, Response
from app.models.schemas import OSSUploadRequest, OSSUploadResponse
from app.common.logger import logger
import os
from datetime import datetime
import oss2
import httpx
import urllib.parse
from dotenv import load_dotenv

load_dotenv()

router = APIRouter(dependencies=[Depends(get_current_user)])

def _get_bucket():
    """延迟初始化 OSS Bucket，确保环境变量已加载"""
    auth = oss2.Auth(
        os.getenv("OSS_ACCESS_KEY_ID"),
        os.getenv("OSS_ACCESS_KEY_SECRET")
    )
    return oss2.Bucket(
        auth,
        "https://" + os.getenv("OSS_ENDPOINT", "oss-cn-beijing.aliyuncs.com"),
        os.getenv("OSS_BUCKET")
    )

CONTENT_TYPE_MAP = {
    "jpg": "image/jpeg", "jpeg": "image/jpeg",
    "png": "image/png", "gif": "image/gif", "webp": "image/webp",
}

DANGEROUS_PATTERNS = [
    "localhost", "127.0.0.1", "0.0.0.0", "::1",
    "10.", "172.16.", "192.168.", "169.254.",
    "file://", "ftp://", "javascript:", "data:",
]

def is_safe_image_url(url: str) -> bool:
    """验证图片 URL 是否安全"""
    if not url or not isinstance(url, str):
        return False
    if not url.startswith("http"):
        return False
    url_lower = url.lower()
    return not any(p in url_lower for p in DANGEROUS_PATTERNS)

def proxy_image_url(external_url: str) -> str:
    """将外部图片 URL 转换为我们后端的代理 URL"""
    if not is_safe_image_url(external_url):
        return external_url
    encoded = urllib.parse.quote(external_url, safe="")
    return f"/api/v1/oss/proxy-image?url={encoded}"

@router.get("/oss/proxy-image")
async def proxy_image(url: str = Query(...)):
    """图片代理接口，解决外部图片 CORS 问题"""
    try:
        original_url = urllib.parse.unquote(url)

        if not is_safe_image_url(original_url):
            return JSONResponse(status_code=400, content={"detail": "Invalid URL"})

        async with httpx.AsyncClient(follow_redirects=True, timeout=15.0) as client:
            response = await client.get(
                original_url,
                headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"}
            )

        if response.status_code != 200:
            return JSONResponse(status_code=404, content={"detail": "Image not found"})

        content_type = response.headers.get("content-type", "image/jpeg")
        if "image" not in content_type.lower():
            content_type = "image/jpeg"

        return Response(
            content=response.content,
            media_type=content_type,
            headers={
                "Cache-Control": "public, max-age=86400",
                "Access-Control-Allow-Origin": "*",
                "Cross-Origin-Resource-Policy": "cross-origin",
            }
        )
    except Exception as e:
        return JSONResponse(status_code=500, content={"detail": f"Proxy failed: {str(e)}"})

@router.post("/oss/upload")
async def upload_to_oss(file: UploadFile = File(...)):
    """通过后端代理上传图片到 OSS，避免浏览器跨域问题"""
    try:
        file_content = await file.read()
        logger.info(f"OSS上传: 文件名={file.filename}, 大小={len(file_content)} bytes")

        timestamp = datetime.now().strftime("%Y%m%d%H%M%S%f")
        ext = file.filename.split(".")[-1].lower() if "." in file.filename else "jpg"
        filename = f"uploads/{timestamp}.{ext}"

        _get_bucket().put_object(filename, file_content)

        endpoint = os.getenv("OSS_ENDPOINT", "oss-cn-beijing.aliyuncs.com")
        file_url = f"https://{os.getenv('OSS_BUCKET')}.{endpoint}/{filename}"

        logger.info(f"OSS上传成功: {file_url}")
        return JSONResponse(content={
            "file_url": file_url,
            "filename": filename,
            "message": "上传成功"
        })
    except Exception as e:
        logger.error(f"OSS上传失败: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"detail": f"上传失败: {str(e)}"}
        )

@router.post("/oss/upload-url")
async def get_upload_url(request: OSSUploadRequest):
    """获取OSS上传签名URL"""
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    filename = f"uploads/{timestamp}_{request.filename}"

    ext = request.filename.split(".")[-1].lower() if "." in request.filename else "jpg"
    content_type = CONTENT_TYPE_MAP.get(ext, request.content_type)

    upload_url = _get_bucket().sign_url(
        "PUT",
        filename,
        3600,
        headers={"Content-Type": content_type}
    )

    endpoint = os.getenv("OSS_ENDPOINT", "oss-cn-beijing.aliyuncs.com")
    file_url = f"https://{os.getenv('OSS_BUCKET')}.{endpoint}/{filename}"

    return OSSUploadResponse(
        upload_url=upload_url,
        file_url=file_url,
        expires=3600
    )

@router.get("/oss/presign")
def presign_endpoint(filename: str):
    ext = filename.split(".")[-1].lower() if "." in filename else "jpg"
    content_type = CONTENT_TYPE_MAP.get(ext, "application/octet-stream")

    upload_url = _get_bucket().sign_url(
        "PUT",
        filename,
        3600,
        headers={"Content-Type": content_type}
    )

    endpoint = os.getenv("OSS_ENDPOINT", "oss-cn-beijing.aliyuncs.com")
    access_url = f"https://{os.getenv('OSS_BUCKET')}.{endpoint}/{filename}"

    return {
        "uploadUrl": upload_url,
        "contentType": content_type,
        "accessUrl": access_url
    }
