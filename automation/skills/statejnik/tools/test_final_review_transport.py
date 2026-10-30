"""Transport fixtures exercise provider response IDs, truncation and no-history input."""
import json
import unittest
from types import SimpleNamespace as NS
from unittest.mock import Mock
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

class TransportTests(unittest.TestCase):
    def test_raw_provider_receipt_not_requested_model(self):
        import final_review_worker as worker
        create = Mock(return_value=NS(id='provider-request-123', model='actual-other',
                      choices=[NS(finish_reason='stop', message=NS(content='{"verdict":"accept","blockers":[]}', tool_calls=None, refusal=None))]))
        client = NS(chat=NS(completions=NS(create=create)))
        response, identity = worker.complete(client, 'chat_completions', 'requested', 'system', {'tools':[], 'author_history':False})
        self.assertEqual(identity, ('actual-other', 'provider-request-123'))
        kwargs = create.call_args.kwargs
        self.assertEqual([m['role'] for m in kwargs['messages']], ['system', 'user'])
        self.assertEqual(kwargs['response_format'], {'type':'json_object'})
        self.assertNotIn('tools', kwargs)
        self.assertEqual(json.loads(kwargs['messages'][1]['content']), {'tools':[], 'author_history':False})

    def test_native_openai_client_identity_is_accepted(self):
        import final_review_worker as worker
        from unittest.mock import patch
        class RawClient:
            pass
        RawClient.__module__ = 'openai'
        runtime = dict(provider='openrouter', api_mode='chat_completions', api_key='fixture-not-secret')
        request = dict(provider='openrouter', model='editor', system='system', prompt={})
        raw_client=RawClient()
        with patch('hermes_cli.runtime_provider.resolve_runtime_provider', return_value=runtime), patch(
                'agent.auxiliary_client.resolve_provider_client', return_value=(raw_client, 'editor')), patch.object(
                worker, 'complete', return_value=({'candidate_ru':'RU','candidate_en':'EN'}, ('editor','provider-id'))):
            result = worker.execute(request)
        self.assertEqual(result['receipt']['request_id'], 'provider-id')
        self.assertEqual(raw_client.max_retries, 0)

    def test_malformed_response_retains_raw_provider_evidence(self):
        import final_review_worker as worker
        import tempfile
        create = Mock(return_value=NS(id='provider-id', model='actual', choices=[NS(finish_reason='stop',
            message=NS(content='not json', tool_calls=None, refusal=None))]))
        client = NS(chat=NS(completions=NS(create=create)))
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder)/'provider.json'
            with self.assertRaises(json.JSONDecodeError):
                worker.complete(client, 'chat_completions', 'requested', 'system', {}, evidence_path=path)
            raw = json.loads(path.read_text())
            self.assertEqual(raw['actual_model'], 'actual')
            self.assertEqual(raw['text'], 'not json')

    def test_codex_uses_typed_input_and_retains_done_messages(self):
        import final_review_worker as worker
        class Stream:
            def __iter__(self):
                yield NS(type='response.output_item.done', item=NS(type='message', role='assistant',
                    content=[NS(type='output_text',text='{"verdict":"accept","blockers":[]}')]))
                yield NS(type='response.completed', response=NS(status='completed',id='real-id',model='actual',error=None,output=None))
            def close(self):
                pass
        create=Mock(return_value=Stream())
        response, identity=worker.complete(NS(responses=NS(create=create)), 'codex_responses','requested','system',{})
        self.assertEqual(identity,('actual','real-id'))
        self.assertEqual(response['verdict'],'accept')
        self.assertEqual(create.call_args.kwargs['input'][0]['content'][0]['type'],'input_text')

    def test_truncation_refusal_tools_missing_identity_fail_closed(self):
        import final_review_worker as worker
        variants=[('length','actual','id',None,None),('stop','','id',None,None),
                  ('stop','actual','',None,None),('stop','actual','id',[{}],None),
                  ('stop','actual','id',None,'refusal')]
        for finish,model,request_id,tools,refusal in variants:
            with self.subTest(finish=finish,model=model,request_id=request_id,tools=tools,refusal=refusal):
                client=NS(chat=NS(completions=NS(create=Mock(return_value=NS(id=request_id,model=model,
                    choices=[NS(finish_reason=finish,message=NS(content='{}',tool_calls=tools,refusal=refusal))])))))
                with self.assertRaises(worker.TransportError):
                    worker.complete(client,'chat_completions','requested','system',{})

if __name__ == '__main__':
    unittest.main()
