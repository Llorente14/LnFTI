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
