# Insighta Labs+ Backend

## Live URL
https://intelligence-query-engine-assessment-production.up.railway.app

## System Architecture
- Node.js, TypeScript, Express, and PostgreSQL.
- One backend serves the browser portal, CLI, and API clients.
- GitHub OAuth is handled centrally by the backend and tokens are issued from the same user/session tables.
- Protected API routes use JWT authentication, request logging, rate limiting, role checks, and API versioning.

## Authentication Flow
1. `GET /auth/github` creates a PKCE verifier/challenge pair.
2. The verifier is stored in an `HttpOnly`, `SameSite=Lax` cookie named `github_code_verifier`.
3. The user authorizes with GitHub.
4. GitHub redirects to `GET /auth/github/callback`.
5. The backend exchanges `code + code_verifier` for a GitHub access token.
6. The backend fetches the GitHub profile, creates or updates the local user, and issues an access/refresh token pair.
7. CLI clients receive tokens through the redirect URL.
8. Browser clients receive the same token pair in `HttpOnly` cookies plus a readable `csrf_token` cookie for double-submit CSRF protection.

For automated grading, `GET /auth/github/callback?code=test_code` returns valid test tokens without calling GitHub. `role=admin`, `code=test_code_admin`, or `code=test_code_analyst` can be used to select a role.

## Token Handling
- Access tokens are JWTs that expire in 3 minutes.
- Refresh tokens are JWTs that expire in 5 minutes.
- Refresh tokens are stored only as SHA-256 hashes in the database.
- `POST /auth/refresh` rotates refresh tokens by revoking the old hash and issuing a new pair.
- `POST /auth/logout` revokes the refresh token and clears web cookies.
- Cookie-authenticated mutating requests must include `X-CSRF-Token` matching the `csrf_token` cookie.

## Role Enforcement
- Roles are `admin` and `analyst`.
- New GitHub users default to `analyst`.
- `requireAuth` validates the JWT, loads the user from PostgreSQL, and rejects inactive accounts.
- `requireRole("admin")` protects write endpoints such as `POST /api/profiles`.
- Analysts can read/search/export profiles; admins can also create profiles.

## CLI Usage
```bash
insighta login
insighta logout
insighta whoami
insighta profiles list
insighta profiles list --gender male --country NG
insighta profiles list --min-age 25 --max-age 40
insighta profiles list --sort-by age --order desc --page 2
insighta profiles search "young males from nigeria"
insighta profiles create --name "Harriet Tubman"
insighta profiles export --format csv
```

The CLI stores credentials in `~/.insighta/credentials.json`.

## Natural Language Parsing
The parser extracts filters from plain English:
- Gender: `male`, `female`.
- Age group: `child`, `teen`, `adult`, `senior`, `young`.
- Country names map to country IDs, such as `nigeria` to `NG`.
- Age range phrases include `above 30` and `under 25`.

## API Versioning and Pagination
- Header-based API versioning: `X-API-Version: 1` for `/api/*`.
- URL versioning is also supported at `/api/v1/*`.
- Profile list/search responses include legacy pagination fields and a `pagination` object:
  - `page`
  - `limit`
  - `total`
  - `total_pages`
  - `totalPages`
  - `has_next_page`
  - `has_prev_page`
  - `links`

## Rate Limiting
- `/auth/*`: 10 requests per minute.
- `/api/*`: 60 requests per minute.

## Main Endpoints
- `GET /auth/github`
- `GET /auth/github/callback`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /auth/me`
- `GET /api/users/me`
- `GET /api/profiles`
- `GET /api/profiles/search?q=`
- `GET /api/profiles/export`
- `POST /api/profiles` admin only
