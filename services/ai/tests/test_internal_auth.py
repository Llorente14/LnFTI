from dataclasses import dataclass
from io import BytesIO

import pytest
from fastapi.testclient import TestClient
from PIL import Image
from pydantic import ValidationError

from app.core import auth as auth_module
from app.core.config import Settings
from app.main import app
from app.services.paddle_ocr import OcrResult, get_text_extractor
from app.services.yolo_detection import DetectionResult, get_object_detector
from tests.conftest import AUTH_HEADERS, TEST_AI_INTERNAL_API_TOKEN

BAD_HEADERS = {"Authorization": "Bearer wrong-token"}
MISSING_HEADERS = {"Authorization": ""}
LOWERCASE_HEADERS = {"Authorization": f"bearer {TEST_AI_INTERNAL_API_TOKEN}"}


def make_jpeg() -> bytes:
    output = BytesIO()
    Image.new("RGB", (12, 8), color=(107, 18, 32)).save(output, format="JPEG")
    return output.getvalue()


@dataclass
class FakeDetector:
    calls: int = 0

    def detect(self, image):
        self.calls += 1
        return DetectionResult(
            model="yolo26n.pt",
            image_width=12,
            image_height=8,
            detections=[],
            suggested_category=None,
            inference_ms=1.23,
        )


@dataclass
class FakeExtractor:
    calls: int = 0

    def extract(self, image):
        self.calls += 1
        return OcrResult(
            engine="PP-OCRv5-mobile",
            language="en",
            image_width=12,
            image_height=8,
            lines=[],
            full_text="",
            average_confidence=None,
            inference_ms=1.23,
        )


def teardown_function() -> None:
    app.dependency_overrides.clear()


def test_health_remains_public_without_bearer_token() -> None:
    response = TestClient(app).get("/api/v1/health", headers=MISSING_HEADERS)
    assert response.status_code == 200


def test_image_validation_rejects_missing_token() -> None:
    response = TestClient(app).post(
        "/api/v1/images/validate",
        files={"file": ("upload.jpg", make_jpeg(), "image/jpeg")},
        headers=MISSING_HEADERS,
    )
    assert response.status_code == 401
    assert response.json()["detail"]["code"] == "UNAUTHORIZED_AI_REQUEST"


def test_detection_and_ocr_reject_invalid_token() -> None:
    client = TestClient(app)
    for path in ("/api/v1/images/detect", "/api/v1/images/ocr"):
        response = client.post(
            path,
            files={"file": ("upload.jpg", make_jpeg(), "image/jpeg")},
            headers=BAD_HEADERS,
        )
        assert response.status_code == 401
        assert response.json()["detail"]["code"] == "UNAUTHORIZED_AI_REQUEST"


def test_image_endpoint_fails_closed_when_token_unconfigured(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(auth_module.settings, "ai_internal_api_token", None)
    response = TestClient(app).post(
        "/api/v1/images/validate",
        files={"file": ("upload.jpg", make_jpeg(), "image/jpeg")},
        headers=AUTH_HEADERS,
    )
    assert response.status_code == 503
    assert response.json()["detail"]["code"] == "AI_AUTH_UNCONFIGURED"


def test_bearer_scheme_is_case_insensitive() -> None:
    response = TestClient(app).post(
        "/api/v1/images/validate",
        files={"file": ("upload.jpg", make_jpeg(), "image/jpeg")},
        headers=LOWERCASE_HEADERS,
    )
    assert response.status_code == 200


def test_correct_token_reaches_detection_and_ocr() -> None:
    detector = FakeDetector()
    extractor = FakeExtractor()
    app.dependency_overrides[get_object_detector] = lambda: detector
    app.dependency_overrides[get_text_extractor] = lambda: extractor
    client = TestClient(app)

    detection_response = client.post(
        "/api/v1/images/detect",
        files={"file": ("upload.jpg", make_jpeg(), "image/jpeg")},
        headers=AUTH_HEADERS,
    )
    ocr_response = client.post(
        "/api/v1/images/ocr",
        files={"file": ("upload.jpg", make_jpeg(), "image/jpeg")},
        headers=AUTH_HEADERS,
    )

    assert detection_response.status_code == 200
    assert ocr_response.status_code == 200
    assert detector.calls == 1
    assert extractor.calls == 1


def test_known_example_token_is_rejected_by_settings() -> None:
    with pytest.raises(ValidationError, match="generated secret"):
        Settings(ai_internal_api_token="replace_with_at_least_32_random_characters")
