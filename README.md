# Insighta Labs – Intelligence Query Engine

A backend API for querying demographic profiles with advanced filtering, sorting, pagination, and natural language search.

## Overview

This project allows clients (marketing teams, analysts, etc.) to:

Filter profiles by multiple conditions
Sort results dynamically
Paginate large datasets
Query data using plain English
## Natural Language Parsing Approach

The /api/profiles/search endpoint uses a rule-based parser to convert plain English queries into structured filters.

 No AI or LLM is used — strictly rule-based logic.

## Supported Patterns
## Gender
male, males, man, men → gender = male
female, females, woman, women → gender = female
## Age Groups
child, children → age_group = child
teen, teenager, teenagers → age_group = teenager
adult, adults → age_group = adult
senior, seniors → age_group = senior
## Special Keyword
young → min_age = 16, max_age = 24
## Age Conditions
above 30, over 30 → min_age = 30
below 20, under 20 → max_age = 20
## Country Mapping
Country	Code
nigeria	NG
kenya	KE
angola	AO
ghana	GH
tanzania	TZ
## Parsing Logic
Convert query to lowercase
Match keywords using string checks and regex
Extract values (age, gender, country)
Map values to filter fields
Combine filters using AND logic
Build SQL query dynamically
## Example Queries
Query	Output Filters
young males	gender=male, min_age=16, max_age=24
females above 30	gender=female, min_age=30
people from angola	country_id=AO
adult males from kenya	gender=male, age_group=adult, country_id=KE
teenagers under 20	age_group=teenager, max_age=20
## Limitations
Only predefined keywords are supported
No spelling correction
No complex boolean logic (AND/OR/NOT)
Only one country is parsed per query
If both male and female appear, last match wins
Unrecognized queries return:
{
  "status": "error",
  "message": "Unable to interpret query"
}
⚙️ Features Implemented
✅ Advanced Filtering (combined filters)
✅ Sorting (age, created_at, gender_probability)
✅ Pagination (page, limit)
✅ Natural Language Search
✅ Input Validation
✅ Error Handling (400, 422, 500)
✅ UUID v7 for IDs
✅ UTC ISO timestamps
✅ Indexed database (performance optimized)
## Database Schema
profiles (
  id UUID PRIMARY KEY,
  name VARCHAR UNIQUE,
  gender VARCHAR,
  gender_probability FLOAT,
  age INT,
  age_group VARCHAR,
  country_id VARCHAR(2),
  country_name VARCHAR,
  country_probability FLOAT,
  created_at TIMESTAMP
)
# API Endpoints
## Get Profiles
GET /api/profiles
Supports:
Filtering
Sorting
Pagination
 Search Profiles (Natural Language)
GET /api/profiles/search?q=...
Example:
/api/profiles/search?q=young males from nigeria
## How to Run Locally
npm install
npx ts-node src/server.ts
## Example Requests
/api/profiles?gender=male&min_age=25
/api/profiles?country_id=NG&sort_by=age&order=desc
/api/profiles/search?q=females above 30
## Deployment (Railway)
Go to https://railway.app
Create new project
Connect GitHub repo
Add PostgreSQL service
Set environment variable:
DATABASE_URL=your_railway_db_url
Deploy 🚀
## Submission Checklist
 Profiles endpoint working
 Search endpoint working
 Pagination implemented
 Sorting implemented
 Filters combinable
 Natural language parsing
 Error handling implemented
 2026 records seeded
 No duplicates on reseed
 CORS enabled
 README included