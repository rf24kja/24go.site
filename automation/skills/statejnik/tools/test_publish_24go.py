"""Offline CMS contract tests; no real configuration, secrets or network."""
import contextlib
import importlib.util
import io
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch


class CmsTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.enterContext(patch.dict(os.environ, {}, clear=True))
        self.enterContext(patch('urllib.request.urlopen', side_effect=AssertionError('network forbidden')))
        self.enterContext(patch('socket.socket', side_effect=AssertionError('network forbidden')))
        spec = importlib.util.spec_from_file_location('cms_publish_test', Path(__file__).with_name('publish.py'))
        self.module = importlib.util.module_from_spec(spec)
        with patch('os.path.expanduser', return_value=str(self.root / 'missing.env')):
            spec.loader.exec_module(self.module)
        self.enterContext(patch.object(self.module, 'find_config', return_value=None))
        self.config = self.enterContext(patch.object(self.module, 'load_config', return_value={}))
        self.http = self.enterContext(patch.object(self.module, 'fetch_json', side_effect=AssertionError('unexpected HTTP')))
        self.enterContext(contextlib.redirect_stdout(io.StringIO()))
        self.draft = self.root / 'draft.md'
        self.draft.write_text('---\ntitle: Русский\nstatus: draft\n---\n' + 'RU body ' * 1000 + '\n')
        (self.root / 'draft.en.md').write_text('---\ntitle: English\nstatus: draft\n---\n' + 'EN body ' * 1000 + '\n')
        self.before = self.draft.read_text()
        self.cwd = os.getcwd()
        os.chdir(self.root)
        self.addCleanup(os.chdir, self.cwd)

    def run_publish(self):
        return self.module.publish_24go('test-article', 'published', str(self.draft))

    def enable(self):
        self.config.return_value = {'publishing': {'platforms': {'24go': {
            'enabled': True, 'api_base_url': 'https://cms.example.test/api/v1/blog',
            'site_url': 'https://www.24go.site', 'token_env': 'TEST_CMS_TOKEN',
        }}}}
        self.config.return_value['qa'] = {'final_review': {
            'author_model': 'author-v1', 'editor_model': 'editor-v1', 'verifier_model': 'verifier-v1',
            'max_age_hours': 24,
        }}
        os.environ['TEST_CMS_TOKEN'] = 'fake-owner-token'
        self.accept()
        self.posts = []
        self.http.side_effect = self.backend

    def accept(self):
        # Synthetic review receipts are test fixtures only, never production approvals.
        import hashlib
        import json
        from datetime import datetime, timedelta, timezone
        review = self.root / 'final-review'
        review.mkdir(exist_ok=True)
        ru = self.draft.read_text()
        en = (self.root / 'draft.en.md').read_text()
        payload = dict(slug='test-article', title_ru='Русский', title_en='English',
                       content_ru=('RU body ' * 1000).strip(), content_en=('EN body ' * 1000).strip(), excerpt_ru='', excerpt_en='',
                       meta_description_ru='', meta_description_en='', tags=[], og_image_url='')
        shared = dict(original_ru=ru, original_en=en, brief='Brief', claims='Claims',
                      diagnostics_before='Before', diagnostics_after='After')
        ep = dict({k: v for k, v in shared.items() if k != 'diagnostics_after'}, author_history=False, tools=[])
        vp = dict(shared, final_ru=ru, final_en=en, author_history=False, tools=[])
        artifacts = dict(original_ru=ru, original_en=en, candidate_ru=ru, candidate_en=en,
                         final_ru=ru, final_en=en, brief='Brief', claims='Claims',
                         diagnostics_before='Before', diagnostics_after='After',
                         payload=json.dumps(payload, sort_keys=True, ensure_ascii=False, separators=(',', ':')),
                         editor_prompt=json.dumps(ep), verifier_prompt=json.dumps(vp),
                         editor_response=json.dumps(dict(candidate_ru=ru, candidate_en=en)),
                         verifier_response=json.dumps(dict(verdict='accept', blockers=[])))
        files = {}
        for key, text in artifacts.items():
            data = text.encode()
            (review / (key + '.txt')).write_bytes(data)
            files[key] = dict(path=key + '.txt', sha256=hashlib.sha256(data).hexdigest())
        receipts = {}
        now = datetime.now(timezone.utc)
        for i, role in enumerate(('editor', 'verifier')):
            receipts[role] = dict(provider='offline-fixture', requested_model=role + '-v1',
                                  actual_model=role + '-v1', status='completed',
                                  context_id=role, process_id=i + 1, request_id=role,
                                  fresh_context=True, tools=[],
                                  started_at=(now - timedelta(seconds=4 - i * 2)).isoformat(),
                                  finished_at=(now - timedelta(seconds=3 - i * 2)).isoformat(),
                                  prompt_sha256=files[role + '_prompt']['sha256'],
                                  response_sha256=files[role + '_response']['sha256'])
        index = dict(version=1, run_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
                     source_path=str(self.draft.resolve()), author_model='author-v1', files=files,
                     receipts=receipts)
        (review / 'acceptance.json').write_text(json.dumps(index))

    def backend(self, url, method='GET', data=None, headers=None, **kwargs):
        if '/admin' in url:
            self.assertEqual(headers['Authorization'], 'Bearer fake-owner-token')
        if method == 'POST':
            post = dict(data, id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
                        created_at='2026-10-20T00:00:00+00:00')
            self.posts.append(post)
            return 201, dict(post)
        if method == 'PUT':
            self.assertEqual(url.rsplit('/', 1)[1], self.posts[0]['id'])
            self.posts[0].update(data)
            return 200, dict(self.posts[0])
        if '/admin/list?' in url:
            return 200, {'items': [dict(p) for p in self.posts], 'total': len(self.posts)}
        locale = 'ru' if 'locale=ru' in url else 'en'
        if not self.posts:
            return 404, {'detail': 'Post not found'}
        post = self.posts[0]
        return 200, dict(slug=post['slug'], title=post['title_' + locale],
                         content=post['content_' + locale], excerpt=post['excerpt_' + locale],
                         meta_description=post['meta_description_' + locale],
                         tags=post['tags'], og_image_url=post['og_image_url'])

    def test_real_bilingual_create_readback_then_idempotent_retry(self):
        self.enable()
        self.assertEqual(self.run_publish(), 0)
        self.assertEqual(len(self.posts), 1)
        self.assertIs(self.posts[0]['published'], True)
        self.assertEqual(self.posts[0]['content_ru'], ('RU body ' * 1000).strip())
        self.assertEqual(self.posts[0]['content_en'], ('EN body ' * 1000).strip())
        meta, _ = self.module.parse_frontmatter(self.draft.read_text())
        self.assertEqual(meta['status'], 'published')
        self.assertEqual(meta['canonical_url'], 'https://www.24go.site/blog/test-article?locale=ru')
        self.assertEqual(meta['canonical_url_en'], 'https://www.24go.site/blog/test-article?locale=en')
        self.assertEqual(meta['cms_24go_id'], self.posts[0]['id'])
        self.assertTrue((self.root / 'published/ru/test-article.md').exists())
        self.assertTrue((self.root / 'published/en/test-article.md').exists())
        self.http.reset_mock()
        self.assertEqual(self.run_publish(), 0)
        self.assertFalse(any(c.kwargs.get('method', 'GET') != 'GET' for c in self.http.call_args_list))
        after, _ = self.module.parse_frontmatter(self.draft.read_text())
        self.assertEqual(after['published_at'], meta['published_at'])

    def test_changed_local_version_during_readback_cannot_be_marked_published(self):
        self.enable()
        def changed(url, **kwargs):
            result = self.backend(url, **kwargs)
            if '?locale=en' in url:
                self.draft.write_text(self.before + '\nConcurrent edit\n')
            return result
        self.http.side_effect = changed
        self.assertEqual(self.run_publish(), 1)
        meta, _ = self.module.parse_frontmatter(self.draft.read_text())
        self.assertEqual(meta['status'], 'draft')
        self.assertIn('Concurrent edit', self.draft.read_text())

    def test_cms_requests_never_follow_redirects_with_credentials(self):
        self.enable()
        self.assertEqual(self.run_publish(), 0)
        self.assertTrue(all(c.kwargs.get('allow_redirects') is False for c in self.http.call_args_list))

    def test_credentials_without_review_never_contact_cms(self):
        self.enable()
        (self.root / 'final-review/acceptance.json').unlink()
        self.assertEqual(self.run_publish(), 1)
        self.http.assert_not_called()
        self.assertEqual(self.draft.read_text(), self.before)

    def test_self_declared_approved_flag_is_not_acceptance(self):
        self.enable()
        (self.root / 'final-review/acceptance.json').write_text('{"approved": true}')
        self.assertEqual(self.run_publish(), 1)
        self.http.assert_not_called()

    def test_receipts_and_review_evidence_are_all_verified(self):
        import json
        path = self.root / 'final-review/acceptance.json'
        mutations = [
            lambda a: a['receipts']['editor'].update(actual_model='foreign-model'),
            lambda a: a['receipts']['verifier'].update(context_id='editor'),
            lambda a: a['receipts']['verifier'].update(process_id=1),
            lambda a: a['receipts']['editor'].update(status='truncated'),
            lambda a: a['receipts']['editor'].update(fresh_context=False),
            lambda a: a['receipts']['editor'].update(prompt_sha256='0' * 64),
            lambda a: a['receipts']['editor'].update(started_at='2020-01-01T00:00:00+00:00'),
            lambda a: a['files']['claims'].update(path='../../draft.md'),
            lambda a: a['files']['final_ru'].update(sha256='0' * 64),
        ]
        for mutate in mutations:
            with self.subTest(mutation=mutate):
                self.enable()
                index = json.loads(path.read_text())
                mutate(index)
                path.write_text(json.dumps(index))
                self.assertEqual(self.run_publish(), 1)
                self.http.assert_not_called()
        # Re-hashing a reject, altered editor candidate, or altered verifier input
        # must not bypass the semantic evidence checks.
        import hashlib
        for artifact, data in [
            ('verifier_response', {'verdict': 'reject', 'blockers': ['facts']}),
            ('editor_response', {'candidate_ru': 'changed', 'candidate_en': 'changed'}),
            ('verifier_prompt', {'final_ru': 'other input'}),
        ]:
            with self.subTest(artifact=artifact):
                self.enable()
                index = json.loads(path.read_text())
                blob = json.dumps(data).encode()
                (path.parent / index['files'][artifact]['path']).write_bytes(blob)
                digest = hashlib.sha256(blob).hexdigest()
                index['files'][artifact]['sha256'] = digest
                role, kind = artifact.split('_')
                index['receipts'][role][kind + '_sha256'] = digest
                path.write_text(json.dumps(index))
                self.assertEqual(self.run_publish(), 1)
                self.http.assert_not_called()

    def test_edited_accepted_draft_is_blocked_before_network(self):
        self.enable()
        self.draft.write_text(self.before.replace('RU body', 'Changed body'))
        self.assertEqual(self.run_publish(), 1)
        self.http.assert_not_called()

    def test_missing_english_draft_does_not_fallback_to_russian(self):
        self.enable()
        (self.root / 'draft.en.md').unlink()
        self.assertEqual(self.run_publish(), 1)
        self.http.assert_not_called()

    def test_missing_auth_disabled_adapter_and_http_endpoint_fail_closed(self):
        for change in ('missing_token', 'disabled', 'http'):
            with self.subTest(change=change):
                self.enable()
                cfg = self.config.return_value['publishing']['platforms']['24go']
                if change == 'missing_token':
                    os.environ.pop('TEST_CMS_TOKEN')
                elif change == 'disabled':
                    cfg['enabled'] = False
                else:
                    cfg['api_base_url'] = 'http://cms.example.test/api/v1/blog'
                self.assertEqual(self.run_publish(), 1)
                self.http.assert_not_called()

    def test_owner_auth_rejection_never_posts(self):
        self.enable()
        self.http.side_effect = [(403, {'detail': 'owner only'})]
        self.assertEqual(self.run_publish(), 1)
        self.assertEqual(self.http.call_count, 1)
        self.assertEqual(self.draft.read_text(), self.before)

    def test_lost_create_or_publish_response_is_reconciled_without_duplicates(self):
        for lost_method in ('POST', 'PUT'):
            with self.subTest(lost_method=lost_method):
                self.enable()
                def lost(url, **kwargs):
                    result = self.backend(url, **kwargs)
                    if kwargs.get('method') == lost_method:
                        raise OSError('response lost after commit')
                    return result
                self.http.side_effect = lost
                self.assertEqual(self.run_publish(), 1)
                self.assertEqual(self.draft.read_text(), self.before)
                self.http.side_effect = self.backend
                self.assertEqual(self.run_publish(), 0)
                self.assertEqual(len(self.posts), 1)
                # Restore actual draft fixture for the next independent scenario.
                self.draft.write_text(self.before)
                (self.root / 'draft.en.md').write_text('---\ntitle: English\nstatus: draft\n---\n' + 'EN body ' * 1000 + '\n')

    def test_slug_collision_never_overwrites_remote_content(self):
        self.enable()
        self.posts.append(dict(slug='test-article', content_ru='Someone else'))
        self.assertEqual(self.run_publish(), 1)
        self.assertFalse(any(c.kwargs.get('method', 'GET') != 'GET' for c in self.http.call_args_list))

    def test_public_soft404_or_wrong_locale_is_not_success_and_retry_is_read_only(self):
        for response in ((200, 'Post not found'), (200, {}), (404, {})):
            with self.subTest(response=response):
                self.enable()
                def bad_public(url, **kwargs):
                    if '?locale=' in url:
                        return response
                    return self.backend(url, **kwargs)
                self.http.side_effect = bad_public
                self.assertEqual(self.run_publish(), 1)
                self.assertEqual(self.draft.read_text(), self.before)
                self.http.reset_mock()
                self.http.side_effect = self.backend
                self.assertEqual(self.run_publish(), 0)
                self.assertFalse(any(c.kwargs.get('method', 'GET') != 'GET' for c in self.http.call_args_list))
                self.draft.write_text(self.before)
                (self.root / 'draft.en.md').write_text('---\ntitle: English\nstatus: draft\n---\n' + 'EN body ' * 1000 + '\n')

    def test_remote_edit_between_reads_blocks_publishing(self):
        self.enable()
        reads = 0
        def changed(url, **kwargs):
            nonlocal reads
            if '/admin/list?' in url:
                reads += 1
                if reads == 3:
                    self.posts[0]['updated_at'] = 'changed'
            return self.backend(url, **kwargs)
        self.http.side_effect = changed
        self.assertEqual(self.run_publish(), 1)
        self.assertIs(self.posts[0]['published'], False)
        self.assertFalse(any(c.kwargs.get('method') == 'PUT' for c in self.http.call_args_list))

    def test_multi_does_not_bypass_failed_primary_editorial_gate(self):
        self.assertEqual(self.module.publish_multi('test-article', 'published', str(self.draft)), 1)
        self.http.assert_not_called()
        self.assertFalse((self.root / 'published').exists())

    def test_missing_configuration_fails_without_local_success(self):
        self.assertEqual(self.run_publish(), 1)
        self.http.assert_not_called()
        self.assertEqual(self.draft.read_text(), self.before)
        self.assertFalse((self.root / 'published').exists())


if __name__ == '__main__':
    unittest.main()
