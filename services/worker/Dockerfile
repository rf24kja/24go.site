# ponytail: official Playwright image — browsers + OS deps baked.
# `playwright install --with-deps` on python:slim misdetects the distro
# (bookworm) and dies on ubuntu20.04-only font packages.
FROM mcr.microsoft.com/playwright/python:v1.49.1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends gcc libpq-dev && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["celery", "-A", "app.celery_app:celery", "worker", "-l", "info", "-Q", "default,parser,poster,warmup"]
