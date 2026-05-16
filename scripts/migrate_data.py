"""一次性数据迁移：SQLite → MySQL
使用方法：
  1. 确保 MySQL 已启动，DATABASE_URL 环境变量已配置
  2. python scripts/migrate_data.py
"""
import json
import os
import sqlite3
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

from app.common.database import engine, SessionLocal
from app.models.db import Base, User, Recipe, Ingredient, ShoppingList, CookRecord, NutritionRecord, FeishuConfig, Preference

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")

MIGRATIONS = [
    (User, "users.db", "users"),
    (Recipe, "recipes.db", "recipes"),
    (Ingredient, "ingredients.db", "ingredients"),
    (ShoppingList, "shopping.db", "shopping_lists"),
    (CookRecord, "cook_history.db", "cook_records"),
    (NutritionRecord, "nutrition.db", "nutrition_records"),
    (FeishuConfig, "feishu.db", "feishu_config"),
    (Preference, "preferences.db", "preferences"),
]

BOOL_FIELDS = {"is_expanded", "enabled"}
JSON_FIELDS = {"ingredients", "seasonings", "tags", "items",
               "source_recipes", "source_recipe_names", "photos", "data"}


def migrate_table(model, db_file, table_name):
    db_path = os.path.join(DATA_DIR, db_file)
    if not os.path.exists(db_path):
        print(f"  [SKIP] {db_file} 不存在")
        return 0

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    try:
        rows = conn.execute(f"SELECT * FROM {table_name}").fetchall()
    except sqlite3.OperationalError as e:
        print(f"  [ERROR] {db_file}/{table_name}: {e}")
        conn.close()
        return 0
    conn.close()

    session = SessionLocal()
    count = 0
    skip = 0
    for row in rows:
        data = dict(row)

        # 处理 boolean 字段（SQLite 存为 0/1）
        for col in BOOL_FIELDS:
            if col in data and data[col] is not None:
                data[col] = bool(data[col])

        # 处理 JSON 字段（SQLite 存为 text）
        for col in JSON_FIELDS:
            if col in data and isinstance(data[col], str):
                try:
                    data[col] = json.loads(data[col])
                except (json.JSONDecodeError, TypeError):
                    data[col] = [] if "recipes" not in col else []

        # 处理可能不存在的列（厨历史中的 photos 字段）
        for col in list(data.keys()):
            if data[col] is None and col in JSON_FIELDS:
                data[col] = []

        try:
            obj = model(**data)
            session.add(obj)
            count += 1
        except Exception as e:
            skip += 1
            if skip <= 5:
                print(f"  [WARN] 跳过一行: {e}")

    try:
        session.commit()
    except Exception as e:
        session.rollback()
        print(f"  [ERROR] 提交失败: {e}")
        count = 0
    finally:
        session.close()

    print(f"  [OK] {db_file} → {count} 行" + (f"（跳过 {skip}）" if skip else ""))
    return count


if __name__ == "__main__":
    print("=" * 50)
    print("SQLite → MySQL 数据迁移")
    print("=" * 50)

    # 先建表
    print("\n[1/2] 创建 MySQL 表...")
    Base.metadata.create_all(bind=engine)
    print("  完成")

    # 迁移数据
    print(f"\n[2/2] 迁移数据（源目录: {DATA_DIR}）...")
    total = 0
    for model, db_file, table_name in MIGRATIONS:
        total += migrate_table(model, db_file, table_name)

    print(f"\n总计迁移: {total} 行")
    print("跳过 personal_chief.db（LangGraph 检查点，可重新生成）")
    print("\n迁移完成！原 SQLite 文件未删除，请验证后手动处理。")
