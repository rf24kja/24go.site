"""Recovery contracts; synthetic providers only, genuine CMS evidence validation."""
import json
import sys
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

source = Path(sys.argv.pop(1)) if len(sys.argv) > 1 and Path(sys.argv[1]).is_dir() else Path(__file__).resolve().parents[2] / 'automation/skills/statejnik/tools'
sys.path.insert(0, str(source))
import final_review as runner
from _cms24go import editorial_gate, payload_for

TEXT = '---\ntitle: Fixture\nstatus: review\n---\nOriginal prose.\n\n```python\nprint(1)\n```\n'
QA = dict(author_model='author', editor_model='editor', verifier_model='verifier', editor_provider='fixture', verifier_provider='fixture', max_age_hours=24, editor_format='patches-v2')


class PatchRecovery(unittest.TestCase):
    def test_three_invalid_plans_leave_originals_unaccepted(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            for name in ('draft.md', 'draft.en.md', 'brief.md', 'claims.md'):
                (root / name).write_text(TEXT)
            calls = []
            def transport(role, provider, model, prompt, system, directory, timeout):
                calls.append(role)
                self.assertEqual(role, 'editor')
                now = datetime.now(timezone.utc).isoformat()
                return dict(edits_ru=[dict(old='Missing source', new='Changed')], edits_en=[]), dict(
                    provider=provider, requested_model=model, actual_model=model, status='completed',
                    fresh_context=True, tools=[], context_id=str(uuid4()), process_id=str(uuid4()),
                    request_id=str(uuid4()), started_at=now, finished_at=now)
            result = runner.run(root / 'draft.md', QA, transport=transport)
            self.assertFalse(result['accepted'])
            self.assertEqual(result['iterations'], 3)
            self.assertEqual(calls, ['editor'] * 3)
            self.assertFalse((root / 'final-review/acceptance.json').exists())
            for name in ('draft.md', 'draft.en.md'):
                self.assertEqual((root / name).read_text(), TEXT)

    def test_provider_failure_is_not_retried_as_invalid_patch(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            for name in ('draft.md', 'draft.en.md', 'brief.md', 'claims.md'):
                (root / name).write_text(TEXT)
            calls = []
            def transport(*args):
                calls.append(args[0])
                raise runner.ReviewError('Independent editor process failed (no fallback)')
            with self.assertRaises(runner.ReviewError):
                runner.run(root / 'draft.md', QA, transport=transport)
            self.assertEqual(calls, ['editor'])
            self.assertFalse((root / 'final-review/acceptance.json').exists())

    def test_invalid_editor_plan_gets_feedback_and_fresh_valid_review(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            for name, text in [('draft.md', TEXT), ('draft.en.md', TEXT), ('brief.md', 'Brief'), ('claims.md', 'Claims')]:
                (root / name).write_text(text)
            calls = []
            def transport(role, provider, model, prompt, system, directory, timeout):
                calls.append(role)
                if calls == ['editor']:
                    data = {'edits_ru': [{'old': 'Invented source prose.', 'new': 'Clear prose.'}], 'edits_en': []}
                elif role == 'editor':
                    self.assertIn('Edit must match exactly once', system)
                    self.assertEqual(prompt['original_ru'], TEXT)
                    data = {key: [{'old': 'Original prose.', 'new': 'Clear prose.'}] for key in ('edits_ru', 'edits_en')}
                else:
                    self.assertEqual(prompt['final_ru'], TEXT.replace('Original prose.', 'Clear prose.'))
                    data = dict(verdict='accept', blockers=[])
                now = datetime.now(timezone.utc).isoformat()
                return data, dict(provider=provider, requested_model=model, actual_model=model, status='completed', fresh_context=True, tools=[], context_id=str(uuid4()), process_id=str(uuid4()), request_id=str(uuid4()), started_at=now, finished_at=now)
            result = runner.run(root / 'draft.md', QA, transport=transport)
            self.assertTrue(result['accepted'])
            self.assertEqual(result['iterations'], 2)
            self.assertEqual(calls, ['editor', 'editor', 'verifier'])
            final = TEXT.replace('Original prose.', 'Clear prose.')
            payload = payload_for(root.name, final, final, runner.parse_frontmatter)
            self.assertTrue(editorial_gate(root / 'draft.md', payload, QA, runner.parse_frontmatter))
            errors = list((root / 'final-review/runs').glob('*/iteration-1/editor-validation.json'))
            self.assertEqual(len(errors), 1)
            self.assertEqual(json.loads(errors[0].read_text())['error'], 'Edit must match exactly once')


if __name__ == '__main__':
    unittest.main(verbosity=2)
