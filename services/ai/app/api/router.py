from fastapi import APIRouter

from app.api.routes import health, images

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(images.router, tags=["images"])
