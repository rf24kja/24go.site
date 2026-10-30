"""Single-request worker using Hermes' native provider router; no agent/session/tools."""
from contextlib import redirect_stdout, redirect_stderr
from datetime import datetime, timezone
import io
import json
import logging
import os
from pathlib import Path
import sys
from uuid import uuid4


class TransportError(ValueError):
    pass


def complete(client, mode, model, system, prompt, *, evidence_path=None):
    user = json.dumps(prompt, sort_keys=True, ensure_ascii=False, separators=(',', ':'))
    if mode == 'chat_completions':
        final = client.chat.completions.create(model=model, messages=[dict(role='system', content=system),
                                                     dict(role='user', content=user)], response_format={'type': 'json_object'}, timeout=240)
        if len(final.choices) != 1:
            raise TransportError('Expected one completion')
        choice = final.choices[0]
        if (choice.finish_reason != 'stop' or getattr(choice.message, 'tool_calls', None)
                or getattr(choice.message, 'refusal', None)):
            raise TransportError('Incomplete/refused/tool response')
        text = choice.message.content
    elif mode == 'codex_responses':
        final = None
        done = []
        stream = client.responses.create(model=model, instructions=system,
                    input=[dict(role='user', content=[dict(type='input_text', text=user)])], store=False, stream=True, timeout=240)
        try:
            for event in stream:
                if event.type == 'response.completed':
                    final = event.response
                elif event.type == 'response.output_item.done':
                    done.append(event.item)
                elif event.type in ('response.failed', 'response.incomplete', 'error'):
                    raise TransportError('Provider response failed/incomplete')
        finally:
            stream.close()
        if final is None or final.status != 'completed' or getattr(final, 'error', None):
            raise TransportError('No completed provider response')
        output = final.output or done
        if any(item.type not in ('message', 'reasoning') for item in output):
            raise TransportError('Unexpected provider output')
        text = ''.join(part.text for item in output if item.type == 'message'
                       for part in item.content if part.type == 'output_text')
    else:
        raise TransportError('Unsupported raw response surface')
    actual, request_id = getattr(final, 'model', None), getattr(final, 'id', None)
    if not actual or not request_id:
        raise TransportError('Provider omitted actual model/request ID')
    if evidence_path is not None:
        evidence_path.write_text(json.dumps(dict(actual_model=actual, request_id=request_id, text=text), ensure_ascii=False))
    response = json.loads(text)
    if not isinstance(response, dict):
        raise TransportError('Expected JSON object')
    return response, (actual, request_id)


def execute(request, *, evidence_path=None):
    # These are the shipped provider APIs, not credential readers. No auto/task fallback.
    from hermes_cli.runtime_provider import resolve_runtime_provider
    from agent.auxiliary_client import resolve_provider_client
    provider, model = request['provider'], request['model']
    if not provider or provider in ('auto', 'moa') or not model:
        raise TransportError('Explicit concrete provider/model required')
    runtime = resolve_runtime_provider(requested=provider, target_model=model)
    mode = runtime.get('api_mode') or 'chat_completions'
    if runtime['provider'] != provider or mode not in ('chat_completions', 'codex_responses'):
        raise TransportError('Provider alias/fallback or unsupported raw receipt surface')
    client, resolved = resolve_provider_client(provider, model=model, raw_codex=True,
        explicit_api_key=runtime.get('api_key'), explicit_base_url=runtime.get('base_url'), api_mode=mode)
    if client is None or resolved != model:
        raise TransportError('Requested model unavailable; no fallback')
    # A normalized adapter can echo the requested ID and discard provider IDs. Never use it as proof.
    if type(client).__module__ != 'openai' and not type(client).__module__.startswith('openai.'):
        raise TransportError('Raw SDK response required for provider-attested identity')
    client.max_retries = 0
    started = datetime.now(timezone.utc).isoformat()
    response, (actual, request_id) = complete(client, mode, model, request['system'], request['prompt'], evidence_path=evidence_path)
    finished = datetime.now(timezone.utc).isoformat()
    if actual != model:
        raise TransportError('Unexpected actual model ID; no fallback')
    receipt = dict(provider=runtime['provider'], requested_model=model, actual_model=actual,
                   status='completed', fresh_context=True, tools=[], context_id=str(uuid4()),
                   process_id=str(os.getpid()), request_id=request_id, started_at=started, finished_at=finished)
    return dict(response=response, receipt=receipt)


def main():
    logging.disable(logging.CRITICAL)
    try:
        request = json.loads(Path(sys.argv[1]).read_bytes())
        # Suppress third-party diagnostics (may include endpoint credentials). Never persist exceptions.
        with redirect_stdout(io.StringIO()), redirect_stderr(io.StringIO()):
            result = execute(request, evidence_path=Path(sys.argv[1]).with_suffix('.provider.json'))
        print(json.dumps(result, ensure_ascii=False, sort_keys=True, separators=(',', ':')))
        return 0
    except Exception as exc:
        error = dict(error=type(exc).__name__)
        if isinstance(exc, TransportError):
            error['reason'] = str(exc)
        print(json.dumps(error), file=sys.stderr)
        return 2


if __name__ == '__main__':
    sys.exit(main())
