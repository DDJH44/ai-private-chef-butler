import json
import sqlite3
import os
import uuid
import base64
from datetime import datetime, date
from typing import Optional, List
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from contextlib import contextmanager
from langchain.chat_models import init_chat_model
from langchain_core.messages import HumanMessage
from dotenv import load_dotenv

load_dotenv()

router = APIRouter()

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "data", "nutrition.db")


@contextmanager
def get_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


def init_db():
    with get_db() as conn:
        conn.execute('''
            CREATE TABLE IF NOT EXISTS nutrition_records (
                id TEXT PRIMARY KEY,
                date TEXT NOT NULL,
                meal_type TEXT NOT NULL,
                food_name TEXT NOT NULL,
                calories REAL,
                protein REAL,
                carbs REAL,
                fat REAL,
                fiber REAL,
                sodium REAL,
                image_url TEXT,
                notes TEXT,
                created_at INTEGER NOT NULL
            )
        ''')
        conn.execute('CREATE INDEX IF NOT EXISTS idx_date ON nutrition_records(date)')
        conn.commit()


init_db()


class NutritionRecordCreate(BaseModel):
    date: str
    meal_type: str
    food_name: str
    calories: Optional[float] = None
    protein: Optional[float] = None
    carbs: Optional[float] = None
    fat: Optional[float] = None
    fiber: Optional[float] = None
    sodium: Optional[float] = None
    image_url: Optional[str] = None
    notes: Optional[str] = None


class NutritionRecordResponse(BaseModel):
    id: str
    date: str
    meal_type: str
    food_name: str
    calories: Optional[float] = None
    protein: Optional[float] = None
    carbs: Optional[float] = None
    fat: Optional[float] = None
    fiber: Optional[float] = None
    sodium: Optional[float] = None
    image_url: Optional[str] = None
    notes: Optional[str] = None
    created_at: int


class DailySummary(BaseModel):
    date: str
    total_calories: float
    total_protein: float
    total_carbs: float
    total_fat: float
    total_fiber: float
    total_sodium: float
    meals: List[NutritionRecordResponse]
    analysis: str
    health_eval: Optional[str] = None


class FoodItem(BaseModel):
    food_name: str
    calories: float
    protein: float
    carbs: float
    fat: float
    fiber: Optional[float] = 0
    sodium: Optional[float] = 0
    estimated_weight: Optional[str] = None


class PhotoAnalysisResult(BaseModel):
    meal_type: str
    foods: List[FoodItem]
    total_calories: float
    total_protein: float
    total_carbs: float
    total_fat: float
    summary: str


@router.post("/records", response_model=NutritionRecordResponse)
async def create_record(record: NutritionRecordCreate):
    record_id = str(uuid.uuid4())
    now = int(datetime.now().timestamp())

    with get_db() as conn:
        conn.execute('''
            INSERT INTO nutrition_records (
                id, date, meal_type, food_name, calories, protein, carbs, fat, fiber, sodium, image_url, notes, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            record_id, record.date, record.meal_type, record.food_name,
            record.calories, record.protein, record.carbs, record.fat, record.fiber, record.sodium,
            record.image_url, record.notes, now
        ))
        conn.commit()

    return NutritionRecordResponse(
        id=record_id, date=record.date, meal_type=record.meal_type, food_name=record.food_name,
        calories=record.calories, protein=record.protein, carbs=record.carbs, fat=record.fat,
        fiber=record.fiber, sodium=record.sodium, image_url=record.image_url, notes=record.notes, created_at=now
    )


@router.get("/records", response_model=List[NutritionRecordResponse])
async def get_records(date_str: Optional[str] = None, limit: int = 30):
    with get_db() as conn:
        if date_str:
            rows = conn.execute(
                'SELECT * FROM nutrition_records WHERE date = ? ORDER BY created_at DESC',
                (date_str,)
            ).fetchall()
        else:
            rows = conn.execute(
                'SELECT * FROM nutrition_records ORDER BY date DESC, created_at DESC LIMIT ?',
                (limit,)
            ).fetchall()

    return [NutritionRecordResponse(
        id=row['id'], date=row['date'], meal_type=row['meal_type'], food_name=row['food_name'],
        calories=row['calories'], protein=row['protein'], carbs=row['carbs'], fat=row['fat'],
        fiber=row['fiber'], sodium=row['sodium'], image_url=row['image_url'], notes=row['notes'],
        created_at=row['created_at']
    ) for row in rows]


@router.delete("/records/{record_id}")
async def delete_record(record_id: str):
    with get_db() as conn:
        conn.execute('DELETE FROM nutrition_records WHERE id = ?', (record_id,))
        conn.commit()
    return {"status": "ok"}


@router.post("/analyze-photo", response_model=PhotoAnalysisResult)
async def analyze_photo(
    file: UploadFile = File(...),
    meal_type: str = Form(...),
    date: str = Form(...)
):
    image_data = await file.read()
    if not image_data:
        raise HTTPException(status_code=400, detail="图片数据为空")

    b64_image = base64.b64encode(image_data).decode("utf-8")
    content_type = file.content_type or "image/jpeg"
    data_uri = f"data:{content_type};base64,{b64_image}"

    image_url = await _upload_photo_to_oss(image_data, file.filename or "photo.jpg")

    prompt = f"""你是一名专业营养师。请分析这张{meal_type}的照片，识别其中的所有食物，并估算每种食物的营养成分。

请严格按照以下JSON格式返回，不要包含任何其他文字：
{{
  "foods": [
    {{
      "food_name": "食物名称",
      "calories": 热量(kcal),
      "protein": 蛋白质(g),
      "carbs": 碳水化合物(g),
      "fat": 脂肪(g),
      "fiber": 膳食纤维(g),
      "sodium": 钠(mg),
      "estimated_weight": "估算重量如约200g"
    }}
  ],
  "total_calories": 总热量,
  "total_protein": 总蛋白质,
  "total_carbs": 总碳水,
  "total_fat": 总脂肪,
  "summary": "简要评价这餐的营养搭配，指出优缺点"
}}

注意事项：
1. 尽可能识别图中所有可见食物
2. 根据常见份量估算重量和营养
3. 如果无法识别某种食物，标注为"未知食物"
4. summary用中文，50字以内"""

    try:
        model = init_chat_model(
            model=os.getenv("DOUBAO_MODEL_NAME", "doubao-seed-2-0-lite-260428"),
            model_provider="openai",
            base_url=os.getenv("DOUBAO_BASE_URL", "https://ark.cn-beijing.volces.com/api/v1"),
            api_key=os.getenv("DOUBAO_API_KEY")
        ).bind(extra_body={"reasoning_effort": "low"})

        message = HumanMessage(content=[
            {"type": "image_url", "image_url": {"url": data_uri}},
            {"type": "text", "text": prompt}
        ])

        response = model.invoke([message])
        result_text = response.content if isinstance(response.content, str) else str(response.content)

        json_str = _extract_json(result_text)
        analysis = json.loads(json_str)

        foods = []
        for food_data in analysis.get("foods", []):
            food_item = FoodItem(
                food_name=food_data.get("food_name", "未知食物"),
                calories=food_data.get("calories", 0),
                protein=food_data.get("protein", 0),
                carbs=food_data.get("carbs", 0),
                fat=food_data.get("fat", 0),
                fiber=food_data.get("fiber", 0),
                sodium=food_data.get("sodium", 0),
                estimated_weight=food_data.get("estimated_weight", "")
            )
            foods.append(food_item)

            record_id = str(uuid.uuid4())
            now = int(datetime.now().timestamp())
            with get_db() as conn:
                conn.execute('''
                    INSERT INTO nutrition_records (
                        id, date, meal_type, food_name, calories, protein, carbs, fat, fiber, sodium, image_url, notes, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    record_id, date, meal_type, food_item.food_name,
                    food_item.calories, food_item.protein, food_item.carbs, food_item.fat,
                    food_item.fiber, food_item.sodium, image_url,
                    f"估算重量: {food_item.estimated_weight}" if food_item.estimated_weight else None,
                    now
                ))
                conn.commit()

        return PhotoAnalysisResult(
            meal_type=meal_type,
            foods=foods,
            total_calories=analysis.get("total_calories", sum(f.calories for f in foods)),
            total_protein=analysis.get("total_protein", sum(f.protein for f in foods)),
            total_carbs=analysis.get("total_carbs", sum(f.carbs for f in foods)),
            total_fat=analysis.get("total_fat", sum(f.fat for f in foods)),
            summary=analysis.get("summary", "分析完成")
        )
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f"AI返回格式解析失败: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"分析失败: {str(e)}")


@router.get("/health-eval/{date_str}")
async def health_evaluation(date_str: str):
    with get_db() as conn:
        rows = conn.execute(
            'SELECT * FROM nutrition_records WHERE date = ? ORDER BY created_at',
            (date_str,)
        ).fetchall()

    if not rows:
        return {"date": date_str, "health_eval": "今日暂无饮食记录，无法进行评估。", "score": 0}

    meals_by_type = {}
    for row in rows:
        mt = row['meal_type']
        if mt not in meals_by_type:
            meals_by_type[mt] = []
        meals_by_type[mt].append({
            "food_name": row['food_name'],
            "calories": row['calories'] or 0,
            "protein": row['protein'] or 0,
            "carbs": row['carbs'] or 0,
            "fat": row['fat'] or 0,
        })

    total_calories = sum(r['calories'] or 0 for r in [dict(row) for row in rows])
    total_protein = sum(r['protein'] or 0 for r in [dict(row) for row in rows])
    total_carbs = sum(r['carbs'] or 0 for r in [dict(row) for row in rows])
    total_fat = sum(r['fat'] or 0 for r in [dict(row) for row in rows])

    meal_summary = ""
    for mt, items in meals_by_type.items():
        foods_str = "、".join(i['food_name'] for i in items)
        cal = sum(i['calories'] for i in items)
        meal_summary += f"\n{mt}：{foods_str}（约{cal:.0f}kcal）"

    prompt = f"""你是一名专业营养师和健康管理师。请根据以下用户今日饮食数据，进行全面的健康评估。

日期：{date_str}
总热量：{total_calories:.0f}kcal
总蛋白质：{total_protein:.0f}g
总碳水：{total_carbs:.0f}g
总脂肪：{total_fat:.0f}g

各餐详情：{meal_summary}

请严格按照以下JSON格式返回：
{{
  "score": 健康评分(0-100),
  "eval": "详细评估内容，包含：1.营养均衡性分析 2.三餐合理性评价 3.具体改善建议 4.推荐调整方案。用中文，300字以内"
}}"""

    try:
        model = init_chat_model(
            model=os.getenv("DOUBAO_MODEL_NAME", "doubao-seed-2-0-lite-260428"),
            model_provider="openai",
            base_url=os.getenv("DOUBAO_BASE_URL", "https://ark.cn-beijing.volces.com/api/v1"),
            api_key=os.getenv("DOUBAO_API_KEY")
        ).bind(extra_body={"reasoning_effort": "low"})

        response = model.invoke([HumanMessage(content=prompt)])
        result_text = response.content if isinstance(response.content, str) else str(response.content)

        json_str = _extract_json(result_text)
        result = json.loads(json_str)

        return {
            "date": date_str,
            "score": result.get("score", 60),
            "health_eval": result.get("eval", "评估完成")
        }
    except Exception as e:
        basic_eval = generate_analysis(total_calories, total_protein, total_carbs, total_fat, 0, 0)
        return {
            "date": date_str,
            "score": 60,
            "health_eval": f"AI评估暂时不可用，基础分析如下：\n{basic_eval}"
        }


@router.get("/summary/{date_str}", response_model=DailySummary)
async def get_daily_summary(date_str: str):
    with get_db() as conn:
        rows = conn.execute(
            'SELECT * FROM nutrition_records WHERE date = ? ORDER BY created_at',
            (date_str,)
        ).fetchall()

    meals = [NutritionRecordResponse(
        id=row['id'], date=row['date'], meal_type=row['meal_type'], food_name=row['food_name'],
        calories=row['calories'] or 0, protein=row['protein'] or 0, carbs=row['carbs'] or 0, fat=row['fat'] or 0,
        fiber=row['fiber'] or 0, sodium=row['sodium'] or 0, image_url=row['image_url'], notes=row['notes'],
        created_at=row['created_at']
    ) for row in rows]

    total_calories = sum(m.calories or 0 for m in meals)
    total_protein = sum(m.protein or 0 for m in meals)
    total_carbs = sum(m.carbs or 0 for m in meals)
    total_fat = sum(m.fat or 0 for m in meals)
    total_fiber = sum(m.fiber or 0 for m in meals)
    total_sodium = sum(m.sodium or 0 for m in meals)

    analysis = generate_analysis(total_calories, total_protein, total_carbs, total_fat, total_fiber, total_sodium)

    return DailySummary(
        date=date_str,
        total_calories=round(total_calories, 1),
        total_protein=round(total_protein, 1),
        total_carbs=round(total_carbs, 1),
        total_fat=round(total_fat, 1),
        total_fiber=round(total_fiber, 1),
        total_sodium=round(total_sodium, 1),
        meals=meals,
        analysis=analysis
    )


def generate_analysis(calories, protein, carbs, fat, fiber, sodium):
    if calories == 0:
        return "今日暂无饮食记录"

    lines = [f"📊 今日摄入 {calories:.0f} 千卡"]

    if calories < 1200:
        lines.append("⚠️ 热量摄入偏低，建议适当增加")
    elif calories > 2500:
        lines.append("⚠️ 热量摄入偏高，注意控制")
    else:
        lines.append("✅ 热量摄入适中")

    protein_ratio = protein * 4 / calories * 100 if calories > 0 else 0
    carbs_ratio = carbs * 4 / calories * 100 if calories > 0 else 0
    fat_ratio = fat * 9 / calories * 100 if calories > 0 else 0

    lines.append(f"🥩 蛋白质 {protein:.0f}g ({protein_ratio:.0f}%)")
    lines.append(f"🍚 碳水 {carbs:.0f}g ({carbs_ratio:.0f}%)")
    lines.append(f"🧈 脂肪 {fat:.0f}g ({fat_ratio:.0f}%)")

    if fiber < 20:
        lines.append("💡 建议增加膳食纤维摄入（蔬菜、水果）")
    if sodium > 2000:
        lines.append("⚠️ 钠摄入偏高，注意清淡饮食")

    return "\n".join(lines)


async def _upload_photo_to_oss(image_data: bytes, filename: str) -> str:
    try:
        import oss2
        auth = oss2.Auth(
            os.getenv("OSS_ACCESS_KEY_ID"),
            os.getenv("OSS_ACCESS_KEY_SECRET")
        )
        bucket = oss2.Bucket(
            auth,
            "https://" + os.getenv("OSS_ENDPOINT", "oss-cn-beijing.aliyuncs.com"),
            os.getenv("OSS_BUCKET")
        )
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S%f")
        ext = filename.split(".")[-1].lower() if "." in filename else "jpg"
        oss_key = f"nutrition/{timestamp}.{ext}"
        bucket.put_object(oss_key, image_data)
        endpoint = os.getenv("OSS_ENDPOINT", "oss-cn-beijing.aliyuncs.com")
        return f"https://{os.getenv('OSS_BUCKET')}.{endpoint}/{oss_key}"
    except Exception:
        return ""


def _extract_json(text: str) -> str:
    import re
    match = re.search(r'\{[\s\S]*\}', text)
    if match:
        return match.group()
    return text
