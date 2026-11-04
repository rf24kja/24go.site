"""Offline regression against the complete product function; no provider traffic."""
import asyncio
import importlib.util
import pathlib
import sys
import types
import unittest
from unittest.mock import patch

ROOT = pathlib.Path(__file__).parent

class AIReplyTimeoutTest(unittest.TestCase):
    def test_ai_reply_reaches_http_and_returns_text(self):
        target = pathlib.Path(sys.argv[1])
        spec = importlib.util.spec_from_file_location("tested_auto_reply", target)
        module = importlib.util.module_from_spec(spec)
        redis_stub = types.ModuleType("redis")
        redis_stub.__path__ = []
        async_stub = types.ModuleType("redis.asyncio")
        with patch.dict(sys.modules, {"redis": redis_stub, "redis.asyncio": async_stub}):
            spec.loader.exec_module(module)
        calls = []
        class Response:
            def raise_for_status(self):
                pass
            def json(self):
                return {"choices": [{"message": {"content": "Test reply"}}]}
        class Client:
            def __init__(self, **kwargs):
                calls.append(kwargs["timeout"])
            async def __aenter__(self):
                return self
            async def __aexit__(self, *args):
                return False
            async def post(self, *args, **kwargs):
                return Response()
        with patch.object(module.httpx, "AsyncClient", Client):
            result = asyncio.run(module._generate_ai_reply("synthetic", "reply", {"llm_api_key": "synthetic-not-a-key"}))
        self.assertEqual(result, "Test reply")
        self.assertEqual(len(calls), 1)
        self.assertEqual(calls[0].connect, 5)
        self.assertEqual(calls[0].read, 20)

if __name__ == "__main__":
    unittest.main(argv=[sys.argv[0]])
