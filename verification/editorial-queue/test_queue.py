"""Read-only selection fixtures; genuine evidence gate, synthetic model transport."""
from pathlib import Path
from datetime import datetime, timezone
import importlib.util
import json
import sys
import tempfile
import unittest
from uuid import uuid4

HOME = Path(sys.argv.pop(1)) if len(sys.argv) > 1 and Path(sys.argv[1]).is_dir() else Path(__file__).resolve().parents[2] / 'automation'
sys.path.insert(0, str(HOME / 'skills/statejnik/tools'))
import final_review

QA = dict(author_model='author', editor_model='editor', verifier_model='verifier', editor_provider='fixture', verifier_provider='fixture', max_age_hours=24, editor_format='patches-v2')
CONFIG = dict(qa=dict(final_review=QA), publishing=dict(platforms={'24go': dict(enabled=True, auth_mode='local_backend', api_base_url='https://api.24go.site/api/v1/blog', site_url='https://www.24go.site')}))


def transport(role, provider, model, prompt, system, directory, timeout):
    response = dict(edits_ru=[], edits_en=[]) if role == 'editor' else dict(verdict='accept', blockers=[])
    now = datetime.now(timezone.utc).isoformat()
    return response, dict(provider=provider, requested_model=model, actual_model=model, status='completed', fresh_context=True, tools=[], context_id=str(uuid4()), process_id=str(uuid4()), request_id=str(uuid4()), started_at=now, finished_at=now)


def pair(root, slug, date, accepted=False):
    folder = root / slug
    folder.mkdir()
    for locale, name in [('ru', 'draft.md'), ('en', 'draft.en.md')]:
        (folder / name).write_text(f'---\nstatus: review\ntarget_site: 24go.site\nslug: {slug}\nlocale: {locale}\ntitle: Fixture\ncreated_at: {date}\n---\n' + 'Synthetic useful paragraph. ' * 350)
    (folder / 'brief.md').write_text('Synthetic brief')
    (folder / 'claims.md').write_text('Synthetic claims')
    if accepted:
        assert final_review.run(folder / 'draft.md', QA, transport=transport)['accepted']
    return folder


class QueueTests(unittest.TestCase):
    def selector(self):
        entry = HOME / 'scripts/statejnik_delivery_queue.py'
        self.assertTrue(entry.is_file(), 'Executable queue selector is missing')
        spec = importlib.util.spec_from_file_location('delivery_queue_fixture', entry)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module

    def test_old_rejected_pair_does_not_starve_new_accepted_pair(self):
        module = self.selector()
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            pair(root, 'older-rejected', '2026-10-01T00:00:00+00:00')
            ready = pair(root, 'newer-accepted', '2026-10-02T00:00:00+00:00', True)
            before = {str(p): p.read_bytes() for p in root.rglob('*') if p.is_file()}
            result = module.inspect_queue(root, CONFIG)
            self.assertEqual(result['selected']['slug'], 'newer-accepted')
            self.assertEqual(Path(result['selected']['draft']), ready / 'draft.md')
            self.assertEqual([v['slug'] for v in result['blocked']], ['older-rejected'])
            self.assertEqual(before, {str(p): p.read_bytes() for p in root.rglob('*') if p.is_file()})
            self.assertTrue(result['selection_only'])

    def test_oldest_accepted_is_ordered_by_instant_not_folder_or_timezone(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            pair(root, 'a-later', '2026-10-01T03:00:00+01:00', True)
            pair(root, 'z-earlier', '2026-10-01T01:00:00+00:00', True)
            result = self.selector().inspect_queue(root, CONFIG)
            self.assertEqual(result['selected']['slug'], 'z-earlier')
            self.assertEqual(result['eligible_count'], 2)

    def test_changed_content_cannot_reuse_existing_acceptance(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            folder = pair(root, 'changed-article', '2026-10-01T00:00:00+00:00', True)
            draft = folder / 'draft.md'
            draft.write_text(draft.read_text() + '\nUnreviewed addition.\n')
            result = self.selector().inspect_queue(root, CONFIG)
            self.assertIsNone(result['selected'])
            self.assertEqual(result['blocked'][0]['reason'], 'editorial_gate_failed')

    def test_partial_mixed_published_foreign_and_unsafe_paths_are_not_selected(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            for slug in ('published-pair', 'mixed-pair', 'foreign-pair', 'partial-pair'):
                folder = pair(root, slug, '2026-10-01T00:00:00+00:00')
                for name in ('draft.md', 'draft.en.md'):
                    p = folder / name
                    if slug == 'published-pair' or (slug == 'mixed-pair' and name == 'draft.md'):
                        p.write_text(p.read_text().replace('status: review', 'status: published'))
                    if slug == 'foreign-pair':
                        p.write_text(p.read_text().replace('target_site: 24go.site', 'target_site: other.invalid'))
                if slug == 'partial-pair':
                    (folder / 'draft.en.md').unlink()
            (root / 'unsafe-pair').symlink_to(root / 'published-pair', target_is_directory=True)
            result = self.selector().inspect_queue(root, CONFIG)
            self.assertIsNone(result['selected'])
            self.assertEqual({v['slug'] for v in result['blocked']}, {'mixed-pair', 'partial-pair', 'unsafe-pair'})

    def test_disabled_or_wrong_origin_configuration_fails_closed(self):
        for field, value in [('enabled', False), ('api_base_url', 'https://other.invalid/blog')]:
            with self.subTest(field=field), tempfile.TemporaryDirectory() as td:
                config = json.loads(json.dumps(CONFIG))
                config['publishing']['platforms']['24go'][field] = value
                with self.assertRaises(ValueError):
                    self.selector().inspect_queue(Path(td), config)


if __name__ == '__main__':
    unittest.main(verbosity=2)
