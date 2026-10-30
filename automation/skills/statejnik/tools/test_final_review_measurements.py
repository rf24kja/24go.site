import os,sys,json,tempfile,unittest
from pathlib import Path
from datetime import datetime,timezone
from uuid import uuid4
sys.path.insert(0,os.environ.get('REVIEW_TEST_SOURCE',str(Path(__file__).resolve().parent)))
import final_review as runner

class MeasurementTests(unittest.TestCase):
 def test_both_reviewers_receive_exact_character_counts_and_reject_is_preserved(self):
  with tempfile.TemporaryDirectory() as td:
   root=Path(td);originals={}
   for loc,count in [('ru',7100),('en',7200)]:
    text=f'---\nstatus: review\ntarget_site: 24go.site\nlocale: {loc}\ntitle: Fixture\n---\n'+'Я'*count
    originals[loc]=text;(root/('draft.md' if loc=='ru' else 'draft.en.md')).write_text(text)
   (root/'brief.md').write_text('Real fixture brief');(root/'claims.md').write_text('Fixture claims')
   calls=[]
   def transport(role,provider,model,prompt,system,directory,timeout):
    for field in ['diagnostics_before']+(['diagnostics_after'] if role=='verifier' else []):
     diagnostics=json.loads(prompt[field])
     for loc,count in [('ru',7100),('en',7200)]:
      self.assertIn('body_length',diagnostics[loc],'Reviewers lack measured body-length evidence')
      measurement=diagnostics[loc]['body_length'];self.assertEqual(measurement['visible_characters'],count);self.assertEqual(measurement['minimum_visible_characters'],7000);self.assertTrue(measurement['meets_minimum'])
    self.assertIn('Do not estimate character counts from word counts',system)
    calls.append(role);response={'edits_ru':[],'edits_en':[]} if role=='editor' else {'verdict':'reject','blockers':['Concrete independent quality issue']}
    now=datetime.now(timezone.utc).isoformat();return response,dict(provider=provider,requested_model=model,actual_model=model,status='completed',fresh_context=True,tools=[],context_id=str(uuid4()),process_id=str(uuid4()),request_id=str(uuid4()),started_at=now,finished_at=now)
   qa=dict(author_model='author',editor_model='editor',verifier_model='verifier',editor_provider='fixture',verifier_provider='fixture',max_age_hours=24,editor_format='patches-v2')
   result=runner.run(root/'draft.md',qa,transport=transport)
   self.assertFalse(result['accepted']);self.assertEqual(calls,['editor','verifier']*3);self.assertFalse((root/'final-review/acceptance.json').exists())
   for loc,name in [('ru','draft.md'),('en','draft.en.md')]:self.assertEqual((root/name).read_text(),originals[loc])

if __name__=='__main__':unittest.main(verbosity=2)
