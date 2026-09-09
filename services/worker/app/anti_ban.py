"""
Anti-ban system for VK and Telegram actions.
Rate limiting, account rotation, cooldowns, and warmup.
"""

import asyncio
import json
import random
import time
from typing import Optional

import redis.asyncio as aioredis


class RateLimiter:
    """Token-bucket rate limiter backed by Redis."""

    def __init__(self, redis_url: str):
        self.redis_url = redis_url
        self._redis: Optional[aioredis.Redis] = None

    async def _get_redis(self) -> aioredis.Redis:
        if self._redis is None:
            self._redis = aioredis.from_url(self.redis_url, decode_responses=True)
        return self._redis

    async def is_allowed(self, account_id: str, action_type: str, limits: dict) -> bool:
        """Check if an action is allowed for this account."""
        r = await self._get_redis()
        now = int(time.time())

        hourly_key = f"rate:{account_id}:{action_type}:hourly"
        daily_key = f"rate:{account_id}:{action_type}:daily"

        pipe = r.pipeline()
        pipe.incr(hourly_key)
        pipe.expire(hourly_key, 3600)
        pipe.incr(daily_key)
        pipe.expire(daily_key, 86400)
        results = await pipe.execute()

        hourly_count = results[0]
        daily_count = results[2]

        max_per_hour = limits.get("max_per_hour", 30)
        max_per_day = limits.get("max_per_day", 300)

        if hourly_count > max_per_hour or daily_count > max_per_day:
            # Revert the increment
            pipe2 = r.pipeline()
            pipe2.decr(hourly_key)
            pipe2.decr(daily_key)
            await pipe2.execute()
            return False

        return True

    async def wait_if_needed(self, account_id: str, action_type: str, limits: dict) -> float:
        """Wait until an action is allowed. Returns the wait time in seconds."""
        r = await self._get_redis()
        wait_key = f"rate:{account_id}:{action_type}:wait_until"
        wait_until = await r.get(wait_key)
        if wait_until:
            wait_time = float(wait_until) - time.time()
            if wait_time > 0:
                await asyncio.sleep(wait_time)
                return wait_time
        return 0

    def random_delay(self, min_sec: int = 15, max_sec: int = 45) -> float:
        """Generate a random delay between actions."""
        return random.uniform(min_sec, max_sec)

    async def record_action(self, account_id: str, action_type: str, config: dict) -> None:
        """Record an action and set next-available timestamp."""
        r = await self._get_redis()
        delay = self.random_delay(
            config.get("min_delay", 15),
            config.get("max_delay", 45)
        )
        next_available = time.time() + delay
        await r.set(f"rate:{account_id}:{action_type}:wait_until", str(next_available), ex=3600)

    async def get_counts(self, account_id: str, action_type: str) -> dict:
        """Get current hourly and daily counts."""
        r = await self._get_redis()
        hourly = await r.get(f"rate:{account_id}:{action_type}:hourly") or 0
        daily = await r.get(f"rate:{account_id}:{action_type}:daily") or 0
        return {"hourly": int(hourly), "daily": int(daily)}

    async def close(self):
        if self._redis:
            await self._redis.close()
            self._redis = None


class AccountRotation:
    """Round-robin account selection with ban detection."""

    def __init__(self, redis_url: str):
        self.redis_url = redis_url
        self._redis: Optional[aioredis.Redis] = None

    async def _get_redis(self) -> aioredis.Redis:
        if self._redis is None:
            self._redis = aioredis.from_url(self.redis_url, decode_responses=True)
        return self._redis

    async def select_accounts(self, tenant_id: str, platform: str, count: int = 1) -> list[str]:
        """Select `count` accounts for the tenant, round-robin."""
        r = await self._get_redis()
        key = f"rotation:{tenant_id}:{platform}:index"
        idx = int(await r.get(key) or 0)

        accounts_key = f"rotation:{tenant_id}:{platform}:accounts"
        accounts = await r.smembers(accounts_key)
        if not accounts:
            return []

        # Filter out banned accounts
        active = []
        for acc_id in accounts:
            ban_key = f"ban:{acc_id}"
            banned_until = await r.get(ban_key)
            if banned_until and float(banned_until) > time.time():
                continue
            active.append(acc_id)

        if not active:
            return []

        selected = []
        for _ in range(min(count, len(active))):
            selected.append(active[idx % len(active)])
            idx += 1

        await r.set(key, str(idx % len(active)))
        return selected

    async def register_account(self, tenant_id: str, platform: str, account_id: str) -> None:
        """Register an account for rotation."""
        r = await self._get_redis()
        await r.sadd(f"rotation:{tenant_id}:{platform}:accounts", account_id)

    async def ban_account(self, account_id: str, duration_hours: int = 24) -> None:
        """Temporarily ban an account."""
        r = await self._get_redis()
        banned_until = time.time() + (duration_hours * 3600)
        await r.set(f"ban:{account_id}", str(banned_until), ex=duration_hours * 3600)

    async def is_banned(self, account_id: str) -> bool:
        """Check if an account is currently banned."""
        r = await self._get_redis()
        banned_until = await r.get(f"ban:{account_id}")
        if banned_until and float(banned_until) > time.time():
            return True
        return False

    async def close(self):
        if self._redis:
            await self._redis.close()
            self._redis = None


class WarmupManager:
    """Manage account warmup stages."""

    def __init__(self, redis_url: str):
        self.redis_url = redis_url
        self._redis: Optional[aioredis.Redis] = None

    async def _get_redis(self) -> aioredis.Redis:
        if self._redis is None:
            self._redis = aioredis.from_url(self.redis_url, decode_responses=True)
        return self._redis

    async def get_stage(self, account_id: str) -> int:
        """Get current warmup stage (0 = not started, 1-3 = warming up, 4 = fully warmed up)."""
        r = await self._get_redis()
        stage = await r.get(f"warmup:{account_id}:stage")
        return int(stage) if stage else 0

    async def get_daily_limit(self, account_id: str, config: dict) -> int:
        """Get the daily action limit based on warmup stage."""
        stage = await self.get_stage(account_id)
        if stage >= 4:
            return config.get("max_actions_per_day", 300)

        warmup_limits = {
            0: config.get("warmup_day1_actions", 5),
            1: config.get("warmup_day1_actions", 5),
            2: config.get("warmup_day2_actions", 15),
            3: config.get("warmup_day3_actions", 30),
        }
        return warmup_limits.get(stage, 30)

    async def advance_stage(self, account_id: str, max_stages: int = 3) -> int:
        """Advance to the next warmup stage. Returns the new stage."""
        r = await self._get_redis()
        stage = await self.get_stage(account_id)
        if stage < max_stages + 1:
            new_stage = stage + 1
            await r.set(f"warmup:{account_id}:stage", str(new_stage))
            return new_stage
        return stage

    async def should_advance(self, account_id: str) -> bool:
        """Check if 24h have passed since last advance."""
        r = await self._get_redis()
        last_advance = await r.get(f"warmup:{account_id}:last_advance")
        if not last_advance:
            return True
        elapsed = time.time() - float(last_advance)
        return elapsed >= 86400

    async def record_advance(self, account_id: str) -> None:
        """Record that an advance happened."""
        r = await self._get_redis()
        await r.set(f"warmup:{account_id}:last_advance", str(time.time()))

    async def close(self):
        if self._redis:
            await self._redis.close()
            self._redis = None


# Singleton instances
_rate_limiter: Optional[RateLimiter] = None
_account_rotation: Optional[AccountRotation] = None
_warmup_manager: Optional[WarmupManager] = None


def get_rate_limiter(redis_url: str) -> RateLimiter:
    global _rate_limiter
    if _rate_limiter is None:
        _rate_limiter = RateLimiter(redis_url)
    return _rate_limiter


def get_account_rotation(redis_url: str) -> AccountRotation:
    global _account_rotation
    if _account_rotation is None:
        _account_rotation = AccountRotation(redis_url)
    return _account_rotation


def get_warmup_manager(redis_url: str) -> WarmupManager:
    global _warmup_manager
    if _warmup_manager is None:
        _warmup_manager = WarmupManager(redis_url)
    return _warmup_manager
