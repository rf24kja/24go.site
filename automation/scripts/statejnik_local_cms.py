#!/usr/bin/env python3
"""Scoped local CMS broker. Credentials exist only in the native backend worker."""
import argparse
import base64
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import shlex
import subprocess
import sys
import tempfile

TOOLS = Path(__file__).resolve().parent.parent / 'skills/statejnik/tools'
sys.path.insert(0, str(TOOLS))
from _cms24go import editorial_gate, payload_for, atomic_write
from final_review import parse_frontmatter as parse
from _config import load_config

EXPECTED = dict(auth_mode='local_backend', backend_container='generator-ad-fastapi-1',
                owner_user_id='a8563833-75dd-469a-8261-0c77e87e0196',
                owner_tenant_id='2459d2f2-3e55-4869-9646-78b0a22f5c67',
                api_base_url='https://api.24go.site/api/v1/blog',
                site_url='https://www.24go.site')


def scope(config):
    cfg = config.get('publishing', {}).get('platforms', {}).get('24go', {})
    if any(cfg.get(k) != v for k, v in EXPECTED.items()):
        raise ValueError('Explicit local backend scope required')
    return cfg


def preflight(config, draft, allow_disabled=False):
    cfg = scope(config)
    if cfg.get('enabled') is not True and not (allow_disabled and cfg.get('enabled') is False):
        raise ValueError('Publication disabled')
    draft = Path(draft)
    if (not draft.is_absolute() or draft != draft.resolve() or draft.name != 'draft.md'
            or not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', draft.parent.name)):
        raise ValueError('Unsafe source path')
    paths = [draft, draft.with_name('draft.en.md')]
    for p in paths:
        if p.is_symlink() or not p.is_file():
            raise ValueError('Unsafe draft')
    payload = payload_for(draft.parent.name, *(p.read_text() for p in paths), parse)
    from _article_length import require_body_lengths
    require_body_lengths(payload)
    acceptance = editorial_gate(draft, payload, config['qa']['final_review'], parse)
    index_path = draft.parent/'final-review/acceptance.json'
    index = json.loads(index_path.read_bytes())
    paths.append(index_path)
    root = index_path.parent
    for item in index['files'].values():
        p = root/item['path']
        if p.is_symlink() or p != p.resolve() or not p.is_relative_to(root):
            raise ValueError('Unsafe evidence path')
        paths.append(p)
    files = {str(p):base64.b64encode(p.read_bytes()).decode() for p in paths}
    return dict(source=str(draft), payload=payload, acceptance=acceptance, files=files,
                config={'publishing':{'platforms':{'24go':{k:cfg[k] for k in (*EXPECTED, 'enabled')}}},
                        'qa':{'final_review':{k:config['qa']['final_review'][k] for k in
                              ('author_model','editor_model','verifier_model','max_age_hours')}}})


def root_job(directory):
    """Root-only Docker bridge. No credentials are arguments or output."""
    import shutil
    directory = Path(directory)
    container = EXPECTED['backend_container']
    remote = '/tmp/statejnik-' + directory.name
    def docker(*args, check=True):
        return subprocess.run(['docker', *args], stdout=subprocess.DEVNULL,
                              stderr=subprocess.DEVNULL, check=check)
    created = False
    try:
        docker('exec', container, 'mkdir', '-m', '700', remote)
        created = True
        docker('cp', str(directory)+'/.', container+':'+remote)
        docker('exec', '-w', remote, '-e', 'PYTHONPATH=/app:'+remote, container,
               'python', remote+'/local_cms_worker.py', remote+'/job.json', remote+'/result.json', check=False)
        docker('cp', container+':'+remote+'/result.json', str(directory/'result.json'))
        os.chown(directory/'result.json', directory.stat().st_uid, directory.stat().st_gid)
    finally:
        if created:
            docker('exec', container, 'python', '-c',
                   'import shutil; shutil.rmtree('+repr(remote)+')')
    # Written only after worker completion AND successful private staging removal.
    (directory/'bridge-ok').write_text('cleaned')
    os.chown(directory/'bridge-ok', directory.stat().st_uid, directory.stat().st_gid)


def dispatch(job):
    import shutil
    with tempfile.TemporaryDirectory(prefix='cms-', dir=os.environ.get('TMPDIR')) as directory:
        root = Path(directory)
        (root/'job.json').write_text(json.dumps(job))
        for name in ('local_cms_worker.py', '_cms24go.py', '_editor_patches.py', '_article_length.py', 'final_review.py', '_config.py'):
            shutil.copyfile(TOOLS/name, root/name)
        shutil.copyfile(Path(__file__), root/'statejnik_local_cms.py')
        command = shlex.join([sys.executable, str(Path(__file__).resolve()), '--root-job', directory])
        helper = Path.home()/'run_as_root.py'
        # The approved helper captures PTY chatter; never replay it into logs.
        subprocess.run([sys.executable, str(helper), command, '600'],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
        if (root/'bridge-ok').read_text() != 'cleaned':
            raise ValueError('Bridge cleanup unconfirmed')
        result = json.loads((root/'result.json').read_text())
        if result.get('status') != 'verified':
            raise ValueError('Unconfirmed delivery')
        expected_actor = dict(user_id=EXPECTED['owner_user_id'],tenant_id=EXPECTED['owner_tenant_id'],role='owner')
        if result.get('actor') != expected_actor:
            raise ValueError('Actor mismatch')
        return result


def verify_copyback(job, result, transport=None):
    from local_cms_worker import request
    transport = transport or request
    draft = Path(job['source'])
    for name, encoded in job['files'].items():
        if Path(name).read_bytes() != base64.b64decode(encoded):
            raise ValueError('Host accepted version changed')
    files = result['files']
    expected_paths = {str(draft), str(draft.with_name('draft.en.md'))}
    if set(files) != expected_paths or payload_for(draft.parent.name, files[str(draft)], files[str(draft.with_name('draft.en.md'))], parse) != job['payload']:
        raise ValueError('Copyback payload mismatch')
    checkpoint = None
    from datetime import datetime, timezone
    from _cms24go import with_fields
    for name, text in files.items():
        meta, _ = parse(text)
        if meta.get('status') != 'published' or meta.get('cms_24go_acceptance_sha256') != job['acceptance']:
            raise ValueError('Copyback checkpoint mismatch')
        from uuid import UUID
        UUID(meta['cms_24go_id'])
        observed = datetime.fromisoformat(meta['published_at'])
        if not observed.tzinfo or observed > datetime.now(timezone.utc):
            raise ValueError('Invalid publication observation')
        common = {k:meta[k] for k in ('status','cms_24go_id','cms_24go_acceptance_sha256','published_at')}
        if checkpoint is not None and common != checkpoint:
            raise ValueError('Inconsistent bilingual checkpoint')
        checkpoint = common
        ru_url = EXPECTED['site_url']+'/blog/'+draft.parent.name+'?locale=ru'
        en_url = EXPECTED['site_url']+'/blog/'+draft.parent.name+'?locale=en'
        fields = dict(common, canonical_url=ru_url,canonical_url_en=en_url) if name == str(draft) else dict(common,canonical_url=en_url)
        original = base64.b64decode(job['files'][name]).decode()
        if text != with_fields(original, fields):
            raise ValueError('Copyback changed non-checkpoint data')
    for locale in ('ru','en'):
        code, public = transport(EXPECTED['api_base_url']+'/'+draft.parent.name+'?locale='+locale)
        expected = {k:job['payload'][k] for k in ('slug','tags','og_image_url')}
        expected.update({k:job['payload'][k+'_'+locale] for k in ('title','content','excerpt','meta_description')})
        if code != 200 or not isinstance(public,dict) or any(public.get(k) != v for k,v in expected.items()):
            raise ValueError('Host public readback mismatch')
    # Recheck after network I/O before committing any host checkpoint.
    for name, encoded in job['files'].items():
        if Path(name).read_bytes() != base64.b64decode(encoded):
            raise ValueError('Host changed during readback')
    for name,text in files.items():
        atomic_write(Path(name),text)


def run(config, draft=None, probe=False, dry_run=False):
    if probe:
        cfg = scope(config)
        job = {'probe':True,'config':{'publishing':{'platforms':{'24go':{k:cfg[k] for k in EXPECTED}}}}}
        if dry_run:
            raise ValueError('Use dry-run with a draft')
    else:
        job = preflight(config,draft,allow_disabled=dry_run)
        if dry_run:
            return dict(status='dry-run',slug=job['payload']['slug'])
    # A single broker flock serializes probes/delivery without touching other services.
    lock_path = Path(__file__).with_suffix('.lock')
    with lock_path.open('a') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        if not probe:
            job = preflight(config,draft)
        result = dispatch(job)
        if not probe:
            verify_copyback(job,result)
    return dict(status='verified',actor=result['actor'])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config'); parser.add_argument('--probe', action='store_true')
    parser.add_argument('--dry-run',action='store_true'); parser.add_argument('draft',nargs='?')
    parser.add_argument('--root-job',help=argparse.SUPPRESS)
    args = parser.parse_args()
    try:
        if args.root_job:
            if os.geteuid() != 0:
                raise ValueError('Root bridge only')
            root_job(args.root_job)
            return 0
        if not args.config or not Path(args.config).is_absolute() or (not args.probe and not args.draft):
            raise ValueError('Explicit absolute config and draft required')
        result = run(load_config(args.config), args.draft, args.probe,args.dry_run)
        print(json.dumps(result))
        return 0
    except Exception:
        print('{"status":"unconfirmed","error":"scope, gate, transport or checkpoint failed"}')
        return 1

if __name__ == '__main__':
    sys.exit(main())
