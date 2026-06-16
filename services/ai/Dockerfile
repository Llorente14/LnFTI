FROM python:3.12.8-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    HOME=/home/user \
    HF_HOME=/home/user/.cache/huggingface \
    XDG_CACHE_HOME=/home/user/.cache \
    ULTRALYTICS_CONFIG_DIR=/home/user/.config/Ultralytics \
    PADDLE_HOME=/home/user/.cache/paddle \
    PADDLEOCR_HOME=/home/user/.cache/paddleocr

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
      libgomp1 \
      libglib2.0-0 \
      libgl1 \
      libsm6 \
      libxext6 \
      libxrender1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN python -m pip install --no-cache-dir --upgrade pip \
    && python -m pip install --no-cache-dir -r requirements.txt \
    && python -m pip check

RUN useradd --create-home --shell /usr/sbin/nologin user \
    && mkdir -p "$HF_HOME" "$ULTRALYTICS_CONFIG_DIR" "$PADDLE_HOME" "$PADDLEOCR_HOME" /tmp/lnfti-ai \
    && chown -R user:user /app /home/user /tmp/lnfti-ai

COPY --chown=user:user app ./app

USER user
EXPOSE 7860

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:7860/api/v1/health', timeout=3).read()"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7860", "--workers", "1", "--proxy-headers", "--forwarded-allow-ips=*"]
