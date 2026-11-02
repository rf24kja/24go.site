import unittest, uuid
from unittest.mock import AsyncMock, patch
from sqlalchemy import select
from app.database import Base
from app.models import Contact, WaAccount, Campaign
import lead_fixture


class ContactBatch(lead_fixture.Fixture):
    async def asyncSetUp(self):
        await super().asyncSetUp()
        async with self.engine.begin() as conn:
            await conn.run_sync(lambda c: Base.metadata.create_all(c, tables=[Campaign.__table__, Contact.__table__, WaAccount.__table__]))
        self.contact_ids = [uuid.uuid4(), uuid.uuid4()]
        self.wa_ids = [uuid.uuid4(), uuid.uuid4()]
        for ti in range(2):
            self.session.add(Contact(id=self.contact_ids[ti], tenant_id=self.tenants[ti], phone=f'+1202555010{ti + 1}', has_tg=True, wa_jid='fixture@s.whatsapp.net', tags=['fixture', 'has_vk']))
            self.session.add(WaAccount(id=self.wa_ids[ti], tenant_id=self.tenants[ti], phone_number=f'+1202555020{ti + 1}', status='connected', is_active=True))
        await self.session.commit()
        self.tg = AsyncMock(return_value={'exists': None, 'error': 'fixture_unknown'})
        self.vk = AsyncMock(return_value={'exists': None, 'error': 'fixture_unknown'})
        self.wa = AsyncMock(return_value={'exists': None, 'wa_id': None, 'error': 'fixture_unknown'})
        self.patches = [patch('app.routers.contacts.' + name, value) for name, value in [('check_telegram', self.tg), ('check_vkontakte', self.vk), ('check_whatsapp', self.wa)]]
        for item in self.patches: item.start()

    async def asyncTearDown(self):
        for item in self.patches: item.stop()
        await super().asyncTearDown()

    async def test_repeated_contact_ids_count_once_and_keep_unknown_fields(self):
        own, foreign = self.contact_ids
        response = await self.client.post('/api/v1/contacts/refresh-platforms', headers=self.headers(), json={'contact_ids': [str(own), str(own).upper(), str(foreign), str(uuid.uuid4())]})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()['updated'], 1)
        for check in [self.tg, self.vk, self.wa]: self.assertEqual(check.await_count, 1)
        self.assertEqual(self.wa.await_args.args, ('+12025550101', str(self.wa_ids[0])))
        for ident in self.contact_ids:
            row = await self.session.get(Contact, ident)
            await self.session.refresh(row)
            self.assertTrue(row.has_tg)
            self.assertEqual(row.wa_jid, 'fixture@s.whatsapp.net')
            self.assertEqual(set(row.tags), {'fixture', 'has_vk'})

    async def test_normalized_phone_duplicates_share_checks_but_preserve_order(self):
        response = await self.client.post('/api/v1/contacts/check-platforms', headers=self.headers(), json={'phones': ['+12025550101', '1 (202) 555-0101', '+12025550102']})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual([row['phone'] for row in response.json()['results']], ['+12025550101', '+12025550101', '+12025550102'])
        for check in [self.tg, self.vk, self.wa]: self.assertEqual(check.await_count, 2)
        self.assertEqual(response.json()['results'][0], response.json()['results'][1])
        self.assertTrue(all(call.args[1] == str(self.wa_ids[0]) for call in self.wa.await_args_list))

    async def test_foreign_only_and_denied_requests_never_call_providers(self):
        response = await self.client.post('/api/v1/contacts/refresh-platforms', headers=self.headers(), json={'contact_ids': [str(self.contact_ids[1])]})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()['updated'], 0)
        response = await self.client.post('/api/v1/contacts/refresh-platforms', headers=self.headers(role='viewer'), json={'contact_ids': [str(self.contact_ids[0])]})
        self.assertEqual(response.status_code, 403, response.text)
        response = await self.client.post('/api/v1/contacts/check-platforms', json={'phones': ['+12025550101']})
        self.assertEqual(response.status_code, 401, response.text)
        for check in [self.tg, self.vk, self.wa]: check.assert_not_awaited()


if __name__ == '__main__':
    unittest.main(verbosity=2)
