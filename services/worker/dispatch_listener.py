import os, sys
sys.path.insert(0, "/app")
from celery_app import celery

result = celery.send_task(
    "app.tasks.listener.start_lead_listener",
    args=["2459d2f2-3e55-4869-9646-78b0a22f5c67", "5b2ccdb1-b169-49f0-b0b4-db62f43c198d"],
    queue="listener",
)
print(f"Dispatched task: {result.id}")
