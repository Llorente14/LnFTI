from dataclasses import dataclass
from io import BytesIO

from fastapi import status
from fastapi.testclient import TestClient
from PIL import Image
import pytest

from app.api.routes import ocr as ocr_route
from app.main import app
from app.services.paddle_ocr import (
    OcrLine,
    OcrResult,
    OcrServiceError,
    get_text_extractor,
    text_extractor,
)


def make_jpeg() -> bytes:
    output = BytesIO()
    Image.new("RGB", (12, 8), color=(107, 18, 32)).save(output, format="JPEG")
    return output.getvalue()


@dataclass
class FakeExtractor:
    result: OcrResult
    calls: int = 0

    def extract(self, image):
        self.calls += 1
        return self.result


def client_with_extractor(extractor) -> TestClient:
    app.dependency_overrides[get_text_extractor] = lambda: extractor
    return TestClient(app)


def teardown_function() -> None:
    app.dependency_overrides.clear()


def ocr_result(lines: list[OcrLine] | None = None) -> OcrResult:
    lines = lines if lines is not None else [
        OcrLine(text="LOGITECH", confidence=0.9624),
        OcrLine(text="M331", confidence=0.9186),
    ]
    full_text = "\n".join(line.text for line in lines)
    average_confidence = (
        round(sum(line.confidence for line in lines) / len(lines), 4)
        if lines
        else None
    )

    return OcrResult(
        engine="PP-OCRv5-mobile",
        language="en",
        image_width=12,
        image_height=8,
        lines=lines,
        full_text=full_text,
        average_confidence=average_confidence,
        inference_ms=12.34,
    )


def test_valid_image_returns_ocr_contract() -> None:
    extractor = FakeExtractor(ocr_result())
    client = client_with_extractor(extractor)

    response = client.post(
        "/api/v1/images/ocr",
        files={"file": ("upload.jpg", make_jpeg(), "image/jpeg")},
    )

    assert response.status_code == 200
    assert response.json() == {
        "engine": "PP-OCRv5-mobile",
        "language": "en",
        "image": {"width": 12, "height": 8},
        "lines": [
            {"text": "LOGITECH", "confidence": 0.9624},
            {"text": "M331", "confidence": 0.9186},
        ],
        "full_text": "LOGITECH\nM331",
        "average_confidence": 0.9405,
        "inference_ms": 12.34,
        "truncated": False,
    }
    assert extractor.calls == 1


def test_no_recognized_text_returns_200_with_null_average() -> None:
    extractor = FakeExtractor(ocr_result([]))
    client = client_with_extractor(extractor)

    response = client.post(
        "/api/v1/images/ocr",
        files={"file": ("upload.jpg", make_jpeg(), "image/jpeg")},
    )

    assert response.status_code == 200
    assert response.json()["lines"] == []
    assert response.json()["full_text"] == ""
    assert response.json()["average_confidence"] is None


def test_validation_failure_preserved_and_extractor_not_called() -> None:
    extractor = FakeExtractor(ocr_result())
    client = client_with_extractor(extractor)

    response = client.post(
        "/api/v1/images/ocr",
        files={"file": ("upload.jpg", b"not an image", "image/jpeg")},
    )

    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "INVALID_IMAGE"
    assert extractor.calls == 0


def test_model_unavailable_error_returns_safe_503() -> None:
    class UnavailableExtractor:
        def extract(self, image):
            raise OcrServiceError(
                "OCR_MODEL_UNAVAILABLE",
                "Model OCR belum dapat digunakan.",
                status.HTTP_503_SERVICE_UNAVAILABLE,
            )

    client = client_with_extractor(UnavailableExtractor())

    response = client.post(
        "/api/v1/images/ocr",
        files={"file": ("upload.jpg", make_jpeg(), "image/jpeg")},
    )

    assert response.status_code == 503
    assert response.json()["detail"] == {
        "code": "OCR_MODEL_UNAVAILABLE",
        "message": "Model OCR belum dapat digunakan.",
    }


def test_ocr_route_uses_threadpool_boundary(monkeypatch: pytest.MonkeyPatch) -> None:
    extractor = FakeExtractor(ocr_result())
    calls: list[object] = []

    async def fake_run_in_threadpool(function, *args):
        calls.append(function)
        return function(*args)

    monkeypatch.setattr(ocr_route, "run_in_threadpool", fake_run_in_threadpool)
    client = client_with_extractor(extractor)

    response = client.post(
        "/api/v1/images/ocr",
        files={"file": ("upload.jpg", make_jpeg(), "image/jpeg")},
    )

    assert response.status_code == 200
    assert calls == [extractor.extract]


def test_health_and_openapi_do_not_initialize_ocr_model() -> None:
    text_extractor._pipeline = None
    client = TestClient(app)

    health_response = client.get("/api/v1/health")
    openapi_response = client.get("/openapi.json")

    assert health_response.status_code == 200
    assert openapi_response.status_code == 200
    assert text_extractor._pipeline is None
