# Insighta Labs+ — Backend

## Live URL
https://intelligence-query-engine-assessment-production.up.railway.app

## System Architecture
- Node.js + TypeScript + Express
- PostgreSQL database (Railway)
- Three repos: backend, CLI, web portal

## Authentication Flow
1. User hits GET /auth/github
2. Backend generates PKCE code_challenge, stores code_verifier in cookie
3. User authenticates with GitHub
4. GitHub redirects to /auth/github/callback
5. Backend exchanges code + verifier for GitHub token
6. Backend fetches GitHub user, creates/updates user in DB
7. Issues access token (3min) + refresh token (5min)
8. CLI: tokens sent via redirect params
9. Web: tokens sent via redirect params, stored in localStorage

## Token Handling
- Access token: JWT, expires in 3 minutes
- Refresh token: JWT, expires in 5 minutes, stored hashed in DB
- On refresh: old token invalidated, new pair issued
- On logout: refresh token revoked in DB

## Role Enforcement
- Two roles: admin, analyst
- Default role: analyst
- admin: full access (create, delete, read)
- analyst: read-only
- Enforced via requireRole() middleware on protected routes

## CLI Usage
```bash
insighta login
insighta logout
insighta whoami
insighta profiles list
insighta profiles list --gender male --country NG
insighta profiles list --min-age 25 --max-age 40
insighta profiles list --sort-by age --order desc --page 2
insighta profiles get <id>
insighta profiles search "young males from nigeria"
insighta profiles create --name "Harriet Tubman"
insighta profiles export --format csv
```

## Natural Language Parsing
Parser extracts filters from plain English:
- Gender: "male", "female"
- Age group: "child", "teen", "adult", "senior", "young"
- Country: "nigeria" → NG, "kenya" → KE, etc.
- Age range: "above 30", "under 25"

## API Versioning
All /api/* endpoints require header:
X-API-Version: 1

## Rate Limiting
- /auth/* → 10 requests/minute
- /api/* → 60 requests/minute per user

## Endpoints
- GET /auth/github
- GET /auth/github/callback
- POST /auth/refresh
- POST /auth/logout
- GET /api/profiles
- GET /api/profiles/search?q=
- GET /api/profiles/export?format=csv
- POST /api/profiles (admin only)