import unittest,uuid
from unittest.mock import patch
from sqlalchemy import select
from app.models import Proxy,AccountPool
from app.routers import accounts,groups,proxies
import lead_fixture

class ProxySafety(lead_fixture.Fixture):
    async def asyncSetUp(self):
        await super().asyncSetUp()
        self.proxies={}
        for ti,tenant in enumerate(self.tenants):
            for i in range(4):
                ident=uuid.uuid4();self.proxies[ti,i]=ident
                self.session.add(Proxy(id=ident,tenant_id=tenant,proxy_url=f'socks5://127.0.0.1:{1100+i}',is_active=i!=3))
        await self.session.commit()
    async def assignment(self,ti,platform,proxy):
        a=await self.session.get(AccountPool,self.accounts[ti,platform]);a.proxy_id=proxy
        await self.session.commit()
    async def assignments(self,ti):
        rows=(await self.session.execute(select(AccountPool).where(AccountPool.tenant_id==self.tenants[ti]))).scalars().all()
        for row in rows:await self.session.refresh(row)
        return {row.id:row.proxy_id for row in rows}
    async def test_bulk_without_reset_preserves_existing_assignments_and_used_proxies(self):
        await self.assignment(0,'telegram',self.proxies[0,1])
        await self.assignment(0,'vkontakte',self.proxies[0,0])
        before=await self.assignments(0);foreign=await self.assignments(1)
        with patch('app.routers.proxies.random.shuffle',lambda x:None):
            r=await self.client.post('/api/v1/proxies/bulk-assign',headers=self.headers(),json={'reset_first':False})
        self.assertEqual(r.status_code,200,r.text)
        after=await self.assignments(0)
        for account,proxy in before.items():
            if proxy is not None:self.assertEqual(after[account],proxy)
        self.assertEqual(r.json()['assigned'],1)
        self.assertEqual(len([p for p in after.values() if p is not None]),3)
        self.assertEqual(await self.assignments(1),foreign)

    async def test_malformed_assignment_returns_422_without_changing_binding(self):
        ident=self.accounts[0,'telegram'];await self.assignment(0,'telegram',self.proxies[0,0])
        response=await self.client.post(f'/api/v1/accounts/{ident}/assign-proxy',headers=self.headers(),json={'proxy_id':'not-a-uuid'})
        self.assertEqual(response.status_code,422,response.text)
        self.assertEqual((await self.assignments(0))[ident],self.proxies[0,0])

    async def test_proxy_readers_reject_legacy_foreign_bindings(self):
        ident=self.accounts[0,'telegram'];await self.assignment(0,'telegram',self.proxies[1,0])
        for module in [accounts,groups]:
            with self.subTest(module=module.__name__):
                self.assertIsNone(await module._resolve_proxy_for_account(ident))

    async def test_repeated_no_reset_is_noop_and_explicit_reset_still_works(self):
        foreign=await self.assignments(1)
        for reset,expected in [(False,3),(False,0),(True,3)]:
            before=await self.assignments(0)
            r=await self.client.post('/api/v1/proxies/bulk-assign',headers=self.headers(),json={'reset_first':reset})
            self.assertEqual(r.status_code,200,r.text)
            self.assertEqual(r.json()['assigned'],expected)
            after=await self.assignments(0)
            if expected==0:self.assertEqual(after,before)
            self.assertEqual(r.json()['unassigned_accounts'],sum(x is None for x in after.values()))
            self.assertEqual(r.json()['unused_proxies'],0)
            self.assertEqual(r.json()['total_proxies'],3)
        self.assertEqual(await self.assignments(1),foreign)

    async def test_owned_assignment_unassignment_and_both_readers_keep_working(self):
        ident=self.accounts[0,'telegram']
        for role in ['owner','admin','member']:
            r=await self.client.post(f'/api/v1/accounts/{ident}/assign-proxy',headers=self.headers(role=role),json={'proxy_id':str(self.proxies[0,1]).upper()})
            self.assertEqual(r.status_code,200,r.text)
            for module in [accounts,groups]:
                result=await module._resolve_proxy_for_account(ident)
                self.assertEqual(result[1:3],('127.0.0.1',1101))
            r=await self.client.post(f'/api/v1/accounts/{ident}/assign-proxy',headers=self.headers(role=role),json={'proxy_id':None})
            self.assertEqual(r.status_code,200,r.text)
            self.assertIsNone((await self.assignments(0))[ident])

    async def test_denied_assignments_and_viewer_bulk_leave_bindings_unchanged(self):
        ident=self.accounts[0,'telegram'];await self.assignment(0,'telegram',self.proxies[0,0])
        before=await self.assignments(0)
        for proxy_id in [self.proxies[1,0],self.proxies[0,3],uuid.uuid4()]:
            r=await self.client.post(f'/api/v1/accounts/{ident}/assign-proxy',headers=self.headers(),json={'proxy_id':str(proxy_id)})
            self.assertEqual(r.status_code,404,r.text)
            self.assertEqual(await self.assignments(0),before)
        r=await self.client.post(f'/api/v1/accounts/{self.accounts[1,"telegram"]}/assign-proxy',headers=self.headers(),json={'proxy_id':str(self.proxies[0,0])})
        self.assertEqual(r.status_code,404,r.text)
        for path,body in [('/api/v1/proxies/bulk-assign',{'reset_first':True}),(f'/api/v1/accounts/{ident}/assign-proxy',{'proxy_id':None})]:
            r=await self.client.post(path,headers=self.headers(role='viewer'),json=body)
            self.assertEqual(r.status_code,403,r.text)
        self.assertEqual(await self.assignments(0),before)

if __name__=='__main__':unittest.main(verbosity=2)
