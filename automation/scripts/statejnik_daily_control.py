#!/usr/bin/env python3
"""Bounded 24go.site local reservation/lock control. No models or publishing."""
import argparse
import datetime as dt
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import signal
import sys
from zoneinfo import ZoneInfo

HOME = Path(__file__).resolve().parent.parent
TOOLS = HOME / 'skills/statejnik/tools'
sys.path.insert(0, str(TOOLS))
from final_review import parse_frontmatter


def identifier(value):
    if not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', value) or len(value) > 100:
        raise ValueError('Invalid literal identifier')
    return value


def today():
    return dt.datetime.now(ZoneInfo('Asia/Bangkok')).date().isoformat()


def process_start(pid):
    return Path(f'/proc/{pid}/stat').read_text().rsplit(')', 1)[1].split()[19]


def store(path, data):
    temporary = path.with_name(path.name + f'.{os.getpid()}.tmp')
    with temporary.open('x') as stream:
        json.dump(data, stream, ensure_ascii=False, indent=2)
        stream.flush()
        os.fsync(stream.fileno())
    os.replace(temporary, path)


def snapshot(work, day):
    pairs = []
    for directory in sorted(work.iterdir()):
        if not directory.is_dir() or directory.name.startswith('.') or directory.name in {'topics', 'tmp'}:
            continue
        paths = [directory / 'draft.md', directory / 'draft.en.md']
        if not any(p.exists() for p in paths):
            if (directory / 'run.json').exists():
                receipt = json.loads((directory / 'run.json').read_text())
                if receipt.get('target_site') in {None, '24go.site'}:
                    pairs.append(dict(slug=directory.name, statuses=['missing', 'missing'], pending=True, created_today=str(receipt.get('editorial_date', '')) == day))
            continue
        metadata = [parse_frontmatter(p.read_text())[0] if p.exists() else {} for p in paths]
        if all(m.get('target_site') and m['target_site'] != '24go.site' for m in metadata):
            continue
        statuses = [m.get('status', 'missing') for m in metadata]
        dates = []
        for entry in metadata:
            date = str(entry.get('editorial_date') or entry.get('created_at') or '')[:10]
            if not date and statuses == ['published', 'published'] and entry.get('published_at'):
                published = dt.datetime.fromisoformat(str(entry['published_at']))
                if published.tzinfo is not None:
                    upper_bound = published.astimezone(ZoneInfo('Asia/Bangkok')).date().isoformat()
                    if upper_bound < day:
                        date = upper_bound
            if not re.fullmatch(r'\d{4}-\d{2}-\d{2}', date) or dt.date.fromisoformat(date).isoformat() > day:
                raise ValueError('Unresolved article date: ' + directory.name)
            dates.append(date)
        pairs.append(dict(slug=directory.name, statuses=statuses, pending=statuses != ['published', 'published'], created_today=day in dates))
    orphan_reservations = []
    known = {pair['slug'] for pair in pairs}
    for path in sorted((work / 'topics').glob('*/24go-site-slot-*.json')):
        reservation = json.loads(path.read_text())
        if reservation.get('slug') in known or str(reservation.get('state', '')).startswith('skipped'):
            continue
        orphan_reservations.append(str(path))
    claim = work / 'topics' / day / '24go-site-slot-1.json'
    return dict(day=day, pending=sum(p['pending'] for p in pairs) + len(orphan_reservations), created_today=sum(p['created_today'] for p in pairs), claim_exists=claim.exists(), pairs=pairs, orphan_reservations=orphan_reservations)


def owner_path(work, run_id):
    return work / '.24go-site-runs' / identifier(run_id) / 'owner.json'


def live_owner(work, run_id):
    path = owner_path(work, run_id)
    owner = json.loads(path.read_text())
    if owner['run_id'] != run_id or owner['state'] != 'held' or owner['day'] != today():
        raise ValueError('No live same-day lock owner')
    if process_start(owner['pid']) != owner['process_start']:
        raise ValueError('Lock owner process changed')
    with (work / '.24go-site-daily.lock').open('a') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return owner
    raise ValueError('Daily lock is not held')


def hold(work, run_id, seconds):
    if not 10 <= seconds <= 7200:
        raise ValueError('Lock duration must be 10..7200 seconds')
    path = owner_path(work, run_id)
    with (work / '.24go-site-daily.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        path.parent.mkdir(parents=True, exist_ok=False)
        signals = {signal.SIGUSR1, signal.SIGTERM, signal.SIGINT}
        previous = signal.pthread_sigmask(signal.SIG_BLOCK, signals)
        owner = dict(run_id=run_id, state='held', pid=os.getpid(), process_start=process_start(os.getpid()), day=today(), expires_at=(dt.datetime.now(dt.timezone.utc) + dt.timedelta(seconds=seconds)).isoformat())
        try:
            store(path, owner)
            print(json.dumps(owner), flush=True)
            received = signal.sigtimedwait(signals, seconds)
            owner['state'] = 'released' if received and received.si_signo == signal.SIGUSR1 else 'expired_or_terminated'
        finally:
            if owner['state'] == 'held':
                owner['state'] = 'failed'
            store(path, owner)
            signal.pthread_sigmask(signal.SIG_SETMASK, previous)
    return owner


def reserve(work, run_id, slug):
    owner = live_owner(work, run_id)
    identifier(slug)
    state = snapshot(work, owner['day'])
    if state['pending'] >= 3 or state['created_today'] or state['claim_exists']:
        raise ValueError('Backlog or daily claim prevents new generation')
    if (work / slug).exists():
        raise ValueError('Slug directory already exists')
    path = work / 'topics' / owner['day'] / '24go-site-slot-1.json'
    path.parent.mkdir(parents=True, exist_ok=True)
    claim = dict(state='reserved', run_id=run_id, slug=slug, editorial_date=owner['day'], target_site='24go.site', keeper_pid=owner['pid'])
    with path.open('x') as stream:
        json.dump(claim, stream, indent=2)
        stream.flush()
        os.fsync(stream.fileno())
    live_owner(work, run_id)
    return claim


def finish(work, run_id, state):
    owner = live_owner(work, run_id)
    path = work / 'topics' / owner['day'] / '24go-site-slot-1.json'
    claim = json.loads(path.read_text())
    if claim['run_id'] != run_id or claim['state'] != 'reserved':
        raise ValueError('Reservation does not belong to this live run')
    if state not in {'review_created', 'blocked'}:
        raise ValueError('Invalid completion state')
    hashes = {}
    if state == 'review_created':
        for locale, name in [('ru', 'draft.md'), ('en', 'draft.en.md')]:
            draft = work / identifier(claim['slug']) / name
            metadata, _ = parse_frontmatter(draft.read_text())
            expected = dict(status='review', target_site='24go.site', locale=locale, slug=claim['slug'], editorial_date=owner['day'])
            if any(str(metadata.get(key)) != value for key, value in expected.items()):
                raise ValueError('Review draft does not match reservation')
            hashes[name] = hashlib.sha256(draft.read_bytes()).hexdigest()
    claim.update(state=state, hashes=hashes)
    store(path, claim)
    release(work, run_id)
    return claim


def release(work, run_id):
    owner = live_owner(work, run_id)
    os.kill(owner['pid'], signal.SIGUSR1)
    return dict(run_id=run_id, state='release_requested')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['inspect', 'hold', 'reserve', 'finish', 'release'])
    parser.add_argument('--run-id')
    parser.add_argument('--slug')
    parser.add_argument('--seconds', type=int, default=3600)
    parser.add_argument('--state', choices=['review_created', 'blocked'])
    args = parser.parse_args()
    work = HOME / 'skills/statejnik/work'
    if args.action == 'inspect':
        result = snapshot(work, today())
    else:
        if not args.run_id:
            parser.error('--run-id required')
        if args.action == 'hold':
            result = hold(work, args.run_id, args.seconds)
        elif args.action == 'reserve':
            if not args.slug:
                parser.error('--slug required')
            result = reserve(work, args.run_id, args.slug)
        elif args.action == 'finish':
            if not args.state:
                parser.error('--state required')
            result = finish(work, args.run_id, args.state)
        else:
            result = release(work, args.run_id)
    print(json.dumps(result, ensure_ascii=False))


if __name__ == '__main__':
    main()
