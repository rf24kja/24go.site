import unittest
from datetime import datetime,timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock,MagicMock
import httpx
from fastapi import FastAPI
from app.main import app as original
from app.database import get_db

class PublicDates(unittest.IsolatedAsyncioTestCase):
    async def test_public_list_includes_actual_update_time_and_null_without_auth(self):
        app=FastAPI();app.router.routes.extend(original.routes)
        created=datetime(2026,1,1,tzinfo=timezone.utc)
        for update in [datetime(2026,2,1,tzinfo=timezone.utc),None]:
            for locale in ['en','ru']:
                post=SimpleNamespace(slug='fixture',title_ru='Тест',title_en='Test',excerpt_ru='Тест',excerpt_en='Test',content_ru='Тест',content_en='Test',tags=[],og_image_url=None,created_at=created,updated_at=update)
                count=MagicMock();count.scalar.return_value=1
                rows=MagicMock();rows.scalars.return_value.all.return_value=[post]
                db=SimpleNamespace(execute=AsyncMock(side_effect=[count,rows]))
                async def fixture():yield db
                original.dependency_overrides[get_db]=fixture;app.dependency_overrides[get_db]=fixture
                async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app),base_url='http://fixture.invalid') as client:
                    response=await client.get('/api/v1/blog?locale='+locale)
                self.assertEqual(response.status_code,200,response.text)
                item=response.json()['items'][0]
                self.assertIn('updated_at',item)
                self.assertEqual(item['updated_at'],update.isoformat() if update else None)
                self.assertEqual(item['created_at'],created.isoformat())
        original.dependency_overrides.clear()

if __name__=='__main__':unittest.main(verbosity=2)
