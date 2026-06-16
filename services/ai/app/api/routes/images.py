from fastapi import APIRouter, File, HTTPException, UploadFile

from app.schemas.images import ImageValidationResponse
from app.services.image_validation import ImageValidationError, validate_upload_file

router = APIRouter()


@router.post(
    "/images/validate",
    response_model=ImageValidationResponse,
    summary="Validate uploaded image metadata",
)
async def validate_image(file: UploadFile = File(...)) -> ImageValidationResponse:
    try:
        result = await validate_upload_file(file)
    except ImageValidationError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
    finally:
        await file.close()

    return ImageValidationResponse(
        valid=True,
        media_type=result.media_type,
        format=result.format,
        width=result.width,
        height=result.height,
        size_bytes=result.size_bytes,
    )
