import asyncio
from io import BytesIO

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.main import app
from app.services.image_validation import ImageValidationError, read_upload_limited

client = TestClient(app)


def make_image_bytes(image_format: str, size: tuple[int, int] = (8, 6), save_all: bool = False) -> bytes:
    output = BytesIO()
    image = Image.new("RGB", size, color=(107, 18, 32))

    if save_all:
        second_frame = Image.new("RGB", size, color=(200, 150, 58))
        image.save(output, format=image_format, save_all=True, append_images=[second_frame], duration=100, loop=0)
    else:
        image.save(output, format=image_format)

    return output.getvalue()


def post_image(content: bytes, media_type: str, field_name: str = "file"):
    return client.post(
        "/api/v1/images/validate",
        files={field_name: ("upload.bin", content, media_type)},
    )


def assert_error(response, status_code: int, code: str) -> None:
    assert response.status_code == status_code
    assert response.json()["detail"]["code"] == code
    assert "message" in response.json()["detail"]


def test_valid_jpeg_returns_normalized_metadata() -> None:
    content = make_image_bytes("JPEG", size=(12, 9))

    response = post_image(content, "image/jpeg")

    assert response.status_code == 200
    assert response.json() == {
        "valid": True,
        "media_type": "image/jpeg",
        "format": "JPEG",
        "width": 12,
        "height": 9,
        "size_bytes": len(content),
    }


def test_valid_png_returns_normalized_metadata() -> None:
    content = make_image_bytes("PNG", size=(10, 7))

    response = post_image(content, "image/png")

    assert response.status_code == 200
    assert response.json()["format"] == "PNG"
    assert response.json()["media_type"] == "image/png"


def test_valid_webp_returns_normalized_metadata() -> None:
    content = make_image_bytes("WEBP", size=(9, 5))

    response = post_image(content, "image/webp")

    assert response.status_code == 200
    assert response.json()["format"] == "WEBP"
    assert response.json()["width"] == 9


def test_missing_file_field_uses_fastapi_validation_response() -> None:
    response = client.post(
        "/api/v1/images/validate",
        files={"other": ("upload.jpg", make_image_bytes("JPEG"), "image/jpeg")},
    )

    assert response.status_code == 422


def test_empty_upload_is_rejected() -> None:
    response = post_image(b"", "image/jpeg")

    assert_error(response, 422, "EMPTY_FILE")


def test_unsupported_declared_mime_is_rejected() -> None:
    response = post_image(make_image_bytes("PNG"), "image/gif")

    assert_error(response, 415, "UNSUPPORTED_MEDIA_TYPE")


def test_non_image_bytes_declared_as_jpeg_are_rejected() -> None:
    response = post_image(b"not image bytes", "image/jpeg")

    assert_error(response, 422, "INVALID_IMAGE")


def test_actual_png_declared_as_jpeg_is_rejected() -> None:
    response = post_image(make_image_bytes("PNG"), "image/jpeg")

    assert_error(response, 415, "MEDIA_TYPE_MISMATCH")


def test_truncated_image_is_rejected() -> None:
    content = make_image_bytes("JPEG")

    response = post_image(content[:20], "image/jpeg")

    assert_error(response, 422, "INVALID_IMAGE")


def test_size_limit_stops_before_reading_complete_upload() -> None:
    class ChunkedUpload:
        def __init__(self) -> None:
            self._chunks = [b"abcd", b"efgh", b"ijkl"]
            self.read_count = 0

        async def read(self, _: int) -> bytes:
            self.read_count += 1
            return self._chunks.pop(0) if self._chunks else b""

    upload = ChunkedUpload()

    with pytest.raises(ImageValidationError) as exc_info:
        asyncio.run(read_upload_limited(upload, max_bytes=5, chunk_size=4))  # type: ignore[arg-type]

    assert exc_info.value.code == "IMAGE_TOO_LARGE"
    assert upload.read_count == 2


def test_animated_webp_is_rejected() -> None:
    content = make_image_bytes("WEBP", save_all=True)

    response = post_image(content, "image/webp")

    assert_error(response, 422, "ANIMATED_IMAGE_NOT_SUPPORTED")
