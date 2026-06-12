# API Notes

FastAPI exposes interactive Swagger documentation when the backend is running:

- Swagger UI: `http://localhost:8001/docs`
- OpenAPI JSON: `http://localhost:8001/openapi.json`
- Health check: `http://localhost:8001/api/v1/health`

## Main Route Groups

- `/api/v1/auth`: register, login, logout and current user profile.
- `/api/v1/chat`: streaming AI private chef conversation.
- `/api/v1/recipes`: recipe CRUD, search, batch create and batch delete.
- `/api/v1/nutrition`: nutrition record CRUD, photo analysis and daily summary.
- `/api/v1/meal-plan`: AI weekly meal plan generation.
- `/api/v1/shopping`: shopping list CRUD and item status updates.
- `/api/v1/ingredients`: fridge inventory CRUD.
- `/api/v1/preferences`: user taste, allergy and family preference settings.
- `/api/v1/cook-history`: cooking history records.
- `/api/v1/feishu`: Feishu webhook configuration and push test.
- `/api/v1/speech`: speech-to-text and text-to-speech helpers.

## Auth

Protected APIs use Bearer JWT tokens. The login and register APIs return an access token. Frontend requests should set:

```http
Authorization: Bearer <access_token>
```
