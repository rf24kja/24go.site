import unittest,uuid
from sqlalchemy import select
from app.models import AutoReply,AutoReplyAnswer
from app.database import Base
from lead_fixture import Fixture

class Contracts(Fixture):
 async def asyncSetUp(self):
  await super().asyncSetUp()
  async with self.engine.begin() as c:
   await c.run_sync(lambda con:Base.metadata.create_all(con,tables=[AutoReply.__table__,AutoReplyAnswer.__table__]))
  self.ids=[uuid.uuid4() for _ in range(3)]
  for i,id in enumerate(self.ids):
   self.session.add(AutoReply(id=id,tenant_id=self.tenants[i%2],name='fixture',mode='rotation'))
  await self.session.commit()
  self.answer=uuid.uuid4()
  self.session.add(AutoReplyAnswer(id=self.answer,auto_reply_id=self.ids[2],text='sibling',sort_order=1))
  await self.session.commit()
 async def request(self,method,path,body=None,role='member',tenant=0):
  return await self.client.request(method,'/api/v1/auto-replies/'+path,headers=self.headers(tenant,role),**({'json':body} if body is not None else {}))
 async def test_malformed_identity_rejected_on_every_sibling(self):
  for method,suffix,body in [('GET','',None),('PUT','',{'name':'changed'}),('DELETE','',None),('POST','/answers',{'text':'new'}),('DELETE','/answers/'+str(self.answer),None),('POST','/import-answers',{'text':'a\nb'}),('POST','/toggle',None)]:
   with self.subTest(method=method,suffix=suffix):
    r=await self.request(method,'not-a-uuid'+suffix,body)
    self.assertEqual(r.status_code,422,r.text)
  r=await self.request('DELETE',str(self.ids[0])+'/answers/not-a-uuid')
  self.assertEqual(r.status_code,422,r.text)
 async def test_foreign_sibling_binding_and_owned_workflow(self):
  for method,suffix,body in [('GET','',None),('PUT','',{'name':'changed'}),('DELETE','',None),('POST','/answers',{'text':'new'}),('POST','/import-answers',{'text':'a\nb'}),('POST','/toggle',None)]:
   r=await self.request(method,str(self.ids[1])+suffix,body)
   self.assertEqual(r.status_code,404,r.text)
  r=await self.request('DELETE',str(self.ids[0])+'/answers/'+str(self.answer));self.assertEqual(r.status_code,404,r.text)
  r=await self.request('POST',str(self.ids[0])+'/import-answers',{'text':'a\n\nb'});self.assertEqual(r.status_code,200,r.text);self.assertEqual(r.json()['imported'],2)
  r=await self.request('GET',str(self.ids[0]));self.assertEqual(r.status_code,200,r.text);self.assertEqual([a['text'] for a in r.json()['answers']],['a','b'])
  answer=r.json()['answers'][0]['id']
  r=await self.request('DELETE',str(self.ids[0])+'/answers/'+answer);self.assertEqual(r.status_code,204,r.text)
  r=await self.request('POST',str(self.ids[0])+'/toggle');self.assertEqual(r.status_code,200,r.text)
  async with self.engine.connect() as c:
   names=(await c.execute(select(AutoReply.name).where(AutoReply.id==self.ids[1]))).scalar_one();self.assertEqual(names,'fixture')
   self.assertIsNotNone((await c.execute(select(AutoReplyAnswer.id).where(AutoReplyAnswer.id==self.answer))).scalar_one_or_none())
 async def test_viewer_cannot_mutate(self):
  for method,suffix,body in [('PUT','',{'name':'changed'}),('DELETE','',None),('POST','/answers',{'text':'new'}),('POST','/import-answers',{'text':'a'}),('POST','/toggle',None),('DELETE','/answers/'+str(self.answer),None)]:
   r=await self.request(method,str(self.ids[0])+suffix,body,role='viewer');self.assertEqual(r.status_code,403,r.text)

if __name__=='__main__':unittest.main(verbosity=2)
