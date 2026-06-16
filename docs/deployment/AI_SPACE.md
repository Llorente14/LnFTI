# Hugging Face AI Space

The production AI service runs as a Hugging Face Docker Space built from `services/ai`.

## Build Locally

```bash
docker build -t lnfti-ai:lnfti-29 services/ai
```

Run locally with non-production values:

```bash
docker run --rm -p 7860:7860 --env-file services/ai/.env lnfti-ai:lnfti-29
```

Health:

```text
GET http://127.0.0.1:7860/api/v1/health
```

Do not claim Docker validation passed when Docker is unavailable.

## Required Production Settings

Secret:

```text
AI_INTERNAL_API_TOKEN
```

Variables:

```text
ENVIRONMENT=production
API_PREFIX=/api/v1
ALLOWED_ORIGINS=<production web origin>
IMAGE_MAX_BYTES=5242880
IMAGE_MAX_PIXELS=40000000
IMAGE_ALLOWED_MEDIA_TYPES=image/jpeg,image/png,image/webp
YOLO_MODEL_PATH=yolo26n.pt
YOLO_DEVICE=cpu
YOLO_CONFIDENCE_THRESHOLD=0.25
YOLO_IOU_THRESHOLD=0.70
YOLO_IMAGE_SIZE=640
YOLO_MAX_DETECTIONS=20
OCR_LANGUAGE=en
OCR_DEVICE=cpu
OCR_MIN_CONFIDENCE=0.50
OCR_MAX_LINES=30
OCR_MAX_TEXT_CHARS=2000
OCR_TEXT_DETECTION_MODEL=PP-OCRv5_mobile_det
OCR_TEXT_RECOGNITION_MODEL=PP-OCRv5_mobile_rec
```

Do not use wildcard CORS in production. Do not hardcode production origins. Do not expose `AI_INTERNAL_API_TOKEN` in logs, docs examples, or image layers.

## Packaging

```bash
node scripts/package-hf-space.mjs
```

The generated `dist/huggingface-space/` directory contains only Space metadata, Dockerfile, `.dockerignore`, requirements, app source, and service docs. It excludes env files, tests, model weights, caches, logs, and generated `runs/`.

## Runtime Notes

- Port: `7860`
- Uvicorn workers: `1`
- Health check: `/api/v1/health`
- Models load lazily on first detection/OCR request.
- First inference may be slow.
- Free Space disk/cache is not assumed durable.
- Uploaded images are processed in memory and not retained.
- Use a non-sensitive sample image to warm up before demo.
- Do not add external keep-alive traffic.

## Rollback

Revert the Space to the last healthy commit, wait for rebuild, check `/api/v1/health`, then run one non-sensitive analysis smoke. Rotate AI token if exposure is suspected.
