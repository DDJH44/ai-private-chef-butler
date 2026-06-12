# Security Notes

## Implemented

- JWT-based authentication for protected APIs.
- bcrypt password hashing before user data is stored.
- In-memory token blacklist for logout.
- Basic login and register rate limiting by client IP.
- SQLAlchemy ORM for database access, reducing direct SQL injection risk.
- Environment-based configuration for secrets and database connection strings.
- Global exception handling avoids exposing raw stack traces to clients.

## Required Environment Variables

- `JWT_SECRET`
- `DATABASE_URL`
- LLM provider keys used by the selected model backend
- OSS credentials when image storage is enabled

Do not commit `.env`, real API keys, database passwords, uploaded private files or generated user data.

## Known Gaps

- Current rate limiting is in-memory and single-process only. Production deployment should replace it with Redis-backed distributed rate limiting.
- There is no external error tracking service yet. Sentry or an equivalent service can be added for production incidents.
- File upload validation should be extended with stricter MIME, size and content checks.
- API permissions are user-isolated in core routes, but a future admin role model should be documented if admin features are added.
