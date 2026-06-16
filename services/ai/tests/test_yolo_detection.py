from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app
from app.core.config import Settings
from app.services.category_mapping import choose_top_category, map_yolo_label_to_lnfti_category
from app.services.yolo_detection import YoloObjectDetector, detector, normalize_yolo_results


class FakeBoxes:
    def __init__(self, class_ids, confidences, boxes) -> None:
        self.cls = class_ids
        self.conf = confidences
        self.xyxy = boxes


class FakeResult:
    def __init__(self, boxes: FakeBoxes, names: dict[int, str]) -> None:
        self.boxes = boxes
        self.names = names


def test_normalization_sorts_and_limits_detections() -> None:
    result = FakeResult(
        FakeBoxes(
            class_ids=[0, 1, 2],
            confidences=[0.3, 0.9, 0.6],
            boxes=[[1, 1, 3, 3], [2, 2, 4, 4], [3, 3, 5, 5]],
        ),
        {0: "book", 1: "laptop", 2: "bottle"},
    )

    detections = normalize_yolo_results([result], image_width=10, image_height=10, max_detections=2)

    assert [detection.label for detection in detections] == ["laptop", "bottle"]
    assert [detection.confidence for detection in detections] == [0.9, 0.6]


def test_normalization_clamps_boxes_and_rounds_values() -> None:
    result = FakeResult(
        FakeBoxes(
            class_ids=[39],
            confidences=[0.923456],
            boxes=[[-10.123, 1.234, 20.987, 8.765]],
        ),
        {39: "bottle"},
    )

    detection = normalize_yolo_results([result], image_width=12, image_height=8, max_detections=20)[0]

    assert detection.confidence == 0.9235
    assert detection.bbox.x1 == 0.0
    assert detection.bbox.y1 == 1.23
    assert detection.bbox.x2 == 12.0
    assert detection.bbox.y2 == 8.0


def test_normalization_skips_invalid_zero_area_boxes() -> None:
    result = FakeResult(
        FakeBoxes(
            class_ids=[0, 1],
            confidences=[0.8, 0.7],
            boxes=[[3, 3, 3, 4], [1, 1, 5, 5]],
        ),
        {0: "book", 1: "laptop"},
    )

    detections = normalize_yolo_results([result], image_width=10, image_height=10, max_detections=20)

    assert [detection.label for detection in detections] == ["laptop"]


def test_category_mapping_known_and_unknown_labels() -> None:
    assert map_yolo_label_to_lnfti_category("bottle") == "Botol & Wadah"
    assert map_yolo_label_to_lnfti_category("laptop") == "Elektronik"
    assert map_yolo_label_to_lnfti_category("person") is None


def test_top_category_uses_highest_confidence_mapped_detection() -> None:
    assert choose_top_category(["person", "laptop", "bottle"]) == "Elektronik"
    assert choose_top_category(["person", "chair"]) is None


def test_health_request_does_not_load_yolo_model() -> None:
    detector._model = None
    client = TestClient(app)

    response = client.get("/api/v1/health")

    assert response.status_code == 200
    assert detector._model is None


def test_model_name_hides_parent_directories() -> None:
    custom_detector = YoloObjectDetector(Settings(yolo_model_path=str(Path("models") / "private" / "custom.pt")))

    assert custom_detector.model_name == "custom.pt"
