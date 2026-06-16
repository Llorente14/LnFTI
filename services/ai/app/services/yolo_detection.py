from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
from threading import Lock
from time import perf_counter
from typing import Protocol

from fastapi import status
from PIL import Image, ImageOps

from app.core.config import Settings, settings
from app.services.category_mapping import choose_top_category, map_yolo_label_to_lnfti_category
from app.services.image_validation import ValidatedImage


@dataclass(frozen=True)
class BoundingBoxResult:
    x1: float
    y1: float
    x2: float
    y2: float


@dataclass(frozen=True)
class Detection:
    class_id: int
    label: str
    confidence: float
    bbox: BoundingBoxResult
    suggested_category: str | None


@dataclass(frozen=True)
class DetectionResult:
    model: str
    image_width: int
    image_height: int
    detections: list[Detection]
    suggested_category: str | None
    inference_ms: float


class ObjectDetector(Protocol):
    def detect(self, image: ValidatedImage) -> DetectionResult:
        ...


class DetectionServiceError(Exception):
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


class YoloObjectDetector:
    def __init__(self, app_settings: Settings = settings) -> None:
        self._settings = app_settings
        self._model = None
        self._lock = Lock()

    @property
    def model_name(self) -> str:
        return Path(self._settings.yolo_model_path).name

    def detect(self, image: ValidatedImage) -> DetectionResult:
        prepared_image, image_width, image_height = prepare_image(image)
        try:
            with prepared_image:
                with self._lock:
                    model = self._load_model()
                    start = perf_counter()
                    results = model.predict(
                        source=prepared_image,
                        conf=self._settings.yolo_confidence_threshold,
                        iou=self._settings.yolo_iou_threshold,
                        imgsz=self._settings.yolo_image_size,
                        device=self._settings.yolo_device,
                        max_det=self._settings.yolo_max_detections,
                        save=False,
                        verbose=False,
                    )
                    inference_ms = max(0.0, round((perf_counter() - start) * 1000, 2))
        except DetectionServiceError:
            raise
        except Exception as exc:
            raise DetectionServiceError(
                "DETECTION_FAILED",
                "Deteksi gambar belum dapat diproses.",
                status.HTTP_500_INTERNAL_SERVER_ERROR,
            ) from exc

        try:
            detections = normalize_yolo_results(
                results,
                image_width=image_width,
                image_height=image_height,
                max_detections=self._settings.yolo_max_detections,
            )
        except Exception as exc:
            raise DetectionServiceError(
                "INVALID_DETECTION_RESULT",
                "Deteksi gambar belum dapat diproses.",
                status.HTTP_500_INTERNAL_SERVER_ERROR,
            ) from exc

        return DetectionResult(
            model=self.model_name,
            image_width=image_width,
            image_height=image_height,
            detections=detections,
            suggested_category=choose_top_category([detection.label for detection in detections]),
            inference_ms=inference_ms,
        )

    def _load_model(self):
        if self._model is not None:
            return self._model

        try:
            from ultralytics import YOLO

            self._model = YOLO(self._settings.yolo_model_path)
        except Exception as exc:
            raise DetectionServiceError(
                "DETECTION_MODEL_UNAVAILABLE",
                "Model deteksi belum dapat digunakan.",
                status.HTTP_503_SERVICE_UNAVAILABLE,
            ) from exc

        return self._model


def prepare_image(image: ValidatedImage) -> tuple[Image.Image, int, int]:
    stream = BytesIO(image.content)
    try:
        with stream:
            with Image.open(stream) as opened:
                prepared = ImageOps.exif_transpose(opened).convert("RGB")
    except Exception as exc:
        raise DetectionServiceError(
            "DETECTION_FAILED",
            "Deteksi gambar belum dapat diproses.",
            status.HTTP_500_INTERNAL_SERVER_ERROR,
        ) from exc

    return prepared, prepared.width, prepared.height


def normalize_yolo_results(
    results: object,
    image_width: int,
    image_height: int,
    max_detections: int,
) -> list[Detection]:
    first_result = first_or_none(results)
    if first_result is None:
        return []

    boxes = getattr(first_result, "boxes", None)
    if boxes is None:
        return []

    class_ids = to_list(getattr(boxes, "cls", []))
    confidences = to_list(getattr(boxes, "conf", []))
    coordinates = to_list(getattr(boxes, "xyxy", []))
    names = getattr(first_result, "names", {}) or {}
    detections: list[Detection] = []

    for class_id_value, confidence_value, xyxy_value in zip(class_ids, confidences, coordinates, strict=False):
        class_id = int(number_value(class_id_value))
        confidence = min(1.0, max(0.0, float(number_value(confidence_value))))
        label = label_for_class(names, class_id)
        x1, y1, x2, y2 = clamp_box(to_list(xyxy_value), image_width, image_height)

        if x2 <= x1 or y2 <= y1:
            continue

        detections.append(
            Detection(
                class_id=class_id,
                label=label,
                confidence=round(confidence, 4),
                bbox=BoundingBoxResult(
                    x1=round(x1, 2),
                    y1=round(y1, 2),
                    x2=round(x2, 2),
                    y2=round(y2, 2),
                ),
                suggested_category=map_yolo_label_to_lnfti_category(label),
            ),
        )

    detections.sort(key=lambda detection: detection.confidence, reverse=True)
    return detections[:max_detections]


def first_or_none(results: object) -> object | None:
    values = to_list(results)
    return values[0] if values else None


def to_list(value: object) -> list:
    if value is None:
        return []
    if hasattr(value, "detach"):
        value = value.detach()
    if hasattr(value, "cpu"):
        value = value.cpu()
    if hasattr(value, "tolist"):
        return value.tolist()
    if isinstance(value, list):
        return value
    if isinstance(value, tuple):
        return list(value)
    return [value]


def number_value(value: object) -> float:
    if isinstance(value, list):
        return float(value[0])
    if isinstance(value, tuple):
        return float(value[0])
    if hasattr(value, "item"):
        return float(value.item())
    return float(value)


def label_for_class(names: object, class_id: int) -> str:
    if isinstance(names, dict):
        value = names.get(class_id, str(class_id))
        return str(value)
    if isinstance(names, list) and 0 <= class_id < len(names):
        return str(names[class_id])
    return str(class_id)


def clamp_box(values: list, image_width: int, image_height: int) -> tuple[float, float, float, float]:
    if len(values) < 4:
        return 0.0, 0.0, 0.0, 0.0

    x1 = min(float(image_width), max(0.0, float(number_value(values[0]))))
    y1 = min(float(image_height), max(0.0, float(number_value(values[1]))))
    x2 = min(float(image_width), max(0.0, float(number_value(values[2]))))
    y2 = min(float(image_height), max(0.0, float(number_value(values[3]))))

    return x1, y1, x2, y2


detector = YoloObjectDetector()


def get_object_detector() -> ObjectDetector:
    return detector
