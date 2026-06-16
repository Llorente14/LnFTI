import os

from starlette.testclient import TestClient

TEST_AI_INTERNAL_API_TOKEN = "test_internal_ai_token_32_chars_ok"
AUTH_HEADERS = {"Authorization": f"Bearer {TEST_AI_INTERNAL_API_TOKEN}"}

# Settings are created while test modules import the FastAPI app.
os.environ.setdefault("AI_INTERNAL_API_TOKEN", TEST_AI_INTERNAL_API_TOKEN)

# Existing endpoint tests predate the internal service boundary. Give their
# TestClient instances the valid service header by default; dedicated auth
# tests explicitly override it with an empty or invalid value.
_original_test_client_init = TestClient.__init__


def _authenticated_test_client_init(self, *args, **kwargs):
    headers = dict(kwargs.pop("headers", {}) or {})
    headers.setdefault("Authorization", AUTH_HEADERS["Authorization"])
    _original_test_client_init(self, *args, headers=headers, **kwargs)


TestClient.__init__ = _authenticated_test_client_init
