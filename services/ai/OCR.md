# PaddleOCR Text Extraction

Jira `LNFTI-26` adds optional visible-text extraction to the LnFTI AI service.

## Endpoint

```text
POST /api/v1/images/ocr
```

The request is `multipart/form-data` with one required `file` field. The file first passes the reusable LNFTI-24 image validation rules. Supported formats remain JPEG, PNG, and WebP.

## Response

The endpoint returns:

- OCR engine and configured language;
- orientation-corrected image width and height;
- normalized text lines and confidence;
- newline-joined `full_text`;
- average confidence;
- model inference time in milliseconds;
- a `truncated` flag when configured output limits are reached.

A valid image with no recognized text returns `200` with an empty line list, empty `full_text`, and `average_confidence: null`.

## Configuration

```text
OCR_LANGUAGE=en
OCR_DEVICE=cpu
OCR_MIN_CONFIDENCE=0.50
OCR_MAX_LINES=30
OCR_MAX_TEXT_CHARS=2000
OCR_TEXT_DETECTION_MODEL=PP-OCRv5_mobile_det
OCR_TEXT_RECOGNITION_MODEL=PP-OCRv5_mobile_rec
```

The PaddleOCR pipeline loads lazily on the first OCR request. Health checks, OpenAPI generation, app import, and automated tests do not initialize or download model resources. The first real request may download model files when they are not pre-provisioned.

## Safety and Privacy

- OCR runs after bounded image validation.
- Synchronous model work runs through a Starlette thread-pool boundary.
- Shared pipeline initialization and inference are protected by a lock.
- Empty, non-string, non-finite, and low-confidence output is discarded.
- Returned output is bounded by line and character limits.
- Images, filenames, EXIF metadata, OCR text, raw model objects, and visualization files are not persisted or logged by this service.
- OCR text is editable suggestion data only and must not be used as authentication or ownership proof.
- OCR failure must not prevent users from completing reports manually; web-form fallback behavior remains part of LNFTI-27.

## Error Mapping

- `413`, `415`, `422`: inherited image-validation failures;
- `503 OCR_MODEL_UNAVAILABLE`: model/runtime initialization failed;
- `500 OCR_FAILED`: inference failed;
- `500 INVALID_OCR_RESULT`: model output could not be normalized safely.

## Verification

```bash
python -m compileall services/ai/app
python -m pytest services/ai/tests -q
python -m pip check
```

No database migration, Supabase access, hosted OCR provider, background job, or remote database push is required.
