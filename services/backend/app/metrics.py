"""Prometheus-compatible metrics endpoint."""
import time
import psutil
from fastapi import APIRouter

router = APIRouter()

_start_time = time.time()


@router.get("/metrics")
async def metrics():
    """Prometheus-compatible metrics."""
    proc = psutil.Process()
    mem = proc.memory_info()
    return {
        "uptime_seconds": int(time.time() - _start_time),
        "memory_rss_mb": round(mem.rss / 1024 / 1024, 1),
        "memory_vms_mb": round(mem.vms / 1024 / 1024, 1),
        "cpu_percent": proc.cpu_percent(interval=0.1),
        "threads": proc.num_threads(),
    }
