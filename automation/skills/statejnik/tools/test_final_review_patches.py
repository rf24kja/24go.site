import sys,json,tempfile,unittest
from pathlib import Path
from datetime import datetime,timezone
from uuid import uuid4
C=Path(__file__).parent/'candidate'
if not C.is_dir(): C=Path(__file__).parent
sys.path.insert(0,str(C))
import final_review as runner
from _cms24go import editorial_gate,payload_for
TEXT='---\ntitle: Fixture\nstatus: review\n---\nOriginal prose.\n\n```python\nprint(1)\n```\n\nSource [docs](https://example.invalid/a).\n'
class ReviewPatchTests(unittest.TestCase):
 def test_real_cascade_and_cms_gate_reconstruct_raw_edits(self):
  with tempfile.TemporaryDirectory() as td:
   root=Path(td)
   for n,t in [('draft.md',TEXT),('draft.en.md',TEXT),('brief.md','Brief'),('claims.md','Claims')]: (root/n).write_text(t)
   qa=dict(author_model='author',editor_model='editor',verifier_model='verifier',editor_provider='fixture',verifier_provider='fixture',max_age_hours=24,editor_format='patches-v2')
   def transport(role,provider,model,prompt,system,directory,timeout):
    if role=='editor':
     self.assertIn('edits_ru',system)
     response={k:[{'old':'Original prose.','new':'Clear prose.'}] for k in ['edits_ru','edits_en']}
    else:
     self.assertEqual(prompt['final_ru'],TEXT.replace('Original prose.','Clear prose.'));response=dict(verdict='accept',blockers=[])
    now=datetime.now(timezone.utc).isoformat();return response,dict(provider=provider,requested_model=model,actual_model=model,status='completed',fresh_context=True,tools=[],context_id=str(uuid4()),process_id=str(uuid4()),request_id=str(uuid4()),started_at=now,finished_at=now)
   result=runner.run(root/'draft.md',qa,transport=transport);self.assertTrue(result['accepted'])
   index=json.loads((root/'final-review/acceptance.json').read_text());self.assertEqual(index['version'],2)
   final=TEXT.replace('Original prose.','Clear prose.');p=payload_for(root.name,final,final,runner.parse_frontmatter);self.assertTrue(editorial_gate(root/'draft.md',p,qa,runner.parse_frontmatter))
   self.assertEqual((root/'draft.md').read_text(),final)
 def test_code_frontmatter_url_and_inline_code_are_protected(self):
  from _editor_patches import apply_editor_edits
  text=TEXT+'\nUse `python3 demo.py`.\n'
  for old,new in [('print(1)','print(2)'),('title: Fixture','title: Changed'),('https://example.invalid/a','https://example.invalid/b'),('`python3 demo.py`','`python3 bad.py`')]:
   with self.subTest(old=old),self.assertRaises(ValueError):apply_editor_edits({'ru':text,'en':text},{'edits_ru':[{'old':old,'new':new}],'edits_en':[]})
 def test_ambiguous_missing_and_oversized_edits_fail_closed(self):
  from _editor_patches import apply_editor_edits
  for edits in [[{'old':'Original','new':'x'}]*41,[{'old':'MISSING','new':'x'}],[{'old':'','new':'x'}],[{'old':'Original','new':'x','extra':1}]]:
   with self.subTest(edits=str(edits)[:80]),self.assertRaises(ValueError):apply_editor_edits({'ru':TEXT,'en':TEXT},{'edits_ru':edits,'edits_en':[]})
  with self.assertRaises(ValueError):apply_editor_edits({'ru':'repeat repeat','en':TEXT},{'edits_ru':[{'old':'repeat','new':'x'}],'edits_en':[]})
 def test_empty_plan_preserves_exact_complete_original(self):
  from _editor_patches import apply_editor_edits
  self.assertEqual(apply_editor_edits({'ru':TEXT,'en':TEXT},{'edits_ru':[],'edits_en':[]}),{'ru':TEXT,'en':TEXT})
if __name__=='__main__':unittest.main(verbosity=2)
