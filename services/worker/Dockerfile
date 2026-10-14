FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends gcc libpq-dev && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ponytail: FB module needs headless Chromium (baked in — runtime download
# would stall cold starts and fail air-gapped deploys)
RUN python -m playwright install --with-deps chromium

COPY . .

CMD ["celery", "-A", "app.celery_app:celery", "worker", "-l", "info", "-Q", "default,parser,poster,warmup"]
