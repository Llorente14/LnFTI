import asyncio
from io import BytesIO

import pytest
from PIL import Image
from starlette.datastructures import Headers, UploadFile

from app.services import image_validation
from app.services.image_validation import ImageValidationError, validate_image_bytes


def make_png(size: tuple[int, int]) -> bytes:
    output = BytesIO()
    Image.new("RGB", size, color=(107, 18, 32)).save(output, format="PNG")
    return output.getvalue()


def test_custom_pixel_limit_does_not_mutate_pillow_global() -> None:
    content = make_png((11, 10))
    previous_limit = Image.MAX_IMAGE_PIXELS

    with pytest.raises(ImageValidationError) as exc_info:
        validate_image_bytes(content, "image/png", max_pixels=100)

    assert exc_info.value.code == "IMAGE_DIMENSIONS_TOO_LARGE"
    assert Image.MAX_IMAGE_PIXELS == previous_limit


def test_upload_validation_offloads_pillow_work(monkeypatch: pytest.MonkeyPatch) -> None:
    content = make_png((4, 3))
    upload = UploadFile(
        file=BytesIO(content),
        filename="upload.png",
        headers=Headers({"content-type": "image/png"}),
    )
    calls: list[tuple[object, tuple[object, ...]]] = []

    async def fake_run_in_threadpool(function, *args):
        calls.append((function, args))
        return function(*args)

    monkeypatch.setattr(image_validation, "run_in_threadpool", fake_run_in_threadpool)

    result = asyncio.run(image_validation.validate_upload_file(upload))
    asyncio.run(upload.close())

    assert result.format == "PNG"
    assert calls == [
        (
            image_validation.validate_image_bytes,
            (content, "image/png", image_validation.settings.image_max_pixels),
        ),
    ]
