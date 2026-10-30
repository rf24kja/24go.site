"""Offline contract tests: no real provider calls or publication."""
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import sys
sys.path.insert(0, str(Path(__file__).parent))

class CascadeTests(unittest.TestCase):
    def test_import_does_not_read_legacy_publisher_credentials(self):
        import subprocess
        script = '''import builtins,sys
real_open=builtins.open
def guarded(path,*a,**kw):
    if str(path).endswith(('.env','auth.json')):
        raise RuntimeError('Forbidden credential read')
    return real_open(path,*a,**kw)
builtins.open=guarded
sys.path.insert(0,sys.argv[1])
import final_review
'''
        result=subprocess.run([sys.executable,'-c',script,str(Path(__file__).parent)],capture_output=True)
        self.assertEqual(result.returncode,0,result.stderr.decode())

    def test_acceptance_is_consumable_by_real_cms_gate(self):
        import final_review as runner
        from _cms24go import editorial_gate, payload_for
        parse_frontmatter = runner.parse_frontmatter
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            ru = '---\ntitle: Проверка\nstatus: draft\n---\nТекст.\n'
            en = '---\ntitle: Check\nstatus: draft\n---\nText.\n'
            for name, text in [('draft.md', ru), ('draft.en.md', en), ('brief.md', 'Brief'), ('claims.md', 'Claims')]:
                (root / name).write_text(text)
            qa = dict(author_model='author', editor_model='editor', verifier_model='verifier', max_age_hours=24,
                      editor_provider='fixture', verifier_provider='fixture')
            final_ru, final_en = ru + '\nУточнение.\n', en + '\nClarification.\n'
            def transport(role, provider, model, prompt, system, directory, timeout):
                from datetime import datetime, timezone
                from uuid import uuid4
                response = dict(candidate_ru=final_ru, candidate_en=final_en) if role == 'editor' else dict(verdict='accept', blockers=[])
                now = datetime.now(timezone.utc).isoformat()
                receipt = dict(provider=provider, requested_model=model, actual_model=model, status='completed',
                               fresh_context=True, tools=[], context_id=str(uuid4()), process_id=str(uuid4()),
                               request_id=str(uuid4()), started_at=now, finished_at=now)
                return response, receipt
            result = runner.run(root / 'draft.md', qa, transport=transport)
            self.assertTrue(result['accepted'])
            payload = payload_for(root.name, final_ru, final_en, parse_frontmatter)
            self.assertTrue(editorial_gate(root/'draft.md', payload, qa, parse_frontmatter))
            self.assertEqual((root/'draft.md').read_text(), final_ru)
            index=json.loads((root/'final-review/acceptance.json').read_text())
            final_dir=(root/'final-review'/index['files']['final_ru']['path']).parent
            self.assertEqual(json.loads((final_dir/'final.sha256').read_text()),
                             {key:index['files'][key]['sha256'] for key in ('final_ru','final_en','payload')})
            evidence=root/'final-review'/index['files']['final_ru']['path']
            evidence.write_text(final_ru+'tampered')
            with self.assertRaises(ValueError):
                editorial_gate(root/'draft.md',payload,qa,parse_frontmatter)

class FailureTests(unittest.TestCase):
    def exercise(self, verdict='reject', actual=None, error=False, install_failure=False):
        import final_review as runner
        from datetime import datetime, timezone
        from uuid import uuid4
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            ru = '---\ntitle: Test\n---\nOriginal\n'
            for name in ('draft.md', 'draft.en.md', 'brief.md', 'claims.md'):
                (root/name).write_text(ru)
            review = root/'final-review'
            review.mkdir()
            (review/'acceptance.json').write_text('stale')
            calls = []
            qa = dict(author_model='author', editor_model='editor', verifier_model='verifier',
                      editor_provider='fixture', verifier_provider='fixture', max_age_hours=24)
            def transport(role, provider, model, prompt, system, directory, timeout):
                calls.append((role, prompt, system))
                if error:
                    raise TimeoutError('fixture failure')
                now = datetime.now(timezone.utc).isoformat()
                receipt = dict(provider=provider, requested_model=model, actual_model=actual or model,
                    status='completed', fresh_context=True, tools=[], context_id=str(uuid4()),
                    process_id=str(uuid4()), request_id=str(uuid4()), started_at=now, finished_at=now)
                response = dict(candidate_ru=ru, candidate_en=ru) if role=='editor' else dict(verdict=verdict, blockers=[] if verdict=='accept' else ['Fix a specific caveat'])
                return response, receipt
            if install_failure:
                original_write=runner.atomic_write
                def fail_install(path,text):
                    if Path(path)==root/'draft.md':
                        raise OSError('fixture disk failure')
                    return original_write(path,text)
                with patch.object(runner,'atomic_write',side_effect=fail_install), self.assertRaises(OSError):
                    runner.run(root/'draft.md',qa,transport=transport)
            elif error or actual:
                with self.assertRaises((runner.ReviewError, TimeoutError)):
                    runner.run(root/'draft.md', qa, transport=transport)
            else:
                result = runner.run(root/'draft.md', qa, transport=transport)
                self.assertFalse(result['accepted'])
                self.assertEqual(len(calls), 6)
                self.assertIn('Fix a specific caveat', calls[2][2])
                self.assertNotIn('blockers', calls[3][1])
                self.assertTrue(list(review.glob('runs/*/original_ru.md')))
                self.assertTrue(list(review.glob('runs/*/iteration-1/candidate_ru.md')))
            self.assertFalse((review/'acceptance.json').exists())
            self.assertEqual((root/'draft.md').read_text(), ru)

    def test_install_error_removes_acceptance(self):
        self.exercise(verdict='accept',install_failure=True)

    def test_three_rejections_preserve_original_and_evidence(self):
        self.exercise()

    def test_wrong_actual_model_stops_without_acceptance(self):
        self.exercise(actual='unexpected')

    def test_provider_error_stops_without_acceptance(self):
        self.exercise(error=True)

    def test_cli_transport_runs_two_real_isolated_processes(self):
        import final_review as runner
        import os
        from unittest.mock import patch
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            modules = root/'modules'
            for package in ('hermes_cli','agent'):
                (modules/package).mkdir(parents=True)
                (modules/package/'__init__.py').write_text('')
            (modules/'hermes_cli/runtime_provider.py').write_text('''def resolve_runtime_provider(**kw):
    return dict(provider=kw['requested'],api_mode='chat_completions',api_key='fixture')
''')
            (modules/'agent/auxiliary_client.py').write_text('''import os,json
from types import SimpleNamespace as N
class OpenAI:
    def __init__(self):
        self.chat=N(completions=N(create=self.create))
    def create(self,**kw):
        assert 'tools' not in kw
        messages=kw['messages']
        assert [m['role'] for m in messages]==['system','user']
        p=json.loads(messages[1]['content'])
        assert p['author_history'] is False and p['tools']==[]
        data=dict(verdict='accept',blockers=[]) if 'final_ru' in p else dict(candidate_ru=p['original_ru'],candidate_en=p['original_en'])
        return N(id='fixture-'+str(os.getpid()),model=kw['model'],choices=[N(finish_reason='stop',message=N(content=json.dumps(data),tool_calls=None,refusal=None))])
OpenAI.__module__='openai'
def resolve_provider_client(provider,model,**kw):
    return OpenAI(),model
''')
            article=root/'article'
            article.mkdir()
            for name in ('draft.md','draft.en.md','brief.md','claims.md'):
                (article/name).write_text('---\ntitle: Fixture\n---\nFixture text.\n')
            qa=dict(author_model='author',editor_model='editor',verifier_model='verifier',
                    editor_provider='fixture',verifier_provider='fixture',max_age_hours=24)
            with patch.dict(os.environ,{'PYTHONPATH':str(modules)}), patch('socket.socket.connect',side_effect=AssertionError('Network forbidden')):
                result=runner.run(article/'draft.md',qa)
            self.assertTrue(result['accepted'])
            index=json.loads((article/'final-review/acceptance.json').read_text())
            er,vr=index['receipts']['editor'],index['receipts']['verifier']
            self.assertNotEqual(er['process_id'],vr['process_id'])
            self.assertNotEqual(er['process_id'],str(os.getpid()))
            self.assertNotEqual(er['request_id'],vr['request_id'])

if __name__ == '__main__':
    unittest.main()
