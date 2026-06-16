from typing import Literal

from pydantic import BaseModel, ConfigDict


class ImageValidationResponse(BaseModel):
    valid: Literal[True]
    media_type: str
    format: str
    width: int
    height: int
    size_bytes: int

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "valid": True,
                    "media_type": "image/jpeg",
                    "format": "JPEG",
                    "width": 1200,
                    "height": 900,
                    "size_bytes": 245812,
                },
            ],
        },
    )


class BoundingBox(BaseModel):
    x1: float
    y1: float
    x2: float
    y2: float


class ObjectDetection(BaseModel):
    class_id: int
    label: str
    confidence: float
    bbox: BoundingBox
    suggested_category: str | None


class DetectionImageInfo(BaseModel):
    width: int
    height: int


class ImageDetectionResponse(BaseModel):
    model: str
    image: DetectionImageInfo
    detections: list[ObjectDetection]
    suggested_category: str | None
    inference_ms: float

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "model": "yolo26n.pt",
                    "image": {
                        "width": 1280,
                        "height": 720,
                    },
                    "detections": [
                        {
                            "class_id": 39,
                            "label": "bottle",
                            "confidence": 0.9234,
                            "bbox": {
                                "x1": 120.5,
                                "y1": 80.25,
                                "x2": 542.75,
                                "y2": 690.0,
                            },
                            "suggested_category": "Botol & Wadah",
                        },
                    ],
                    "suggested_category": "Botol & Wadah",
                    "inference_ms": 68.42,
                },
            ],
        },
    )
