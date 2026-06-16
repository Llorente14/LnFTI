from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from starlette.concurrency import run_in_threadpool

from app.core.auth import require_internal_api_token
from app.schemas.images import (
    BoundingBox,
    DetectionImageInfo,
    ImageDetectionResponse,
    ObjectDetection,
)
from app.services.image_validation import ImageValidationError, validate_upload_file
from app.services.yolo_detection import (
    DetectionServiceError,
    DetectionResult,
    ObjectDetector,
    get_object_detector,
)

router = APIRouter()


@router.post(
    "/images/detect",
    response_model=ImageDetectionResponse,
    summary="Detect objects in a validated image",
    dependencies=[Depends(require_internal_api_token)],
)
async def detect_image(
    file: UploadFile = File(...),
    detector: ObjectDetector = Depends(get_object_detector),
) -> ImageDetectionResponse:
    try:
        validated = await validate_upload_file(file)
        result = await run_in_threadpool(detector.detect, validated)
    except ImageValidationError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
    except DetectionServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
    finally:
        await file.close()

    return detection_result_to_response(result)


def detection_result_to_response(result: DetectionResult) -> ImageDetectionResponse:
    return ImageDetectionResponse(
        model=result.model,
        image=DetectionImageInfo(width=result.image_width, height=result.image_height),
        detections=[
            ObjectDetection(
                class_id=detection.class_id,
                label=detection.label,
                confidence=detection.confidence,
                bbox=BoundingBox(
                    x1=detection.bbox.x1,
                    y1=detection.bbox.y1,
                    x2=detection.bbox.x2,
                    y2=detection.bbox.y2,
                ),
                suggested_category=detection.suggested_category,
            )
            for detection in result.detections
        ],
        suggested_category=result.suggested_category,
        inference_ms=result.inference_ms,
    )
