"""Load, clean, and index knowledge data into ChromaDB collections.

Data sources:
1. China Food Composition Table (CSV) -> nutrition_db
2. Chinese Recipe Knowledge Base (JSON) -> recipe_db
3. Sports Nutrition Knowledge (Markdown) -> fitness_knowledge
"""

import csv
import json
import os
import logging
from pathlib import Path

logger = logging.getLogger("personal_chief")

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "raw")


def load_nutrition_db(csv_path: str = None) -> tuple[list[str], list[dict]]:
    """Load China Food Composition Table from CSV.

    Expected CSV columns:
    food_name, category, calories_per_100g, protein_per_100g, carbs_per_100g,
    fat_per_100g, fiber_per_100g, sodium_per_100g, edible_portion

    Returns (documents, metadatas) tuples for ChromaDB.
    """
    if csv_path is None:
        csv_path = os.path.join(DATA_DIR, "china_food_composition.csv")

    documents = []
    metadatas = []

    # If no CSV file exists, load built-in common foods
    if not os.path.exists(csv_path):
        logger.info(f"No CSV found at {csv_path}, loading built-in common foods")
        return _load_builtin_nutrition()

    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            food_name = row.get("food_name", "").strip()
            category = row.get("category", "").strip()
            cal = row.get("calories_per_100g", "0")
            protein = row.get("protein_per_100g", "0")
            carbs = row.get("carbs_per_100g", "0")
            fat = row.get("fat_per_100g", "0")
            fiber = row.get("fiber_per_100g", "0")
            sodium = row.get("sodium_per_100g", "0")

            if not food_name:
                continue

            doc = (
                f"食物：{food_name}，类别：{category}，"
                f"每100g：热量{cal}kcal，蛋白质{protein}g，碳水{carbs}g，"
                f"脂肪{fat}g，纤维{fiber}g，钠{sodium}mg"
            )
            documents.append(doc)
            metadatas.append({
                "food_name": food_name,
                "category": category,
                "calories": cal,
                "protein": protein,
                "carbs": carbs,
                "fat": fat,
                "fiber": fiber,
                "sodium": sodium,
                "source": "china_food_composition",
            })

    logger.info(f"Loaded {len(documents)} foods from CSV")
    return documents, metadatas


def _load_builtin_nutrition() -> tuple[list[str], list[dict]]:
    """Built-in common Chinese food nutrition data (per 100g edible portion).

    Data sourced from China Food Composition Table 6th Edition (public data).
    """
    foods = [
        # Staple foods
        ("米饭（蒸）", "主食", 116, 2.6, 25.9, 0.3, 0.3, 2),
        ("馒头（标准粉）", "主食", 233, 7.8, 44.2, 1.0, 1.5, 165),
        ("面条（煮）", "主食", 110, 3.5, 23.2, 0.3, 0.4, 2),
        ("小米粥", "主食", 46, 1.4, 8.4, 0.7, 0.4, 2),
        ("燕麦片", "主食", 377, 13.5, 66.0, 7.0, 5.3, 2),
        ("全麦面包", "主食", 246, 10.0, 43.0, 3.4, 6.0, 400),
        # Meat & Poultry
        ("鸡胸肉（去皮）", "肉类", 133, 31.0, 0.0, 2.0, 0.0, 45),
        ("鸡腿肉（去皮）", "肉类", 181, 20.0, 0.0, 11.0, 0.0, 70),
        ("鸡翅", "肉类", 222, 18.0, 0.0, 16.0, 0.0, 65),
        ("猪瘦肉（里脊）", "肉类", 155, 20.3, 1.5, 7.9, 0.0, 55),
        ("猪五花肉", "肉类", 395, 13.2, 2.4, 37.0, 0.0, 35),
        ("猪排骨", "肉类", 264, 18.3, 0.0, 20.4, 0.0, 45),
        ("牛腱子肉（瘦）", "肉类", 125, 20.2, 1.2, 4.2, 0.0, 55),
        ("牛腩", "肉类", 205, 17.1, 0.0, 14.8, 0.0, 55),
        ("羊瘦肉", "肉类", 143, 20.5, 0.2, 6.6, 0.0, 70),
        # Seafood
        ("三文鱼", "水产", 208, 20.4, 0.0, 13.4, 0.0, 50),
        ("虾仁", "水产", 99, 20.4, 0.0, 0.7, 0.0, 300),
        ("带鱼", "水产", 127, 17.7, 0.0, 4.9, 0.0, 150),
        ("鲈鱼", "水产", 105, 18.6, 0.0, 3.4, 0.0, 144),
        ("鳕鱼", "水产", 88, 17.8, 0.0, 1.0, 0.0, 80),
        # Eggs & Dairy
        ("鸡蛋（整）", "蛋奶", 144, 13.3, 1.5, 8.8, 0.0, 130),
        ("鸡蛋白", "蛋奶", 52, 11.0, 0.7, 0.2, 0.0, 170),
        ("牛奶（全脂）", "蛋奶", 61, 3.0, 5.0, 3.2, 0.0, 40),
        ("酸奶（原味）", "蛋奶", 72, 2.5, 9.3, 2.7, 0.0, 40),
        ("奶酪（切达）", "蛋奶", 403, 24.9, 1.3, 33.1, 0.0, 620),
        # Soy & Tofu
        ("豆腐（北）", "豆制品", 81, 8.1, 3.8, 3.7, 0.4, 7),
        ("豆腐（南）", "豆制品", 57, 6.2, 2.4, 2.5, 0.2, 3),
        ("豆腐干", "豆制品", 140, 16.2, 10.7, 3.6, 0.8, 300),
        ("豆浆（无糖）", "豆制品", 31, 3.0, 1.1, 1.6, 0.4, 2),
        ("毛豆", "豆制品", 147, 13.1, 10.5, 5.0, 4.0, 4),
        # Vegetables
        ("番茄", "蔬菜", 18, 0.9, 3.5, 0.2, 1.2, 5),
        ("黄瓜", "蔬菜", 16, 0.7, 2.9, 0.1, 0.5, 2),
        ("菠菜", "蔬菜", 23, 2.9, 3.6, 0.3, 2.2, 85),
        ("西兰花", "蔬菜", 34, 2.8, 6.6, 0.4, 2.6, 27),
        ("生菜", "蔬菜", 15, 1.4, 2.8, 0.2, 1.3, 10),
        ("胡萝卜", "蔬菜", 41, 0.9, 9.6, 0.2, 2.8, 35),
        ("白萝卜", "蔬菜", 18, 0.6, 3.8, 0.1, 1.6, 45),
        ("土豆", "蔬菜", 77, 2.1, 17.5, 0.2, 2.2, 6),
        ("红薯", "蔬菜", 86, 1.6, 20.1, 0.1, 3.0, 55),
        ("青椒", "蔬菜", 20, 0.9, 3.8, 0.2, 2.1, 3),
        ("大白菜", "蔬菜", 13, 1.5, 2.2, 0.1, 1.0, 8),
        ("洋葱", "蔬菜", 40, 1.1, 9.3, 0.1, 1.7, 4),
        ("蒜苔", "蔬菜", 42, 2.3, 8.2, 0.2, 2.6, 5),
        ("冬瓜", "蔬菜", 12, 0.4, 2.6, 0.1, 0.7, 1),
        ("茄子", "蔬菜", 25, 1.0, 5.4, 0.2, 3.0, 2),
        ("芹菜", "蔬菜", 16, 1.4, 2.5, 0.2, 1.6, 80),
        ("金针菇", "蔬菜", 37, 2.7, 6.0, 0.4, 2.7, 4),
        ("香菇（干）", "蔬菜", 274, 20.0, 52.7, 1.2, 31.6, 11),
        ("玉米（甜）", "蔬菜", 112, 3.3, 21.7, 1.4, 2.4, 1),
        ("山药", "蔬菜", 57, 1.5, 12.4, 0.2, 1.4, 5),
        # Fruits
        ("苹果", "水果", 52, 0.3, 13.8, 0.2, 2.4, 1),
        ("香蕉", "水果", 89, 1.1, 22.8, 0.3, 2.6, 1),
        ("橙子", "水果", 47, 0.9, 11.8, 0.1, 2.4, 1),
        ("葡萄", "水果", 69, 0.7, 18.1, 0.2, 0.9, 2),
        ("西瓜", "水果", 30, 0.6, 7.6, 0.1, 0.4, 1),
        ("牛油果", "水果", 160, 2.0, 9.0, 15.0, 7.0, 7),
        ("蓝莓", "水果", 57, 0.7, 14.5, 0.3, 2.4, 1),
        # Nuts & Seeds
        ("核桃", "坚果", 654, 15.2, 13.7, 65.2, 6.7, 2),
        ("杏仁", "坚果", 579, 21.2, 21.7, 49.9, 12.5, 1),
        ("花生（炒）", "坚果", 585, 24.8, 21.7, 47.5, 8.5, 6),
        # Oils & Seasonings
        ("橄榄油", "油脂", 899, 0.0, 0.0, 99.9, 0.0, 0),
        ("花生油", "油脂", 899, 0.0, 0.0, 99.9, 0.0, 0),
        ("酱油", "调味品", 53, 5.0, 5.5, 0.1, 0.0, 5500),
        ("醋", "调味品", 21, 1.5, 2.5, 0.0, 0.0, 500),
        ("盐", "调味品", 0, 0.0, 0.0, 0.0, 0.0, 39000),
        ("白砂糖", "调味品", 387, 0.0, 99.9, 0.0, 0.0, 0),
        # Common Dishes (approximate per 100g)
        ("番茄炒蛋", "家常菜", 95, 5.5, 3.5, 6.2, 0.5, 150),
        ("宫保鸡丁", "家常菜", 185, 15.0, 4.5, 11.5, 1.0, 450),
        ("麻婆豆腐", "家常菜", 140, 8.5, 4.0, 9.5, 1.5, 600),
        ("红烧肉", "家常菜", 320, 12.0, 6.0, 28.0, 0.5, 350),
        ("清蒸鱼", "家常菜", 110, 17.0, 1.0, 4.0, 0.0, 300),
        ("蛋炒饭", "家常菜", 188, 6.5, 28.0, 5.5, 0.5, 250),
        ("饺子（猪肉白菜）", "家常菜", 240, 8.0, 28.0, 10.0, 1.0, 300),
        ("水煮鸡胸", "健身餐", 120, 29.0, 0.0, 1.5, 0.0, 40),
        ("蒸红薯", "健身餐", 85, 1.5, 20.0, 0.1, 3.0, 55),
        ("白灼西兰花", "健身餐", 32, 2.6, 6.0, 0.3, 2.5, 25),
    ]

    documents = []
    metadatas = []
    for name, cat, cal, pro, carb, fat, fib, sod in foods:
        doc = (
            f"食物：{name}，类别：{cat}，"
            f"每100g：热量{cal}kcal，蛋白质{pro}g，碳水{carb}g，"
            f"脂肪{fat}g，纤维{fib}g，钠{sod}mg"
        )
        documents.append(doc)
        metadatas.append({
            "food_name": name, "category": cat,
            "calories": str(cal), "protein": str(pro), "carbs": str(carb),
            "fat": str(fat), "fiber": str(fib), "sodium": str(sod),
            "source": "builtin_common_foods",
        })

    logger.info(f"Loaded {len(documents)} built-in common foods")
    return documents, metadatas


def load_recipe_db(json_path: str = None) -> tuple[list[str], list[dict]]:
    """Load Chinese recipe knowledge base from JSON.

    Expected JSON structure:
    [
        {
            "title": "番茄炒蛋",
            "cuisine": "家常",
            "difficulty": "简单",
            "cooking_time": "15分钟",
            "ingredients": ["番茄", "鸡蛋", ...],
            "steps": "1. ... 2. ...",
            "tags": ["快手", "下饭"],
            "calories_per_serving": 250,
            "protein": 15,
            ...
        },
        ...
    ]
    """
    if json_path is None:
        json_path = os.path.join(DATA_DIR, "chinese_recipes.json")

    if not os.path.exists(json_path):
        logger.info(f"No recipe JSON at {json_path}, loading built-in recipes")
        return _load_builtin_recipes()

    with open(json_path, "r", encoding="utf-8") as f:
        recipes = json.load(f)

    documents = []
    metadatas = []
    for recipe in recipes:
        title = recipe.get("title", "").strip()
        if not title:
            continue

        cuisine = recipe.get("cuisine", "家常")
        difficulty = recipe.get("difficulty", "中等")
        cook_time = recipe.get("cooking_time", "未知")
        ingredients = ", ".join(recipe.get("ingredients", [])) if recipe.get("ingredients") else ""
        tags = ", ".join(recipe.get("tags", [])) if recipe.get("tags") else ""
        steps = recipe.get("steps", "")[:300]  # Truncate for embedding

        doc = (
            f"菜名：{title}，菜系：{cuisine}，难度：{difficulty}，时间：{cook_time}，"
            f"食材：{ingredients}，标签：{tags}，步骤概要：{steps}"
        )
        documents.append(doc)
        metadatas.append({
            "title": title,
            "cuisine": cuisine,
            "difficulty": difficulty,
            "cooking_time": cook_time,
            "tags": tags,
            "source": "recipe_db",
        })

    logger.info(f"Loaded {len(documents)} recipes from JSON")
    return documents, metadatas


def _load_builtin_recipes() -> tuple[list[str], list[dict]]:
    """Built-in common Chinese recipes for initial knowledge base."""
    recipes = [
        {
            "title": "番茄炒蛋", "cuisine": "家常", "difficulty": "简单", "cooking_time": "15分钟",
            "ingredients": ["番茄", "鸡蛋", "葱", "蒜"],
            "steps": "1.番茄切块，鸡蛋打散加盐；2.热油炒鸡蛋至凝固盛出；3.爆香葱蒜，下番茄炒出汁；4.倒回鸡蛋翻炒，加盐糖调味出锅。",
            "tags": ["快手", "下饭", "新手友好", "高蛋白"],
        },
        {
            "title": "麻婆豆腐", "cuisine": "川菜", "difficulty": "中等", "cooking_time": "20分钟",
            "ingredients": ["豆腐", "猪肉末", "豆瓣酱", "花椒", "葱姜蒜"],
            "steps": "1.豆腐切块焯水；2.炒肉末至变色加豆瓣酱炒出红油；3.加高汤烧开下豆腐；4.勾薄芡撒花椒粉葱花出锅。",
            "tags": ["川味", "下饭", "高蛋白", "麻辣"],
        },
        {
            "title": "宫保鸡丁", "cuisine": "川菜", "difficulty": "中等", "cooking_time": "25分钟",
            "ingredients": ["鸡胸肉", "花生米", "干辣椒", "黄瓜", "胡萝卜", "葱姜蒜"],
            "steps": "1.鸡胸切丁腌制（料酒、生抽、淀粉）；2.调碗汁（醋、糖、酱油、淀粉）；3.小火炸花生至金黄盛出；4.爆香干辣椒花椒葱姜，下鸡丁滑炒；5.下蔬菜丁翻炒，淋碗汁收汁，拌入花生米出锅。",
            "tags": ["川味", "下饭", "宴客", "高蛋白"],
        },
        {
            "title": "红烧肉", "cuisine": "家常", "difficulty": "中等", "cooking_time": "60分钟",
            "ingredients": ["五花肉", "冰糖", "八角", "桂皮", "生姜", "生抽", "老抽"],
            "steps": "1.五花肉切3cm块冷水下锅焯水捞出；2.小火炒冰糖至焦糖色；3.下肉块翻炒上色；4.加开水没过肉，加生抽老抽八角桂皮姜片；5.小火炖40分钟，大火收汁。",
            "tags": ["经典", "宴客", "下饭", "硬菜"],
        },
        {
            "title": "清蒸鲈鱼", "cuisine": "粤菜", "difficulty": "简单", "cooking_time": "20分钟",
            "ingredients": ["鲈鱼", "姜", "葱", "蒸鱼豉油", "料酒"],
            "steps": "1.鱼身划刀塞姜片，鱼肚塞葱段；2.水开后上锅大火蒸8-10分钟；3.倒掉盘中汁水，铺葱丝；4.淋蒸鱼豉油，浇热油激香。",
            "tags": ["清淡", "高蛋白", "低脂", "宴客"],
        },
        {
            "title": "蛋炒饭", "cuisine": "家常", "difficulty": "简单", "cooking_time": "10分钟",
            "ingredients": ["隔夜米饭", "鸡蛋", "葱", "胡萝卜", "青豆", "火腿肠"],
            "steps": "1.鸡蛋打散炒碎盛出；2.热油下米饭炒散炒热；3.加入鸡蛋碎、配料丁翻炒；4.加盐、白胡椒粉调味，撒葱花出锅。",
            "tags": ["快手", "新手友好", "一人食"],
        },
        {
            "title": "酸辣土豆丝", "cuisine": "家常", "difficulty": "简单", "cooking_time": "15分钟",
            "ingredients": ["土豆", "干辣椒", "花椒", "醋", "蒜", "青椒"],
            "steps": "1.土豆切细丝泡水去淀粉沥干；2.热油爆香花椒干辣椒蒜片；3.下土豆丝大火快炒；4.沿锅边淋醋，加盐调味，下青椒丝翻炒出锅。",
            "tags": ["快手", "下饭", "素食", "酸辣"],
        },
        {
            "title": "蒜蓉西兰花", "cuisine": "家常", "difficulty": "简单", "cooking_time": "10分钟",
            "ingredients": ["西兰花", "蒜", "盐", "蚝油"],
            "steps": "1.西兰花分小朵焯水1分钟捞出；2.热油爆香蒜末；3.下西兰花翻炒，加蚝油盐调味出锅。",
            "tags": ["快手", "低脂", "高纤维", "健身餐"],
        },
        {
            "title": "水煮鸡胸（健身版）", "cuisine": "健身餐", "difficulty": "简单", "cooking_time": "20分钟",
            "ingredients": ["鸡胸肉", "姜", "料酒", "盐", "黑胡椒"],
            "steps": "1.鸡胸肉冷水下锅加姜片料酒；2.水开后转小火煮12-15分钟；3.关火焖5分钟取出；4.逆纹撕成丝，加盐黑胡椒调味。",
            "tags": ["高蛋白", "低脂", "健身餐", "增肌"],
        },
        {
            "title": "牛肉沙拉（健身版）", "cuisine": "健身餐", "difficulty": "简单", "cooking_time": "15分钟",
            "ingredients": ["牛腱肉", "生菜", "小番茄", "黄瓜", "橄榄油", "黑醋", "黑胡椒"],
            "steps": "1.牛腱提前卤好切片；2.蔬菜洗净沥干撕碎；3.牛肉片铺在蔬菜上；4.淋橄榄油黑醋汁，撒黑胡椒。",
            "tags": ["高蛋白", "低碳水", "健身餐", "增肌"],
        },
        {
            "title": "蚝油生菜", "cuisine": "粤菜", "difficulty": "简单", "cooking_time": "5分钟",
            "ingredients": ["生菜", "蒜", "蚝油", "生抽"],
            "steps": "1.生菜洗净焯水10秒捞出摆盘；2.热油爆香蒜末；3.加蚝油生抽少许水煮开；4.浇在生菜上即可。",
            "tags": ["快手", "低脂", "素食", "新手友好"],
        },
        {
            "title": "糖醋里脊", "cuisine": "家常", "difficulty": "中等", "cooking_time": "30分钟",
            "ingredients": ["猪里脊", "鸡蛋", "淀粉", "番茄酱", "白糖", "醋"],
            "steps": "1.里脊切条腌制（料酒盐白胡椒粉）；2.调面糊（鸡蛋+淀粉+少量水）；3.肉条裹糊炸至金黄捞出，复炸一次更酥脆；4.锅中炒糖醋汁（番茄酱+糖+醋+水），下肉条翻炒裹汁出锅。",
            "tags": ["经典", "宴客", "酸甜", "下饭"],
        },
        {
            "title": "皮蛋豆腐", "cuisine": "家常", "difficulty": "简单", "cooking_time": "5分钟",
            "ingredients": ["内酯豆腐", "皮蛋", "葱", "蒜", "生抽", "香油", "辣椒油"],
            "steps": "1.豆腐扣在盘中切几刀；2.皮蛋切碎撒在豆腐上；3.调汁（生抽、香油、辣椒油、蒜末）；4.淋汁撒葱花。",
            "tags": ["快手", "凉菜", "素食", "新手友好"],
        },
        {
            "title": "虾仁滑蛋", "cuisine": "粤菜", "difficulty": "简单", "cooking_time": "10分钟",
            "ingredients": ["虾仁", "鸡蛋", "葱", "盐", "料酒", "淀粉"],
            "steps": "1.虾仁开背去虾线，加料酒盐淀粉腌5分钟；2.鸡蛋加盐打散；3.虾仁滑油至变色捞出；4.锅中留底油，倒蛋液小火推炒至半凝固，加入虾仁翻匀撒葱花出锅。",
            "tags": ["快手", "高蛋白", "清淡", "宴客"],
        },
        {
            "title": "回锅肉", "cuisine": "川菜", "difficulty": "中等", "cooking_time": "30分钟",
            "ingredients": ["猪五花肉", "青蒜", "青椒", "豆瓣酱", "豆豉", "姜"],
            "steps": "1.五花肉冷水下锅加姜片煮20分钟至筷子能插入，晾凉切薄片；2.热锅少油下肉片炒至卷曲出油；3.加豆瓣酱豆豉炒出红油；4.加青蒜青椒翻炒至断生出锅。",
            "tags": ["川味", "经典", "下饭", "硬菜"],
        },
        {
            "title": "香菇炖鸡", "cuisine": "家常", "difficulty": "中等", "cooking_time": "90分钟",
            "ingredients": ["土鸡", "香菇", "红枣", "枸杞", "姜", "盐"],
            "steps": "1.鸡剁块冷水下锅焯去血沫捞出；2.干香菇泡发；3.砂锅加足水放鸡块香菇红枣姜片；4.大火烧开转小火炖1小时；5.加枸杞盐再炖10分钟。",
            "tags": ["滋补", "汤品", "养身", "冬季"],
        },
        {
            "title": "地三鲜", "cuisine": "东北菜", "difficulty": "中等", "cooking_time": "25分钟",
            "ingredients": ["土豆", "茄子", "青椒", "蒜", "生抽", "老抽", "糖"],
            "steps": "1.土豆茄子青椒切滚刀块；2.土豆块煎至金黄；3.茄子块煎软；4.爆香蒜末，加生抽老抽糖和少许水烧开；5.下所有蔬菜翻炒收汁。",
            "tags": ["下饭", "素食", "经典", "东北味"],
        },
        {
            "title": "冬瓜排骨汤", "cuisine": "家常", "difficulty": "简单", "cooking_time": "60分钟",
            "ingredients": ["猪排骨", "冬瓜", "姜", "枸杞", "盐", "料酒"],
            "steps": "1.排骨焯水捞出洗净；2.砂锅加水放排骨姜片料酒；3.大火烧开转小火炖40分钟；4.冬瓜去皮切块放入再炖15分钟；5.加枸杞盐调味。",
            "tags": ["汤品", "清淡", "夏季", "养身"],
        },
        {
            "title": "凉拌黄瓜", "cuisine": "家常", "difficulty": "简单", "cooking_time": "5分钟",
            "ingredients": ["黄瓜", "蒜", "醋", "生抽", "香油", "辣椒油", "盐", "糖"],
            "steps": "1.黄瓜拍碎切段；2.蒜捣成泥；3.所有调料和蒜泥调成汁；4.淋在黄瓜上拌匀腌5分钟即可。",
            "tags": ["快手", "凉菜", "低卡", "素食", "新手友好"],
        },
        {
            "title": "可乐鸡翅", "cuisine": "家常", "difficulty": "简单", "cooking_time": "25分钟",
            "ingredients": ["鸡中翅", "可乐", "生抽", "老抽", "料酒", "姜"],
            "steps": "1.鸡翅两面划刀焯水；2.热油煎鸡翅至两面金黄；3.加姜片料酒生抽老抽；4.倒可乐没过鸡翅，中火15分钟；5.大火收汁至浓稠。",
            "tags": ["快手", "新手友好", "下饭", "儿童喜欢"],
        },
        {
            "title": "豆腐菌菇汤", "cuisine": "家常", "difficulty": "简单", "cooking_time": "15分钟",
            "ingredients": ["内酯豆腐", "金针菇", "香菇", "鸡蛋", "葱", "盐", "白胡椒粉"],
            "steps": "1.香菇切片金针菇去根；2.水烧开下菌菇煮3分钟；3.豆腐切小块下锅；4.淋入蛋液搅拌成蛋花；5.加盐白胡椒粉调味撒葱花。",
            "tags": ["汤品", "快手", "低卡", "素食"],
        },
        {
            "title": "椒盐虾", "cuisine": "粤菜", "difficulty": "中等", "cooking_time": "20分钟",
            "ingredients": ["大虾", "椒盐", "蒜", "青红椒", "淀粉", "料酒"],
            "steps": "1.虾开背去虾线加料酒腌10分钟；2.裹薄淀粉；3.热油炸虾至酥脆捞出；4.锅中留底油爆香蒜末青红椒粒；5.下虾翻炒撒椒盐翻匀出锅。",
            "tags": ["宴客", "海鲜", "下酒", "高蛋白"],
        },
        {
            "title": "干煸四季豆", "cuisine": "川菜", "difficulty": "中等", "cooking_time": "20分钟",
            "ingredients": ["四季豆", "猪肉末", "干辣椒", "花椒", "蒜", "生抽"],
            "steps": "1.四季豆去筋掰段沥干水分；2.油热下四季豆炸至表皮起皱捞出；3.留底油炒肉末至酥香；4.下干辣椒花椒蒜末爆香；5.下四季豆翻炒加生抽盐出锅。",
            "tags": ["川味", "下饭", "家常", "经典"],
        },
        {
            "title": "银耳红枣汤", "cuisine": "甜品", "difficulty": "简单", "cooking_time": "60分钟",
            "ingredients": ["银耳", "红枣", "枸杞", "冰糖"],
            "steps": "1.银耳提前泡发撕小朵；2.银耳红枣入砂锅加水；3.大火烧开转小火炖40分钟至银耳出胶；4.加枸杞冰糖再煮5分钟。",
            "tags": ["甜品", "养颜", "滋补", "冬季"],
        },
        {
            "title": "牛肉面", "cuisine": "面食", "difficulty": "中等", "cooking_time": "90分钟",
            "ingredients": ["牛腱肉", "面条", "白萝卜", "香菜", "八角", "桂皮", "香叶", "姜", "生抽", "老抽"],
            "steps": "1.牛腱焯水切大块；2.炒糖色下牛肉块翻炒；3.加开水入砂锅加八角桂皮香叶姜片生抽老抽；4.小火炖1小时加白萝卜块再炖20分钟；5.另起锅煮面捞出浇牛肉汤配香菜。",
            "tags": ["面食", "汤面", "经典", "硬菜", "冬季"],
        },
        {
            "title": "蒜蓉粉丝蒸虾", "cuisine": "粤菜", "difficulty": "中等", "cooking_time": "20分钟",
            "ingredients": ["大虾", "粉丝", "蒜", "小葱", "蒸鱼豉油", "料酒"],
            "steps": "1.粉丝泡软铺盘底；2.虾开背去虾线码在粉丝上；3.蒜剁成蓉热油炒香铺在虾上；4.淋料酒蒸鱼豉油；5.水开上锅大火蒸8分钟撒葱花浇热油。",
            "tags": ["宴客", "海鲜", "清蒸", "高蛋白"],
        },
    ]

    documents = []
    metadatas = []
    for r in recipes:
        doc = (
            f"菜名：{r['title']}，菜系：{r['cuisine']}，难度：{r['difficulty']}，"
            f"时间：{r['cooking_time']}，食材：{', '.join(r['ingredients'])}，"
            f"标签：{', '.join(r['tags'])}，步骤概要：{r['steps'][:200]}"
        )
        documents.append(doc)
        metadatas.append({
            "title": r["title"], "cuisine": r["cuisine"],
            "difficulty": r["difficulty"], "cooking_time": r["cooking_time"],
            "tags": ", ".join(r["tags"]), "source": "builtin_recipes",
        })

    logger.info(f"Loaded {len(documents)} built-in recipes")
    return documents, metadatas


def load_fitness_knowledge(md_path: str = None) -> tuple[list[str], list[dict]]:
    """Load sports nutrition knowledge from Markdown file.

    Each section separated by '## ' becomes a document.
    """
    if md_path is None:
        md_path = os.path.join(DATA_DIR, "sports_nutrition.md")

    if not os.path.exists(md_path):
        logger.info(f"No fitness knowledge MD at {md_path}, loading built-in knowledge")
        return _load_builtin_fitness()

    with open(md_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Split by ## headings
    sections = content.split("\n## ")
    documents = []
    metadatas = []

    for section in sections:
        section = section.strip()
        if not section:
            continue
        heading = section.split("\n")[0].strip()
        documents.append(section)
        metadatas.append({"heading": heading, "source": "sports_nutrition"})

    logger.info(f"Loaded {len(documents)} fitness knowledge sections")
    return documents, metadatas


def _load_builtin_fitness() -> tuple[list[str], list[dict]]:
    """Built-in sports nutrition knowledge for fitness users."""
    knowledge = [
        (
            "增肌期营养原则",
            "增肌期需要热量盈余300-500kcal/天。蛋白质摄入1.6-2.2g/kg体重，碳水4-7g/kg体重，脂肪0.8-1.2g/kg体重。"
            "训练后30分钟内补充快速吸收蛋白（乳清蛋白）+ 快速碳水（香蕉/白米饭）。"
            "每日分5-6餐，保证持续的正氮平衡。优质蛋白来源：鸡胸肉、牛肉、鱼虾、鸡蛋、乳清蛋白、豆腐。"
            "优质碳水来源：米饭、燕麦、红薯、土豆、全麦面包、香蕉。"
        ),
        (
            "减脂期营养原则",
            "减脂期需要热量缺口300-500kcal/天。蛋白质摄入2.0-2.4g/kg体重（防止肌肉流失），碳水2-3g/kg体重，脂肪0.5-0.8g/kg体重。"
            "碳水集中在训练前后摄入。优先选择低GI碳水：燕麦、糙米、红薯。"
            "高蛋白低碳水食物推荐：鸡胸肉、蛋白、鱼虾、瘦牛肉、豆腐、西兰花、生菜。"
            "每日饮水量：体重kg × 40ml。避免含糖饮料和精加工食品。"
        ),
        (
            "训练前后营养",
            "训练前1-2小时：碳水为主（燕麦、全麦面包）+ 少量蛋白质，提供持续能量。避免高脂高纤维食物。"
            "训练中（超过90分钟）：补充电解质饮料或BCAA。"
            "训练后30分钟内（黄金窗口）：蛋白质20-40g + 碳水40-80g（比例约1:2至1:4）。"
            "训练后推荐食物：乳清蛋白奶昔+香蕉、鸡胸肉+米饭、鸡蛋+全麦面包。"
        ),
        (
            "碳水循环基础",
            "碳水循环是一种周期性调整碳水摄入的策略，常用于减脂平台期突破。"
            "经典模式：高碳水日（训练日）+ 低碳水日（休息日）交替。"
            "高碳日：碳水4-6g/kg，蛋白质2g/kg，脂肪<0.5g/kg。低碳日：碳水<1g/kg，蛋白质2.5g/kg，脂肪1g/kg。"
            "高碳日安排在腿部/背部等大肌群训练日，低碳日安排在休息日或小肌群训练日。"
        ),
        (
            "蛋白粉使用指南",
            "乳清蛋白：吸收快，适合训练后30分钟内。酪蛋白：吸收慢，适合睡前。植物蛋白：适合乳糖不耐受人群。"
            "推荐摄入量：每勺约25-30g蛋白质。增肌期每日1-2勺（补充饮食缺口），减脂期每日1-3勺（替代正餐）。"
            "注意事项：蛋白粉是补充品，不能替代正常饮食。乳糖不耐受者选择分离乳清或植物蛋白。"
        ),
        (
            "不同运动类型的营养需求",
            "力量训练（增肌）：高蛋白（1.6-2.2g/kg）+ 高碳水（4-7g/kg），总热量盈余。"
            "耐力训练（长跑/骑行）：高碳水（6-10g/kg）+ 中等蛋白（1.2-1.6g/kg），训练中补碳水。"
            "HIIT/CrossFit：中等蛋白（1.6-2.0g/kg）+ 中等碳水（3-5g/kg），注重训练后恢复。"
            "瑜伽/普拉提：均衡饮食，蛋白质1.2-1.6g/kg，碳水3-4g/kg。"
        ),
        (
            "蛋白质摄入详细指南",
            "成年人日常推荐摄入量：0.8g/kg体重（维持健康）。运动人群：1.2-1.6g/kg（耐力），1.6-2.2g/kg（力量/增肌），2.0-2.4g/kg（减脂期）。"
            "单次蛋白质摄入不超过40g（超过利用率下降）。建议每3-4小时摄入20-40g蛋白质。"
            "完整蛋白质来源：动物性（肉鱼蛋奶）> 大豆制品（豆腐豆浆）> 谷物豆类组合（米饭+豌豆）。"
            "亮氨酸阈值：每餐需要2-3g亮氨酸才能有效激活mTOR合成代谢通路。富含亮氨酸的食物：鸡胸肉、牛肉、乳清蛋白、鸡蛋。"
        ),
        (
            "常见健身饮食误区",
            "误区1：不吃饭可以减肥。事实：过度节食降低基础代谢，导致反弹更严重。"
            "误区2：不吃碳水可以减脂。事实：碳水是训练的主要能源，低碳水会导致训练质量下降和肌肉流失。"
            "误区3：只吃鸡胸肉和西兰花。事实：食物多样化才能保证微量元素摄入，长期单一饮食会导致营养缺乏。"
            "误区4：晚上吃东西会胖。事实：总热量平衡才是关键，晚上吃只要热量不超标不会直接转化为脂肪。"
            "误区5：补剂可以替代正餐。事实：补剂只是补充，天然食物中的微量元素和植物化学物无法被补剂替代。"
        ),
    ]

    documents = []
    metadatas = []
    for heading, content in knowledge:
        documents.append(f"## {heading}\n\n{content}")
        metadatas.append({"heading": heading, "source": "builtin_sports_nutrition"})

    logger.info(f"Loaded {len(documents)} built-in fitness knowledge sections")
    return documents, metadatas


def initialize_all_collections(force: bool = False):
    """Load all data into ChromaDB collections. Call once at startup."""
    from app.rag.vector_store import rag_store

    # Wait for background init to complete (or init synchronously)
    if not rag_store.is_ready:
        logger.info("Waiting for RAG background init...")
        rag_store._ensure_initialized()
    stats = rag_store.get_stats()

    # Nutrition DB
    if force or stats["collections"].get("nutrition", 0) == 0:
        docs, metas = load_nutrition_db()
        if docs:
            rag_store.add_documents("nutrition", docs, metas)

    # Recipe DB
    if force or stats["collections"].get("recipes", 0) == 0:
        docs, metas = load_recipe_db()
        if docs:
            rag_store.add_documents("recipe", docs, metas)

    # Fitness Knowledge
    if force or stats["collections"].get("fitness", 0) == 0:
        docs, metas = load_fitness_knowledge()
        if docs:
            rag_store.add_documents("fitness", docs, metas)

    logger.info(f"RAG initialization complete: {rag_store.get_stats()}")


if __name__ == "__main__":
    initialize_all_collections(force=True)
    from app.rag.vector_store import rag_store
    # Test search
    results = rag_store.search("鸡胸肉 蛋白质 营养成分", "nutrition", k=3)
    for r in results:
        print(f"  [{r['score']:.3f}] {r['content'][:100]}")
