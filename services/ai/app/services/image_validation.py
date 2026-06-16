from dataclasses import dataclass
from io import BytesIO
import warnings

from fastapi import UploadFile, status
from PIL import Image, UnidentifiedImageError
from starlette.concurrency import run_in_threadpool

from app.core.config import Settings, settings

CHUNK_SIZE_BYTES = 64 * 1024
FORMAT_TO_MEDIA_TYPE = {
    "JPEG": "image/jpeg",
    "PNG": "image/png",
    "WEBP": "image/webp",
}


@dataclass(frozen=True)
class ValidatedImage:
    content: bytes
    media_type: str
    format: str
    width: int
    height: int
    size_bytes: int


class ImageValidationError(Exception):
    def __init__(self, code: str, message: str, status_code: int) -> None:
        super().__init__(code)
        self.code = code
        self.message = message
        self.status_code = status_code

    @property
    def detail(self) -> dict[str, str]:
        return {
            "code": self.code,
            "message": self.message,
        }


def normalize_media_type(media_type: str | None) -> str:
    return (media_type or "").split(";", maxsplit=1)[0].strip().lower()


def validate_declared_media_type(media_type: str | None, allowed_media_types: list[str]) -> str:
    normalized = normalize_media_type(media_type)
    if normalized not in allowed_media_types:
        raise ImageValidationError(
            "UNSUPPORTED_MEDIA_TYPE",
            "Format gambar harus JPEG, PNG, atau WebP.",
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
        )

    return normalized


async def read_upload_limited(
    upload: UploadFile,
    max_bytes: int,
    chunk_size: int = CHUNK_SIZE_BYTES,
) -> bytes:
    chunks: list[bytes] = []
    size_bytes = 0

    while True:
        chunk = await upload.read(chunk_size)
        if not chunk:
            break

        size_bytes += len(chunk)
        if size_bytes > max_bytes:
            raise ImageValidationError(
                "IMAGE_TOO_LARGE",
                "Ukuran gambar melebihi batas yang diizinkan.",
                status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            )

        chunks.append(chunk)

    return b"".join(chunks)


def check_dimensions(width: int, height: int, max_pixels: int) -> None:
    if width <= 0 or height <= 0:
        raise ImageValidationError(
            "INVALID_IMAGE",
            "Gambar tidak memiliki dimensi yang valid.",
            status.HTTP_422_UNPROCESSABLE_ENTITY,
        )

    if width * height > max_pixels:
        raise ImageValidationError(
            "IMAGE_DIMENSIONS_TOO_LARGE",
            "Dimensi gambar melebihi batas keamanan.",
            status.HTTP_422_UNPROCESSABLE_ENTITY,
        )


def check_frame_count(frame_count: int) -> None:
    if frame_count > 1:
        raise ImageValidationError(
            "ANIMATED_IMAGE_NOT_SUPPORTED",
            "Gambar animasi atau multi-frame tidak didukung.",
            status.HTTP_422_UNPROCESSABLE_ENTITY,
        )


def validate_image_bytes(
    content: bytes,
    media_type: str,
    max_pixels: int,
) -> ValidatedImage:
    if not content:
        raise ImageValidationError(
            "EMPTY_FILE",
            "File gambar kosong.",
            status.HTTP_422_UNPROCESSABLE_ENTITY,
        )

    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)

            with BytesIO(content) as stream:
                with Image.open(stream) as image:
                    image_format = image.format or ""
                    width, height = image.size
                    frame_count = getattr(image, "n_frames", 1)

                    if image_format not in FORMAT_TO_MEDIA_TYPE:
                        raise ImageValidationError(
                            "UNSUPPORTED_MEDIA_TYPE",
                            "Format gambar harus JPEG, PNG, atau WebP.",
                            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                        )

                    actual_media_type = FORMAT_TO_MEDIA_TYPE[image_format]
                    if actual_media_type != media_type:
                        raise ImageValidationError(
                            "MEDIA_TYPE_MISMATCH",
                            "Tipe MIME tidak sesuai dengan format gambar.",
                            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                        )

                    check_dimensions(width, height, max_pixels)
                    check_frame_count(frame_count)
                    image.verify()

            with BytesIO(content) as stream:
                with Image.open(stream) as image:
                    check_dimensions(image.width, image.height, max_pixels)
                    check_frame_count(getattr(image, "n_frames", 1))
                    image.load()

    except ImageValidationError:
        raise
    except (Image.DecompressionBombError, Image.DecompressionBombWarning):
        raise ImageValidationError(
            "IMAGE_DIMENSIONS_TOO_LARGE",
            "Dimensi gambar melebihi batas keamanan.",
            status.HTTP_422_UNPROCESSABLE_ENTITY,
        ) from None
    except (UnidentifiedImageError, OSError, ValueError):
        raise ImageValidationError(
            "INVALID_IMAGE",
            "File tidak dapat diproses sebagai gambar valid.",
            status.HTTP_422_UNPROCESSABLE_ENTITY,
        ) from None

    return ValidatedImage(
        content=content,
        media_type=media_type,
        format=image_format,
        width=width,
        height=height,
        size_bytes=len(content),
    )


async def validate_upload_file(
    upload: UploadFile,
    app_settings: Settings = settings,
) -> ValidatedImage:
    media_type = validate_declared_media_type(
        upload.content_type,
        app_settings.image_allowed_media_types,
    )
    content = await read_upload_limited(upload, app_settings.image_max_bytes)

    return await run_in_threadpool(
        validate_image_bytes,
        content,
        media_type,
        app_settings.image_max_pixels,
    )
