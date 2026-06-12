# Project Metrics

Generated at: 2026-06-11 21:19:53

These metrics are collected from local source files and local ChromaDB metadata. They do not include secrets or user-private records.

## Summary

| Metric | Value |
| --- | ---: |
| Backend API routes | 55 |
| Backend Python modules | 33 |
| SQLAlchemy model classes | 12 |
| Frontend pages | 11 |

## API Routes by File

| File | Route count |
| --- | ---: |
| `auth.py` | 5 |
| `body_metrics.py` | 3 |
| `chat.py` | 3 |
| `cook_history.py` | 3 |
| `feishu.py` | 8 |
| `ingredients.py` | 4 |
| `meal_plan.py` | 1 |
| `nutrition.py` | 6 |
| `oss.py` | 4 |
| `preferences.py` | 2 |
| `recipes.py` | 8 |
| `shopping.py` | 6 |
| `speech.py` | 2 |

## ChromaDB Collections

| Collection | Document count |
| --- | ---: |
| `nutrition_db` | 76 |
| `recipe_db` | 26 |
| `fitness_knowledge` | 8 |

## Notes

- Response latency and first-token latency should be collected with a runtime benchmark instead of guessed.
- Retrieval accuracy should be measured with a fixed evaluation set before being used as a resume metric.
