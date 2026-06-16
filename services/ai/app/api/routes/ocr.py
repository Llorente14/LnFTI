from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from starlette.concurrency import run_in_threadpool

from app.schemas.images import ImageOcrResponse, OcrImageInfo, OcrTextLine
from app.services.image_validation import ImageValidationError, validate_upload_file
from app.services.paddle_ocr import OcrResult, OcrServiceError, TextExtractor, get_text_extractor

router = APIRouter()


@router.post(
    "/images/ocr",
    response_model=ImageOcrResponse,
    summary="Extract visible text from a validated image",
)
async def extract_image_text(
    file: UploadFile = File(...),
    extractor: TextExtractor = Depends(get_text_extractor),
) -> ImageOcrResponse:
    try:
        validated = await validate_upload_file(file)
        result = await run_in_threadpool(extractor.extract, validated)
    except ImageValidationError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
    except OcrServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
    finally:
        await file.close()

    return ocr_result_to_response(result)


def ocr_result_to_response(result: OcrResult) -> ImageOcrResponse:
    return ImageOcrResponse(
        engine=result.engine,
        language=result.language,
        image=OcrImageInfo(width=result.image_width, height=result.image_height),
        lines=[OcrTextLine(text=line.text, confidence=line.confidence) for line in result.lines],
        full_text=result.full_text,
        average_confidence=result.average_confidence,
        inference_ms=result.inference_ms,
        truncated=result.truncated,
    )
