# LnFTI AI Service

FastAPI foundation for future LnFTI image validation, YOLO category detection, and PaddleOCR text extraction.

Jira `LNFTI-10` only sets up the runnable service structure, health endpoint, configuration, and smoke tests. Image validation, YOLO, PaddleOCR, Supabase access, and model loading are not included yet.

## Local Setup

### Windows

```powershell
cd services/ai
py -m venv .venv
.venv\Scripts\activate
python -m pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Linux/macOS

```bash
cd services/ai
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
uvicorn app.main:app --reload
```

## URLs

- Application: http://127.0.0.1:8000
- Health: http://127.0.0.1:8000/api/v1/health
- Swagger: http://127.0.0.1:8000/docs
- OpenAPI: http://127.0.0.1:8000/openapi.json

## Configuration

Copy values from `.env.example` into environment variables as needed. Do not store secrets in this service config.

Default settings:

```text
APP_NAME=LnFTI AI Service
APP_VERSION=0.1.0
ENVIRONMENT=development
API_PREFIX=/api/v1
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

## Verification

```bash
python -m compileall services/ai/app
python -m pytest services/ai/tests -q
```
