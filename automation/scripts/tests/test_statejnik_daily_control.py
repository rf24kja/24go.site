import importlib.util,json,multiprocessing,sys,tempfile,time,unittest
from pathlib import Path
SCRIPT=Path(__file__).resolve().parents[1]/'statejnik_daily_control.py'
spec=importlib.util.spec_from_file_location('daily_control',SCRIPT);ctl=importlib.util.module_from_spec(spec);spec.loader.exec_module(ctl)

class ControlTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.work=Path(self.tmp.name);self.processes=[]
 def tearDown(self):
  for p in self.processes:
   if p.is_alive():p.terminate()
   p.join(5)
  self.tmp.cleanup()
 def keeper(self,run='fixture-run'):
  p=multiprocessing.get_context('fork').Process(target=ctl.hold,args=(self.work,run,30));p.start();self.processes.append(p)
  path=ctl.owner_path(self.work,run)
  deadline=time.monotonic()+5
  while not path.exists() and time.monotonic()<deadline:time.sleep(.01)
  self.assertTrue(path.exists());return p
 def drafts(self,slug='fixture-article',status='review',date=None):
  directory=self.work/slug;directory.mkdir();date=date or ctl.today()
  for locale,name in [('ru','draft.md'),('en','draft.en.md')]:
   (directory/name).write_text(f'---\nstatus: {status}\ntarget_site: 24go.site\nlocale: {locale}\nslug: {slug}\neditorial_date: {date}\n---\nReal fixture body.\n')
  return directory
 def test_real_lock_reservation_finish_and_no_second_article(self):
  p=self.keeper();claim=ctl.reserve(self.work,'fixture-run','fixture-article');self.assertEqual(claim['state'],'reserved')
  with self.assertRaises((ValueError,FileExistsError)):ctl.reserve(self.work,'fixture-run','other-article')
  self.drafts();done=ctl.finish(self.work,'fixture-run','review_created');self.assertEqual(len(done['hashes']),2);p.join(5);self.assertFalse(p.is_alive())
  self.assertEqual(json.loads(ctl.owner_path(self.work,'fixture-run').read_text())['state'],'released')
 def test_missing_date_on_old_published_pair_uses_historical_upper_bound(self):
  directory=self.drafts(status='published')
  for file in directory.glob('draft*.md'):file.write_text('---\nstatus: published\npublished_at: 2026-01-01T00:00:00+00:00\n---\nOld fixture\n')
  snapshot=ctl.snapshot(self.work,ctl.today());self.assertEqual(snapshot['pending'],0);self.assertEqual(snapshot['created_today'],0)
 def test_orphan_reservation_consumes_backlog(self):
  path=self.work/'topics'/'2026-01-01'/'24go-site-slot-1.json';path.parent.mkdir(parents=True);path.write_text(json.dumps(dict(state='reserved',slug='interrupted-article')))
  self.assertEqual(ctl.snapshot(self.work,ctl.today())['pending'],1)
 def test_dead_keeper_cannot_reserve(self):
  p=self.keeper();ctl.release(self.work,'fixture-run');p.join(5)
  with self.assertRaises(ValueError):ctl.reserve(self.work,'fixture-run','fixture-article')
  self.assertFalse((self.work/'topics').exists())
 def test_backlog_limit_and_literal_identifier(self):
  for n in range(3):self.drafts('fixture-'+str(n),date='2026-01-01')
  self.keeper()
  with self.assertRaises(ValueError):ctl.reserve(self.work,'fixture-run','next-article')
  with self.assertRaises(ValueError):ctl.owner_path(self.work,'../other')
 def test_wrong_locale_cannot_complete_and_reservation_is_retained(self):
  self.keeper();ctl.reserve(self.work,'fixture-run','fixture-article');directory=self.drafts();(directory/'draft.en.md').write_text((directory/'draft.en.md').read_text().replace('locale: en','locale: ru'))
  with self.assertRaises(ValueError):ctl.finish(self.work,'fixture-run','review_created')
  path=self.work/'topics'/ctl.today()/'24go-site-slot-1.json';self.assertEqual(json.loads(path.read_text())['state'],'reserved')
  ctl.finish(self.work,'fixture-run','blocked')

if __name__=='__main__':unittest.main(verbosity=2)
