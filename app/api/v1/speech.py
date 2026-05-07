from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from app.common.logger import logger
import os
import tempfile

router = APIRouter()


def _get_client():
    from openai import OpenAI
    api_key = os.getenv("OPENAI_API_KEY") or os.getenv("DOUBAO_API_KEY")
    base_url = os.getenv("OPENAI_BASE_URL") or os.getenv("DOUBAO_BASE_URL", "https://api.openai.com/v1")
    if not api_key:
        raise HTTPException(status_code=500, detail="未配置 API Key")
    return OpenAI(api_key=api_key, base_url=base_url)


@router.post("/speech/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    """语音转文字（兜底方案），通过 OpenAI Whisper API 识别音频"""
    try:
        from openai import OpenAI  # noqa: F811
    except ImportError:
        raise HTTPException(status_code=500, detail="openai 包未安装")

    client = _get_client()

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="音频文件为空")

    suffix = ".webm"
    if file.filename:
        _, ext = os.path.splitext(file.filename)
        if ext:
            suffix = ext

    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(content)
        tmp_path = tmp.name

    try:
        with open(tmp_path, "rb") as audio_file:
            transcription = client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
                language="zh",
                response_format="text",
            )
        logger.info(f"语音识别成功，文本长度：{len(transcription)}")
        return {"text": transcription}
    except Exception as e:
        logger.error(f"Whisper 语音识别失败：{e}")
        raise HTTPException(status_code=500, detail=f"语音识别失败：{str(e)}")
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


class SynthesizeRequest(BaseModel):
    text: str


@router.post("/speech/synthesize")
async def synthesize_speech(data: SynthesizeRequest):
    """文字转语音（兜底方案），通过 OpenAI TTS API 合成语音"""
    if not data.text or not data.text.strip():
        raise HTTPException(status_code=400, detail="文本为空")

    try:
        from openai import OpenAI  # noqa: F811
    except ImportError:
        raise HTTPException(status_code=500, detail="openai 包未安装")

    client = _get_client()

    try:
        response = client.audio.speech.create(
            model="tts-1",
            voice="alloy",
            input=data.text.strip(),
            speed=1.0,
        )
        return StreamingResponse(
            response.iter_bytes(),
            media_type="audio/mpeg",
            headers={"Content-Disposition": "inline"},
        )
    except Exception as e:
        logger.error(f"TTS 语音合成失败：{e}")
        raise HTTPException(status_code=500, detail=f"语音合成失败：{str(e)}")
