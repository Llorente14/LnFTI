from secrets import compare_digest

from fastapi import Header, HTTPException, status

from app.core.config import settings

UNAUTHORIZED_DETAIL = {
    "code": "UNAUTHORIZED_AI_REQUEST",
    "message": "Permintaan tidak diizinkan.",
}
UNAVAILABLE_DETAIL = {
    "code": "AI_AUTH_UNCONFIGURED",
    "message": "Autentikasi layanan AI belum dikonfigurasi.",
}


def configured_internal_token() -> str:
    token = settings.ai_internal_api_token
    if token is None:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=UNAVAILABLE_DETAIL)

    value = token.get_secret_value().strip()
    if len(value) < 32:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=UNAVAILABLE_DETAIL)

    return value


def require_internal_api_token(authorization: str | None = Header(default=None)) -> None:
    expected_token = configured_internal_token()

    if not authorization:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=UNAUTHORIZED_DETAIL)

    scheme, separator, credential = authorization.partition(" ")
    provided_token = credential.strip()
    if separator != " " or scheme.lower() != "bearer" or not provided_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=UNAUTHORIZED_DETAIL)

    if not compare_digest(provided_token, expected_token):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=UNAUTHORIZED_DETAIL)
