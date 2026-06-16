from dataclasses import dataclass
from io import BytesIO
from math import isfinite
import re
from threading import Lock
from time import perf_counter
from typing import Protocol

import numpy as np
from fastapi import status
from PIL import Image, ImageOps

from app.core.config import Settings, settings
from app.services.image_validation import ValidatedImage

OCR_ENGINE_NAME = "PP-OCRv5-mobile"
WHITESPACE_RE = re.compile(r"\s+")


@dataclass(frozen=True)
class OcrLine:
    text: str
    confidence: float


@dataclass(frozen=True)
class OcrResult:
    engine: str
    language: str
    image_width: int
    image_height: int
    lines: list[OcrLine]
    full_text: str
    average_confidence: float | None
    inference_ms: float
    truncated: bool = False


class TextExtractor(Protocol):
    def extract(self, image: ValidatedImage) -> OcrResult:
        ...


class OcrServiceError(Exception):
    def __init__(self, code: str, message: str, status_code: int) -> None:
        super().__init__(code)
        self.code = code
        self.message = message
        self.status_code = status_code

    @property
    def detail(self) -> dict[str, str]:
        return {"code": self.code, "message": self.message}


class PaddleOcrTextExtractor:
    def __init__(self, app_settings: Settings = settings, pipeline_factory=None) -> None:
        self._settings = app_settings
        self._pipeline_factory = pipeline_factory
        self._pipeline = None
        self._lock = Lock()

    def extract(self, image: ValidatedImage) -> OcrResult:
        prepared_image, image_width, image_height = prepare_image_array(image)

        try:
            with self._lock:
                pipeline = self._load_pipeline()
                start = perf_counter()
                raw_results = pipeline.predict(prepared_image)
                inference_ms = max(0.0, round((perf_counter() - start) * 1000, 2))
        except OcrServiceError:
            raise
        except Exception as exc:
            raise OcrServiceError(
                "OCR_FAILED",
                "Teks pada gambar belum dapat diproses.",
                status.HTTP_500_INTERNAL_SERVER_ERROR,
            ) from exc

        try:
            lines, full_text, average_confidence, truncated = normalize_ocr_results(
                raw_results,
                min_confidence=self._settings.ocr_min_confidence,
                max_lines=self._settings.ocr_max_lines,
                max_text_chars=self._settings.ocr_max_text_chars,
            )
        except Exception as exc:
            raise OcrServiceError(
                "INVALID_OCR_RESULT",
                "Teks pada gambar belum dapat diproses.",
                status.HTTP_500_INTERNAL_SERVER_ERROR,
            ) from exc

        return OcrResult(
            engine=OCR_ENGINE_NAME,
            language=self._settings.ocr_language,
            image_width=image_width,
            image_height=image_height,
            lines=lines,
            full_text=full_text,
            average_confidence=average_confidence,
            inference_ms=inference_ms,
            truncated=truncated,
        )

    def _load_pipeline(self):
        if self._pipeline is not None:
            return self._pipeline

        try:
            factory = self._pipeline_factory
            if factory is None:
                from paddleocr import PaddleOCR

                factory = PaddleOCR

            self._pipeline = factory(
                lang=self._settings.ocr_language,
                device=self._settings.ocr_device,
                text_detection_model_name=self._settings.ocr_text_detection_model,
                text_recognition_model_name=self._settings.ocr_text_recognition_model,
                use_doc_orientation_classify=False,
                use_doc_unwarping=False,
                use_textline_orientation=False,
            )
        except Exception as exc:
            raise OcrServiceError(
                "OCR_MODEL_UNAVAILABLE",
                "Model OCR belum dapat digunakan.",
                status.HTTP_503_SERVICE_UNAVAILABLE,
            ) from exc

        return self._pipeline


def prepare_image_array(image: ValidatedImage) -> tuple[np.ndarray, int, int]:
    try:
        with BytesIO(image.content) as stream:
            with Image.open(stream) as opened:
                with ImageOps.exif_transpose(opened).convert("RGB") as prepared:
                    image_array = np.array(prepared)
                    return image_array, prepared.width, prepared.height
    except Exception as exc:
        raise OcrServiceError(
            "OCR_FAILED",
            "Teks pada gambar belum dapat diproses.",
            status.HTTP_500_INTERNAL_SERVER_ERROR,
        ) from exc


def normalize_ocr_results(
    results: object,
    min_confidence: float,
    max_lines: int,
    max_text_chars: int,
) -> tuple[list[OcrLine], str, float | None, bool]:
    first_result = first_or_none(results)
    if first_result is None:
        return [], "", None, False

    result = result_payload(first_result)
    if "rec_texts" not in result or "rec_scores" not in result:
        raise ValueError("OCR result is missing recognition fields.")

    texts = to_list(result.get("rec_texts", []))
    scores = to_list(result.get("rec_scores", []))

    lines: list[OcrLine] = []
    full_text_parts: list[str] = []
    total_chars = 0
    truncated = len(texts) != len(scores)

    for text_value, score_value in zip(texts, scores, strict=False):
        normalized_text = normalize_text(text_value)
        confidence = normalize_confidence(score_value)

        if normalized_text is None or confidence is None or confidence < min_confidence:
            continue

        if len(lines) >= max_lines:
            truncated = True
            break

        separator_chars = 1 if full_text_parts else 0
        remaining_chars = max_text_chars - total_chars - separator_chars
        if remaining_chars <= 0:
            truncated = True
            break

        line_text = normalized_text
        if len(line_text) > remaining_chars:
            line_text = line_text[:remaining_chars]
            truncated = True

        lines.append(OcrLine(text=line_text, confidence=round(confidence, 4)))
        full_text_parts.append(line_text)
        total_chars += separator_chars + len(line_text)

        if truncated:
            break

    full_text = "\n".join(full_text_parts)
    average_confidence = (
        round(sum(line.confidence for line in lines) / len(lines), 4)
        if lines
        else None
    )

    return lines, full_text, average_confidence, truncated


def result_payload(result: object | None) -> dict:
    if result is None:
        return {}
    if isinstance(result, dict):
        return result

    json_value = getattr(result, "json", None)
    if isinstance(json_value, dict):
        result = json_value.get("res", json_value)
        return result if isinstance(result, dict) else {}

    res_value = getattr(result, "res", None)
    if isinstance(res_value, dict):
        return res_value

    return {}


def normalize_text(value: object) -> str | None:
    if not isinstance(value, str):
        return None

    text = WHITESPACE_RE.sub(" ", value).strip()
    return text or None


def normalize_confidence(value: object) -> float | None:
    try:
        confidence = float(value)
    except (TypeError, ValueError):
        return None

    if not isfinite(confidence):
        return None

    return min(1.0, max(0.0, confidence))


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


text_extractor = PaddleOcrTextExtractor()


def get_text_extractor() -> TextExtractor:
    return text_extractor
