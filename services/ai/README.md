# LnFTI AI Service

FastAPI service for LnFTI image validation, YOLO category detection, and future PaddleOCR text extraction.

Jira `LNFTI-10` set up the runnable service structure, health endpoint, configuration, and smoke tests. Jira `LNFTI-24` adds reusable image-file validation. Jira `LNFTI-25` adds YOLO object detection. PaddleOCR remains deferred to `LNFTI-26`, and web form integration remains deferred to `LNFTI-27`.

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
YOLO_MODEL_PATH=yolo26n.pt
YOLO_DEVICE=cpu
YOLO_CONFIDENCE_THRESHOLD=0.25
YOLO_IOU_THRESHOLD=0.70
YOLO_IMAGE_SIZE=640
YOLO_MAX_DETECTIONS=20
```

`IMAGE_MAX_BYTES` is bytes. Default is 5 MiB. `IMAGE_MAX_PIXELS` is decoded pixel count. Both values must be positive. Allowed image media types are normalized and limited to the web-supported set.

YOLO settings are trusted application configuration. `YOLO_MODEL_PATH` may be an official model name such as `yolo26n.pt` or a pre-provisioned local path. API responses expose only the model file name, never the full configured path. CPU is the default device. Confidence and IoU thresholds must be greater than 0 and at most 1. Image size must be 320-1280 and divisible by 32. Max detections must be 1-100.

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

## YOLO Detection

Endpoint:

```text
POST /api/v1/images/detect
```

Request:

- `multipart/form-data`
- required field: `file`
- exactly one uploaded image is validated and then sent to YOLO detection

Processing sequence:

```text
multipart upload -> reusable LNFTI-24 validation -> YOLO inference -> normalized detections -> optional LnFTI category suggestion -> JSON response
```

Default model and dependency:

- dependency: `ultralytics-opencv-headless==8.4.63`;
- default model: `yolo26n.pt`;
- model loads lazily on the first detection request;
- health checks, OpenAPI generation, app import, and automated tests do not load or download weights;
- first real detection may download official weights when the model is not pre-provisioned;
- model weights (`*.pt`) and generated `runs/` output are not committed.

Success example:

```json
{
  "model": "yolo26n.pt",
  "image": {
    "width": 1280,
    "height": 720
  },
  "detections": [
    {
      "class_id": 39,
      "label": "bottle",
      "confidence": 0.9234,
      "bbox": {
        "x1": 120.5,
        "y1": 80.25,
        "x2": 542.75,
        "y2": 690.0
      },
      "suggested_category": "Botol & Wadah"
    }
  ],
  "suggested_category": "Botol & Wadah",
  "inference_ms": 68.42
}
```

`bbox` uses `xyxy` image-pixel coordinates against the orientation-corrected image passed to YOLO. Coordinates are clamped to image bounds and rounded to two decimals. Confidence is rounded to four decimals. Detections are sorted by confidence descending and capped by `YOLO_MAX_DETECTIONS`.

`inference_ms` measures only `model.predict()` execution with `time.perf_counter()`. It does not include upload reading, image validation, or lazy model loading.

Empty detections are a valid `200` response:

```json
{
  "model": "yolo26n.pt",
  "image": {
    "width": 640,
    "height": 480
  },
  "detections": [],
  "suggested_category": null,
  "inference_ms": 41.2
}
```

LnFTI category mapping is editable guidance only. It maps selected COCO labels:

- `backpack`, `handbag`, `suitcase` -> `Tas`
- `laptop`, `mouse`, `keyboard`, `cell phone`, `remote` -> `Elektronik`
- `bottle`, `cup` -> `Botol & Wadah`
- `book` -> `Dokumen`
- `tie`, `umbrella` -> `Aksesori`

Unmapped labels keep `suggested_category: null`. The top-level `suggested_category` is the category from the highest-confidence mapped detection. Pretrained COCO cannot reliably detect KTM, student cards, wallets, chargers, or arbitrary documents.

Detection error status mapping:

- `413`, `415`, `422`: inherited LNFTI-24 validation failures;
- `503`: model unavailable or cannot load;
- `500`: detector result/inference failure.

The endpoint uses the LNFTI-24 in-memory validation service before inference, runs `model.predict()` through a Starlette thread-pool boundary, and synchronizes model loading/prediction with a lock. Images, EXIF metadata, filenames, tensors, annotated outputs, raw bytes, and detection results are not persisted.

Curl example:

```bash
curl -X POST \
  -F "file=@sample.jpg;type=image/jpeg" \
  http://127.0.0.1:8000/api/v1/images/detect
```

Ultralytics dependency and model use have licensing obligations. Academic or open-source use must comply with the applicable license, and proprietary/commercial deployment requires explicit licensing review. This codebase does not claim the model is unrestricted.

This ticket does not add PaddleOCR, Supabase access, database access, web form integration, production authorization, or API secrets.

## Verification

```bash
python -m compileall services/ai/app
python -m pytest services/ai/tests -q
```
