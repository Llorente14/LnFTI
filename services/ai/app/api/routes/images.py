from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from app.core.auth import require_internal_api_token
from app.schemas.images import ImageValidationResponse
from app.services.image_validation import ImageValidationError, validate_upload_file

router = APIRouter()


@router.post(
    "/images/validate",
    response_model=ImageValidationResponse,
    summary="Validate uploaded image metadata",
    dependencies=[Depends(require_internal_api_token)],
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
