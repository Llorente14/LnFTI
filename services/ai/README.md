# LnFTI AI Service

FastAPI service for LnFTI image validation and future YOLO category detection and PaddleOCR text extraction.

Jira `LNFTI-10` set up the runnable service structure, health endpoint, configuration, and smoke tests. Jira `LNFTI-24` adds reusable image-file validation only. YOLO detection remains deferred to `LNFTI-25`, PaddleOCR remains deferred to `LNFTI-26`, and web form integration remains deferred to `LNFTI-27`.

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
IMAGE_MAX_BYTES=5242880
IMAGE_MAX_PIXELS=40000000
IMAGE_ALLOWED_MEDIA_TYPES=image/jpeg,image/png,image/webp
```

`IMAGE_MAX_BYTES` is bytes. Default is 5 MiB. `IMAGE_MAX_PIXELS` is decoded pixel count. Both values must be positive. Allowed image media types are normalized and limited to the web-supported set.

## Image Validation

Endpoint:

```text
POST /api/v1/images/validate
```

Request:

- `multipart/form-data`
- required field: `file`
- exactly one uploaded image is validated

Supported declared MIME types:

- `image/jpeg`
- `image/png`
- `image/webp`

Supported decoded formats:

- `JPEG`
- `PNG`
- `WEBP`

Rules:

- maximum upload size is 5,242,880 bytes;
- file must not be empty;
- image must decode successfully with Pillow;
- decoded format must match the declared MIME type;
- dimensions must be positive and at or below 40,000,000 pixels by default;
- animated or multi-frame images are rejected;
- files are processed in memory and are not persisted;
- original filenames, EXIF metadata, raw bytes, base64, OCR text, and detection results are not returned.

Success example:

```json
{
  "valid": true,
  "media_type": "image/jpeg",
  "format": "JPEG",
  "width": 1200,
  "height": 900,
  "size_bytes": 245812
}
```

Error status mapping:

- `413`: image exceeds 5 MiB;
- `415`: unsupported declared MIME type, unsupported decoded format, or declared/actual MIME mismatch;
- `422`: missing multipart field, empty file, corrupt or truncated image, unsafe dimensions, or animated image.

Controlled validation errors use:

```json
{
  "detail": {
    "code": "INVALID_IMAGE",
    "message": "File tidak dapat diproses sebagai gambar valid."
  }
}
```

Curl example:

```bash
curl -X POST \
  -F "file=@sample.jpg;type=image/jpeg" \
  http://127.0.0.1:8000/api/v1/images/validate
```

The validation service lives in `app/services/image_validation.py` so `LNFTI-25` and `LNFTI-26` can reuse the same upload rules before YOLO or OCR processing. This ticket does not add YOLO, OCR, Supabase access, database access, production authorization, or API secrets. Production exposure and web-to-AI authorization remain deployment/integration work.

## Verification

```bash
python -m compileall services/ai/app
python -m pytest services/ai/tests -q
```
