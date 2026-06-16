---
title: LnFTI AI Service
emoji: "🔎"
colorFrom: red
colorTo: yellow
sdk: docker
app_port: 7860
---

# LnFTI AI Service

Generated Space source comes from `services/ai` through `scripts/package-hf-space.mjs`.

Runtime shape:

- FastAPI on port `7860`.
- `GET /api/v1/health` stays public and does not load YOLO or PaddleOCR.
- `POST /api/v1/images/detect` and `POST /api/v1/images/ocr` require `Authorization: Bearer <AI_INTERNAL_API_TOKEN>`.
- Models load lazily on first inference.
- Uploaded images are processed in memory and not persisted.

Configure production values as Space Secrets or Variables. Keep `AI_INTERNAL_API_TOKEN` as a Secret only.
