from fastapi import APIRouter, UploadFile, File, Query, Depends, Request
from app.auth import get_current_user
from fastapi.responses import JSONResponse, Response, StreamingResponse
from app.models.schemas import OSSUploadRequest, OSSUploadResponse
from app.common.logger import logger
import os
from datetime import datetime
try:
    import oss2
    OSS_AVAILABLE = True
except ImportError:
    oss2 = None  # type: ignore
    OSS_AVAILABLE = False
import httpx
import urllib.parse
import socket
import ipaddress
from dotenv import load_dotenv

load_dotenv()

router = APIRouter()

def _get_bucket():
    """延迟初始化 OSS Bucket，确保环境变量已加载"""
    if not OSS_AVAILABLE:
        raise RuntimeError("OSS SDK (oss2) 未安装，OSS 功能不可用")
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

ALLOWED_SCHEMES = ("http", "https")
BLOCKED_HOSTS = {"localhost", "0.0.0.0"}
TRUSTED_DOMAINS = {
    "personalcook.oss-cn-beijing.aliyuncs.com",
    "ark-cn-beijing.volces.com",
    "volces.com",
    "volcengine.com",
}
BLOCKED_NETWORKS = [
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("169.254.0.0/16"),
    ipaddress.ip_network("0.0.0.0/8"),
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("fc00::/7"),
    ipaddress.ip_network("fe80::/10"),
]
MAX_PROXY_SIZE = 10 * 1024 * 1024

def _is_private_ip(ip_str: str) -> bool:
    try:
        ip = ipaddress.ip_address(ip_str)
        return any(ip in net for net in BLOCKED_NETWORKS)
    except ValueError:
        return True

def is_safe_image_url(url: str) -> bool:
    if not url or not isinstance(url, str):
        return False
    try:
        parsed = urllib.parse.urlparse(url)
    except Exception:
        return False
    if parsed.scheme not in ALLOWED_SCHEMES:
        return False
    hostname = parsed.hostname
    if not hostname:
        return False
    if hostname in BLOCKED_HOSTS:
        return False
    if hostname in TRUSTED_DOMAINS:
        return True
    # 支持子域名匹配，如 xxx.oss-cn-beijing.aliyuncs.com
    if any(hostname.endswith("." + d) for d in TRUSTED_DOMAINS):
        return True
    if _is_private_ip(hostname):
        return False
    try:
        resolved_ips = socket.getaddrinfo(hostname, None, socket.AF_UNSPEC, socket.SOCK_STREAM)
    except (socket.gaierror, OSError):
        return False
    for _, _, _, _, sockaddr in resolved_ips:
        ip_str = sockaddr[0]
        if _is_private_ip(ip_str):
            return False
    return True

def proxy_image_url(external_url: str) -> str:
    """将外部图片 URL 转换为我们后端的代理 URL"""
    if not is_safe_image_url(external_url):
        return external_url
    encoded = urllib.parse.quote(external_url, safe="")
    return f"/api/v1/oss/proxy-image?url={encoded}"

@router.get("/oss/proxy-image")
async def proxy_image(url: str = Query(...), current_user: dict = Depends(get_current_user)):
    try:
        original_url = urllib.parse.unquote(url)

        if not is_safe_image_url(original_url):
            return JSONResponse(status_code=400, content={"detail": "Invalid URL"})

        client = httpx.AsyncClient(follow_redirects=True, timeout=10.0)
        response = await client.send(
            client.build_request(
                "GET",
                original_url,
                headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"},
            ),
            stream=True,
        )

        if response.status_code != 200:
            await response.aclose()
            await client.aclose()
            return JSONResponse(status_code=404, content={"detail": "Image not found"})

        content_type = response.headers.get("content-type", "image/jpeg")
        if "image" not in content_type.lower():
            content_type = "image/jpeg"

        content_length = response.headers.get("content-length")
        if content_length and int(content_length) > MAX_PROXY_SIZE:
            await response.aclose()
            await client.aclose()
            return JSONResponse(status_code=413, content={"detail": "Image too large"})

        async def stream_with_limit():
            total_size = 0
            try:
                async for chunk in response.aiter_bytes(8192):
                    total_size += len(chunk)
                    if total_size > MAX_PROXY_SIZE:
                        return
                    yield chunk
            finally:
                await client.aclose()

        return StreamingResponse(
            stream_with_limit(),
            media_type=content_type,
            headers={
                "Cache-Control": "public, max-age=86400",
                "Access-Control-Allow-Origin": "*",
                "Cross-Origin-Resource-Policy": "cross-origin",
            },
        )
    except Exception as e:
        return JSONResponse(status_code=500, content={"detail": f"Proxy failed: {str(e)}"})

MAX_UPLOAD_SIZE = 20 * 1024 * 1024

@router.post("/oss/upload")
async def upload_to_oss(request: Request, file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    """通过后端代理上传图片到 OSS，避免浏览器跨域问题"""
    content_length = request.headers.get("content-length")
    if not content_length:
        return JSONResponse(status_code=411, content={"detail": "需要 Content-Length 请求头"})
    size = int(content_length)
    if size > MAX_UPLOAD_SIZE:
        return JSONResponse(status_code=413, content={"detail": "文件大小不能超过20MB"})
    try:
        file_content = await file.read(size if size > 0 else MAX_UPLOAD_SIZE + 1)
        if len(file_content) > MAX_UPLOAD_SIZE:
            return JSONResponse(status_code=413, content={"detail": "文件大小不能超过20MB"})
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
async def get_upload_url(request: OSSUploadRequest, current_user: dict = Depends(get_current_user)):
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
def presign_endpoint(filename: str, current_user: dict = Depends(get_current_user)):
    # Sanitize filename: strip path traversal, enforce safe pattern
    safe = filename.rsplit("/", 1)[-1].rsplit("\\", 1)[-1]
    if not safe or safe.startswith("."):
        safe = "upload.jpg"
    if len(safe) > 255:
        safe = safe[-255:]
    ext = safe.split(".")[-1].lower() if "." in safe else "jpg"
    content_type = CONTENT_TYPE_MAP.get(ext, "application/octet-stream")
    # Prepend user-scoped prefix to isolate uploads per user
    key = f"uploads/{current_user['user_id']}/{safe}"

    upload_url = _get_bucket().sign_url(
        "PUT",
        key,
        3600,
        headers={"Content-Type": content_type}
    )

    endpoint = os.getenv("OSS_ENDPOINT", "oss-cn-beijing.aliyuncs.com")
    access_url = f"https://{os.getenv('OSS_BUCKET')}.{endpoint}/{key}"

    return {
        "uploadUrl": upload_url,
        "contentType": content_type,
        "accessUrl": access_url
    }
