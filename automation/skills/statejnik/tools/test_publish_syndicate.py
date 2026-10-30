"""Offline regression tests: no real credentials, config or network access."""
import importlib.util
import contextlib
import io
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch


class SyndicationTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.enterContext(patch.dict(os.environ, {}, clear=True))
        self.enterContext(patch('urllib.request.urlopen', side_effect=AssertionError('network forbidden')))
        self.enterContext(patch('socket.socket', side_effect=AssertionError('network forbidden')))
        spec = importlib.util.spec_from_file_location('offline_publish', Path(__file__).with_name('publish.py'))
        self.module = importlib.util.module_from_spec(spec)
        # Redirect import-time .env lookup before executing the real module.
        with patch('os.path.expanduser', return_value=str(self.root / 'nonexistent.env')):
            spec.loader.exec_module(self.module)
        self.enterContext(patch.object(self.module, 'find_config', return_value=None))
        self.enterContext(patch.object(self.module, 'load_config', return_value={}))
        self.http = self.enterContext(patch.object(self.module, 'fetch_json', side_effect=AssertionError('unexpected HTTP')))
        self.refresh = self.enterContext(patch.object(self.module, '_refresh_blogger_token', side_effect=AssertionError('refresh forbidden')))
        self.draft = self.root / 'draft.md'
        self.write_draft()

    def write_draft(self, extra=''):
        self.draft.write_text('---\ntitle: Test\nstatus: published\ncanonical_url: https://example.test/ru\n' + extra + '---\nBody\n', encoding='utf-8')

    def run_publish(self):
        return self.module.publish_syndicate('test', 'published', str(self.draft))

    def test_no_available_target_is_error(self):
        self.assertEqual(self.run_publish(), 1)
        self.http.assert_not_called()
        self.refresh.assert_not_called()

    def test_completion_checkpoint_is_owned_by_adapter_not_scheduler(self):
        os.environ['DEV_TO_API_KEY'] = 'fake'
        self.draft.write_text('---\nstatus: "published"\ncanonical_url: https://example.test/ru\nsyndicated: false\n---\nBody mentions syndicated: true\n')
        self.http.side_effect = [(201, {'url': 'https://dev.to/fake/ru'})]
        self.assertEqual(self.run_publish(), 0)
        meta, body = self.module.parse_frontmatter(self.draft.read_text())
        self.assertEqual(meta.get('syndicated'), 'true')
        self.assertEqual(body.strip(), 'Body mentions syndicated: true')

    def test_explicit_disabled_platform_is_not_published(self):
        os.environ['DEV_TO_API_KEY'] = 'fake'
        os.environ['TELEGRA_PH_TOKEN'] = 'fake'
        self.module.load_config.return_value = {'publishing': {'platforms': {'devto': {'enabled': False}}}}
        self.http.side_effect = [(200, {'ok': True, 'result': {'path': 'fake'}})]
        self.assertEqual(self.run_publish(), 0)
        self.assertEqual(self.http.call_count, 1)
        self.assertIn('telegra.ph', self.http.call_args.args[0])

    def test_enabled_platform_without_credentials_prevents_completion(self):
        self.write_draft('telegraph_url: https://telegra.ph/fake\n')
        self.module.load_config.return_value = {'publishing': {'platforms': {'devto': {'enabled': True}}}}
        self.assertEqual(self.run_publish(), 1)
        self.http.assert_not_called()

    def test_success_is_checkpointed_before_later_transport_failure(self):
        os.environ['DEV_TO_API_KEY'] = 'fake'
        self.write_draft('canonical_url_en: https://example.test/en\n')
        self.http.side_effect = [(201, {'url': 'https://dev.to/fake/ru'}), OSError('offline')]
        self.assertEqual(self.run_publish(), 1)
        meta, _ = self.module.parse_frontmatter(self.draft.read_text())
        self.assertEqual(meta['devto_url'], 'https://dev.to/fake/ru')
        self.assertNotIn('devto_en_url', meta)

    def test_url_in_body_does_not_prevent_frontmatter_checkpoint(self):
        os.environ['DEV_TO_API_KEY'] = 'fake'
        # Quoted status is valid frontmatter, not a literal replacement anchor.
        self.draft.write_text('---\ntitle: Test\nstatus: "published"\ncanonical_url: https://example.test/ru\n---\nBody mentions devto_url\n')
        self.http.side_effect = [(201, {'url': 'https://dev.to/fake/ru'})]
        self.assertEqual(self.run_publish(), 0)
        meta, body = self.module.parse_frontmatter(self.draft.read_text())
        self.assertEqual(meta.get('devto_url'), 'https://dev.to/fake/ru')
        self.assertIn('Body mentions devto_url', body)
        self.http.reset_mock()
        self.http.side_effect = AssertionError('duplicate publication')
        self.assertEqual(self.run_publish(), 0)
        self.http.assert_not_called()

    def test_success_response_without_url_is_not_completion(self):
        os.environ['DEV_TO_API_KEY'] = 'fake'
        self.http.side_effect = [(201, {})]
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            self.assertEqual(self.run_publish(), 1)
        self.assertNotIn('✅', output.getvalue())
        meta, _ = self.module.parse_frontmatter(self.draft.read_text())
        self.assertNotIn('devto_url', meta)

    def test_missing_credentials_for_pending_en_does_not_complete(self):
        self.write_draft('canonical_url_en: https://example.test/en\ndevto_url: https://dev.to/fake/ru\n')
        self.assertEqual(self.run_publish(), 1)
        self.http.assert_not_called()

    def test_telegraph_success_survives_blogger_failure_and_retry(self):
        os.environ.update(TELEGRA_PH_TOKEN='fake', BLOGGER_BLOG_ID='fake', BLOGGER_ACCESS_TOKEN='fake')
        self.http.side_effect = [(200, {'ok': True, 'result': {'path': 'fake'}}), (500, {})]
        self.assertEqual(self.run_publish(), 1)
        meta, _ = self.module.parse_frontmatter(self.draft.read_text())
        self.assertEqual(meta['telegraph_url'], 'https://telegra.ph/fake')
        self.http.reset_mock()
        self.http.side_effect = [(201, {'url': 'https://example.test/blogger'})]
        self.assertEqual(self.run_publish(), 0)
        self.assertEqual(self.http.call_count, 1)
        meta, _ = self.module.parse_frontmatter(self.draft.read_text())
        self.assertEqual(meta['blogger_url'], 'https://example.test/blogger')
        self.refresh.assert_not_called()

    def test_en_success_survives_ru_failure_and_retry(self):
        os.environ['DEV_TO_API_KEY'] = 'fake'
        self.write_draft('canonical_url_en: https://example.test/en\n')
        self.http.side_effect = [(422, {}), (201, {'url': 'https://dev.to/fake/en'})]
        self.assertEqual(self.run_publish(), 1)
        meta, _ = self.module.parse_frontmatter(self.draft.read_text())
        self.assertEqual(meta['devto_en_url'], 'https://dev.to/fake/en')
        self.http.reset_mock()
        self.http.side_effect = [(201, {'url': 'https://dev.to/fake/ru'})]
        self.assertEqual(self.run_publish(), 0)
        self.assertEqual(self.http.call_count, 1)

    def test_all_disabled_is_error_even_with_credentials(self):
        os.environ.update(DEV_TO_API_KEY='fake', TELEGRA_PH_TOKEN='fake', BLOGGER_BLOG_ID='fake')
        self.module.load_config.return_value = {'publishing': {'platforms': {
            name: {'enabled': False} for name in ('devto', 'telegraph', 'blogger')
        }}}
        self.assertEqual(self.run_publish(), 1)
        self.http.assert_not_called()
        self.refresh.assert_not_called()

    def test_en_failure_is_failure_and_retry_keeps_ru_url(self):
        os.environ['DEV_TO_API_KEY'] = 'fake'
        self.write_draft('canonical_url_en: https://example.test/en\n')
        self.http.side_effect = [(201, {'url': 'https://dev.to/fake/ru'}), (422, {'error': 'invalid'})]
        self.assertEqual(self.run_publish(), 1)
        meta, _ = self.module.parse_frontmatter(self.draft.read_text())
        self.assertEqual(meta['devto_url'], 'https://dev.to/fake/ru')
        self.assertNotIn('devto_en_url', meta)
        self.http.reset_mock()
        self.http.side_effect = [(201, {'url': 'https://dev.to/fake/en'})]
        self.assertEqual(self.run_publish(), 0)
        self.assertEqual(self.http.call_count, 1)
        meta, _ = self.module.parse_frontmatter(self.draft.read_text())
        self.assertEqual(meta['devto_en_url'], 'https://dev.to/fake/en')
        self.http.reset_mock()
        self.http.side_effect = AssertionError('duplicate publication')
        self.assertEqual(self.run_publish(), 0)
        self.http.assert_not_called()


if __name__ == '__main__':
    unittest.main()
