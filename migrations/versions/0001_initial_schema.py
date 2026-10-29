"""Initial database schema matching the SQLAlchemy models on 2026-09-28."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.mysql import LONGTEXT, MEDIUMBLOB


revision = "0001_initial_schema"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("username", sa.String(length=100), nullable=False),
        sa.Column("email", sa.String(length=200), nullable=False),
        sa.Column("hashed_password", sa.String(length=255), nullable=False),
        sa.Column("avatar", LONGTEXT(), nullable=True),
        sa.Column("created_at", sa.BigInteger(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("username"),
        sa.UniqueConstraint("email"),
    )
    op.create_table(
        "recipes",
        sa.Column("id", sa.String(length=50), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("thread_id", sa.String(length=100), nullable=True),
        sa.Column("title", sa.String(length=500), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("image_url", sa.Text(), nullable=True),
        sa.Column("difficulty", sa.String(length=50), nullable=True),
        sa.Column("cooking_time", sa.String(length=50), nullable=True),
        sa.Column("ingredients", sa.JSON(), nullable=True),
        sa.Column("seasonings", sa.JSON(), nullable=True),
        sa.Column("score", sa.Float(), nullable=True),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("source_url", sa.Text(), nullable=True),
        sa.Column("video_url", sa.Text(), nullable=True),
        sa.Column("videos", sa.JSON(), nullable=True),
        sa.Column("tags", sa.JSON(), nullable=True),
        sa.Column("is_expanded", sa.Boolean(), nullable=True),
        sa.Column("created_at", sa.BigInteger(), nullable=False),
        sa.Column("updated_at", sa.BigInteger(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_recipes_created_at", "recipes", ["created_at"], unique=False)
    op.create_index("ix_recipes_user_id", "recipes", ["user_id"], unique=False)
    op.create_table(
        "ingredients",
        sa.Column("id", sa.String(length=50), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("category", sa.String(length=50), nullable=False),
        sa.Column("quantity", sa.Float(), nullable=False),
        sa.Column("unit", sa.String(length=20), nullable=False),
        sa.Column("purchase_date", sa.String(length=20), nullable=True),
        sa.Column("shelf_life_days", sa.Integer(), nullable=False),
        sa.Column("expiry_date", sa.String(length=20), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("created_at", sa.BigInteger(), nullable=False),
        sa.Column("updated_at", sa.BigInteger(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ingredients_user_id", "ingredients", ["user_id"], unique=False)
    op.create_table(
        "shopping_lists",
        sa.Column("id", sa.String(length=50), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("source_recipes", sa.JSON(), nullable=True),
        sa.Column("source_recipe_names", sa.JSON(), nullable=True),
        sa.Column("items", sa.JSON(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=True),
        sa.Column("created_at", sa.BigInteger(), nullable=False),
        sa.Column("updated_at", sa.BigInteger(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_shopping_created_at", "shopping_lists", ["created_at"], unique=False)
    op.create_index("ix_shopping_lists_user_id", "shopping_lists", ["user_id"], unique=False)
    op.create_table(
        "cook_records",
        sa.Column("id", sa.String(length=50), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("recipe_id", sa.String(length=50), nullable=False),
        sa.Column("recipe_name", sa.String(length=500), nullable=False),
        sa.Column("cook_date", sa.String(length=20), nullable=False),
        sa.Column("rating", sa.Integer(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=False),
        sa.Column("photos", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.BigInteger(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_cook_records_cook_date", "cook_records", ["cook_date"], unique=False)
    op.create_index("ix_cook_records_user_id", "cook_records", ["user_id"], unique=False)
    op.create_table(
        "nutrition_records",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("date", sa.String(length=20), nullable=False),
        sa.Column("meal_type", sa.String(length=20), nullable=False),
        sa.Column("food_name", sa.String(length=500), nullable=False),
        sa.Column("calories", sa.Float(), nullable=True),
        sa.Column("protein", sa.Float(), nullable=True),
        sa.Column("carbs", sa.Float(), nullable=True),
        sa.Column("fat", sa.Float(), nullable=True),
        sa.Column("fiber", sa.Float(), nullable=True),
        sa.Column("sodium", sa.Float(), nullable=True),
        sa.Column("image_url", sa.Text(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.BigInteger(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_nutrition_records_date", "nutrition_records", ["date"], unique=False)
    op.create_table(
        "feishu_config",
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("webhook_url", sa.Text(), nullable=False),
        sa.Column("onboarding_step", sa.String(length=50), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.BigInteger(), nullable=False),
        sa.Column("updated_at", sa.BigInteger(), nullable=False),
        sa.PrimaryKeyConstraint("user_id"),
    )
    op.create_table(
        "preferences",
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("data", sa.JSON(), nullable=False),
        sa.Column("updated_at", sa.BigInteger(), nullable=False),
        sa.PrimaryKeyConstraint("user_id"),
    )
    op.create_table(
        "checkpoints",
        sa.Column("thread_id", sa.String(length=128), nullable=False),
        sa.Column("checkpoint_ns", sa.String(length=100), nullable=False),
        sa.Column("checkpoint_id", sa.String(length=64), nullable=False),
        sa.Column("parent_checkpoint_id", sa.String(length=64), nullable=True),
        sa.Column("type", sa.String(length=100), nullable=True),
        sa.Column("checkpoint", MEDIUMBLOB(), nullable=True),
        sa.Column("metadata", MEDIUMBLOB(), nullable=True),
        sa.PrimaryKeyConstraint("thread_id", "checkpoint_ns", "checkpoint_id"),
    )
    op.create_table(
        "writes",
        sa.Column("thread_id", sa.String(length=128), nullable=False),
        sa.Column("checkpoint_ns", sa.String(length=100), nullable=False),
        sa.Column("checkpoint_id", sa.String(length=64), nullable=False),
        sa.Column("task_id", sa.String(length=128), nullable=False),
        sa.Column("idx", sa.Integer(), nullable=False),
        sa.Column("channel", sa.String(length=100), nullable=False),
        sa.Column("type", sa.String(length=100), nullable=True),
        sa.Column("value", MEDIUMBLOB(), nullable=True),
        sa.PrimaryKeyConstraint(
            "thread_id", "checkpoint_ns", "checkpoint_id", "task_id", "idx"
        ),
    )
    op.create_table(
        "image_cache",
        sa.Column("dish_query", sa.String(length=200), nullable=False),
        sa.Column("oss_url", sa.Text(), nullable=False),
        sa.Column("created_at", sa.BigInteger(), nullable=False),
        sa.PrimaryKeyConstraint("dish_query"),
    )
    op.create_table(
        "body_metrics",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("date", sa.String(length=20), nullable=False),
        sa.Column("weight", sa.Float(), nullable=True),
        sa.Column("body_fat", sa.Float(), nullable=True),
        sa.Column("muscle_mass", sa.Float(), nullable=True),
        sa.Column("waist", sa.Float(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.BigInteger(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_body_metrics_date", "body_metrics", ["date"], unique=False)
    op.create_index("ix_body_metrics_user_id", "body_metrics", ["user_id"], unique=False)
    op.create_table(
        "meal_plans",
        sa.Column("id", sa.String(length=50), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("week_start", sa.String(length=20), nullable=False),
        sa.Column("week_end", sa.String(length=20), nullable=False),
        sa.Column("plan_data", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("created_at", sa.BigInteger(), nullable=False),
        sa.Column("updated_at", sa.BigInteger(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "idx_meal_plans_user_week", "meal_plans", ["user_id", "week_start"], unique=False
    )
    op.create_index("ix_meal_plans_user_id", "meal_plans", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_table("meal_plans")
    op.drop_index("ix_body_metrics_user_id", table_name="body_metrics")
    op.drop_index("ix_body_metrics_date", table_name="body_metrics")
    op.drop_table("body_metrics")
    op.drop_table("image_cache")
    op.drop_table("writes")
    op.drop_table("checkpoints")
    op.drop_table("preferences")
    op.drop_table("feishu_config")
    op.drop_index("ix_nutrition_records_date", table_name="nutrition_records")
    op.drop_table("nutrition_records")
    op.drop_index("ix_cook_records_user_id", table_name="cook_records")
    op.drop_index("ix_cook_records_cook_date", table_name="cook_records")
    op.drop_table("cook_records")
    op.drop_index("ix_shopping_lists_user_id", table_name="shopping_lists")
    op.drop_index("idx_shopping_created_at", table_name="shopping_lists")
    op.drop_table("shopping_lists")
    op.drop_index("ix_ingredients_user_id", table_name="ingredients")
    op.drop_table("ingredients")
    op.drop_index("ix_recipes_user_id", table_name="recipes")
    op.drop_index("idx_recipes_created_at", table_name="recipes")
    op.drop_table("recipes")
    op.drop_table("users")
