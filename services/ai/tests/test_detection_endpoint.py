from dataclasses import dataclass
from io import BytesIO

from fastapi import status
from fastapi.testclient import TestClient
from PIL import Image
import pytest

from app.api.routes import detection as detection_route
from app.main import app
from app.services.yolo_detection import (
    BoundingBoxResult,
    Detection,
    DetectionResult,
    DetectionServiceError,
    get_object_detector,
)


def make_jpeg() -> bytes:
    output = BytesIO()
    Image.new("RGB", (12, 8), color=(107, 18, 32)).save(output, format="JPEG")
    return output.getvalue()


@dataclass
class FakeDetector:
    result: DetectionResult
    calls: int = 0

    def detect(self, image):
        self.calls += 1
        return self.result


def client_with_detector(detector) -> TestClient:
    app.dependency_overrides[get_object_detector] = lambda: detector
    return TestClient(app)


def teardown_function() -> None:
    app.dependency_overrides.clear()


def detection_result(detections: list[Detection] | None = None) -> DetectionResult:
    detections = detections if detections is not None else [
        Detection(
            class_id=39,
            label="bottle",
            confidence=0.9234,
            bbox=BoundingBoxResult(x1=1.0, y1=2.0, x2=9.0, y2=7.0),
            suggested_category="Botol & Wadah",
        ),
    ]

    return DetectionResult(
        model="yolo26n.pt",
        image_width=12,
        image_height=8,
        detections=detections,
        suggested_category=detections[0].suggested_category if detections else None,
        inference_ms=12.34,
    )


def test_valid_image_returns_detection_contract() -> None:
    detector = FakeDetector(detection_result())
    client = client_with_detector(detector)

    response = client.post(
        "/api/v1/images/detect",
        files={"file": ("upload.jpg", make_jpeg(), "image/jpeg")},
    )

    assert response.status_code == 200
    assert response.json() == {
        "model": "yolo26n.pt",
        "image": {"width": 12, "height": 8},
        "detections": [
            {
                "class_id": 39,
                "label": "bottle",
                "confidence": 0.9234,
                "bbox": {"x1": 1.0, "y1": 2.0, "x2": 9.0, "y2": 7.0},
                "suggested_category": "Botol & Wadah",
            },
        ],
        "suggested_category": "Botol & Wadah",
        "inference_ms": 12.34,
    }
    assert detector.calls == 1


def test_empty_detections_return_200_with_null_category() -> None:
    detector = FakeDetector(detection_result([]))
    client = client_with_detector(detector)

    response = client.post(
        "/api/v1/images/detect",
        files={"file": ("upload.jpg", make_jpeg(), "image/jpeg")},
    )

    assert response.status_code == 200
    assert response.json()["detections"] == []
    assert response.json()["suggested_category"] is None


def test_validation_failure_preserved_and_detector_not_called() -> None:
    detector = FakeDetector(detection_result())
    client = client_with_detector(detector)

    response = client.post(
        "/api/v1/images/detect",
        files={"file": ("upload.jpg", b"not an image", "image/jpeg")},
    )

    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "INVALID_IMAGE"
    assert detector.calls == 0


def test_model_unavailable_error_returns_safe_503() -> None:
    class UnavailableDetector:
        def detect(self, image):
            raise DetectionServiceError(
                "DETECTION_MODEL_UNAVAILABLE",
                "Model deteksi belum dapat digunakan.",
                status.HTTP_503_SERVICE_UNAVAILABLE,
            )

    client = client_with_detector(UnavailableDetector())

    response = client.post(
        "/api/v1/images/detect",
        files={"file": ("upload.jpg", make_jpeg(), "image/jpeg")},
    )

    assert response.status_code == 503
    assert response.json()["detail"] == {
        "code": "DETECTION_MODEL_UNAVAILABLE",
        "message": "Model deteksi belum dapat digunakan.",
    }


def test_detection_route_uses_threadpool_boundary(monkeypatch: pytest.MonkeyPatch) -> None:
    detector = FakeDetector(detection_result())
    calls: list[object] = []

    async def fake_run_in_threadpool(function, *args):
        calls.append(function)
        return function(*args)

    monkeypatch.setattr(detection_route, "run_in_threadpool", fake_run_in_threadpool)
    client = client_with_detector(detector)

    response = client.post(
        "/api/v1/images/detect",
        files={"file": ("upload.jpg", make_jpeg(), "image/jpeg")},
    )

    assert response.status_code == 200
    assert calls == [detector.detect]
