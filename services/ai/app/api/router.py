from fastapi import APIRouter

from app.api.routes import detection, health, images, ocr

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(images.router, tags=["images"])
api_router.include_router(detection.router, tags=["images"])
api_router.include_router(ocr.router, tags=["images"])
