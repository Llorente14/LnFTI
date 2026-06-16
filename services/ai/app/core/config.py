from functools import lru_cache
from typing import Annotated

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

SUPPORTED_IMAGE_MEDIA_TYPES = frozenset({"image/jpeg", "image/png", "image/webp"})
INSECURE_AI_TOKEN_PLACEHOLDERS = frozenset({"replace_with_at_least_32_random_characters"})


class Settings(BaseSettings):
    app_name: str = "LnFTI AI Service"
    app_version: str = "0.1.0"
    environment: str = "development"
    api_prefix: str = "/api/v1"
    ai_internal_api_token: SecretStr | None = None
    allowed_origins: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        ],
    )
    image_max_bytes: int = Field(default=5 * 1024 * 1024, gt=0)
    image_max_pixels: int = Field(default=40_000_000, gt=0)
    image_allowed_media_types: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: ["image/jpeg", "image/png", "image/webp"],
    )
    yolo_model_path: str = Field(default="yolo26n.pt", min_length=1)
    yolo_device: str = Field(default="cpu", min_length=1)
    yolo_confidence_threshold: float = Field(default=0.25, gt=0, le=1)
    yolo_iou_threshold: float = Field(default=0.70, gt=0, le=1)
    yolo_image_size: int = Field(default=640, ge=320, le=1280)
    yolo_max_detections: int = Field(default=20, ge=1, le=100)
    ocr_language: str = Field(default="en", min_length=1)
    ocr_device: str = Field(default="cpu", min_length=1)
    ocr_min_confidence: float = Field(default=0.50, ge=0, le=1)
    ocr_max_lines: int = Field(default=30, ge=1, le=100)
    ocr_max_text_chars: int = Field(default=2000, ge=100, le=10_000)
    ocr_text_detection_model: str = Field(default="PP-OCRv5_mobile_det", min_length=1)
    ocr_text_recognition_model: str = Field(default="PP-OCRv5_mobile_rec", min_length=1)

    model_config = SettingsConfigDict(env_prefix="", case_sensitive=False)

    @field_validator("ai_internal_api_token")
    @classmethod
    def validate_ai_internal_api_token(cls, value: SecretStr | None) -> SecretStr | None:
        if value is None:
            return None

        token = value.get_secret_value().strip()
        if len(token) < 32:
            raise ValueError("AI_INTERNAL_API_TOKEN must be at least 32 characters.")
        if token in INSECURE_AI_TOKEN_PLACEHOLDERS:
            raise ValueError("AI_INTERNAL_API_TOKEN must be a generated secret, not an example placeholder.")
        return SecretStr(token)

    @field_validator("allowed_origins", mode="before")
    @classmethod
    def parse_allowed_origins(cls, value: object) -> object:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @field_validator("image_allowed_media_types", mode="before")
    @classmethod
    def parse_image_allowed_media_types(cls, value: object) -> object:
        if isinstance(value, str):
            return [media_type.strip().lower() for media_type in value.split(",") if media_type.strip()]
        return value

    @field_validator("image_allowed_media_types")
    @classmethod
    def validate_image_allowed_media_types(cls, value: list[str]) -> list[str]:
        normalized = [media_type.strip().lower() for media_type in value if media_type.strip()]
        if not normalized:
            raise ValueError("IMAGE_ALLOWED_MEDIA_TYPES must include at least one media type.")
        unsupported = sorted(set(normalized) - SUPPORTED_IMAGE_MEDIA_TYPES)
        if unsupported:
            raise ValueError(
                "IMAGE_ALLOWED_MEDIA_TYPES contains unsupported values: "
                + ", ".join(unsupported),
            )
        return normalized

    @field_validator("yolo_model_path", "yolo_device")
    @classmethod
    def validate_non_empty_yolo_string(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("YOLO configuration value must not be empty.")
        return trimmed

    @field_validator(
        "ocr_language",
        "ocr_device",
        "ocr_text_detection_model",
        "ocr_text_recognition_model",
    )
    @classmethod
    def validate_non_empty_ocr_string(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("OCR configuration value must not be empty.")
        return trimmed

    @field_validator("yolo_image_size")
    @classmethod
    def validate_yolo_image_size_stride(cls, value: int) -> int:
        if value % 32 != 0:
            raise ValueError("YOLO_IMAGE_SIZE must be divisible by 32.")
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
