# Task 5: Backend router — Phone Parser

## Files created
- `services/backend/app/routers/phone_parser.py` — 4 endpoints

## Files modified
- `services/backend/app/main.py` — added `phone_parser` import + `app.include_router(phone_parser.router)`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/phone-parser/parse` | Parse single phone → e164, country, national number |
| POST | `/api/v1/phone-parser/parse-batch` | Parse up to 500 phones at once |
| GET | `/api/v1/phone-parser/contacts` | List tenant contacts (paginated, searchable) |
| POST | `/api/v1/phone-parser/enrich` | Parse + upsert into contacts table |

## Design choices
- **No new dependency.** Phone parsing uses regex + hardcoded country dial codes (covers 150+ countries). Skipped `phonenumbers` lib — 95% coverage without the weight. Add when edge cases matter.
- **Multi-tenancy.** `GET /contacts` and `POST /enrich` filter by `current_user.tenant_id`.
- **`POST /enrich`** upserts: returns existing contact if phone already stored, creates new one otherwise. Metadata carries country info.
- **Batch endpoint** capped at 500 — prevents accidental abuse while supporting CSV import flows.
