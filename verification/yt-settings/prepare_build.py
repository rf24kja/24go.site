"""Prepare verified frontend inputs, never compile/deploy from stale /opt sources."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
ROOT=Path(__file__).resolve().parents[2]
def prepare(destination):
    manifest=json.loads((Path(__file__).parent/'accepted-source.json').read_text())
    prefix='services/dashboard/'
    files={p:h for p,h in manifest['files'].items() if p.startswith(prefix)}
    for p,h in files.items():
        actual=hashlib.sha256((ROOT/p).read_bytes()).hexdigest()
        if actual not in {h,manifest.get('git_files',{}).get(p,h)}:
            raise RuntimeError('unaccepted source: '+p)
    destination.mkdir(parents=True,exist_ok=False)
    for p in files:
        # red.config.ts is a historical candidate-only cache config, not a build input.
        if p.endswith('/red.config.ts'):continue
        target=destination/p[len(prefix):]
        target.parent.mkdir(parents=True,exist_ok=True)
        shutil.copyfile(ROOT/p,target)
    (destination/'SOURCE_IDENTITY.json').write_text(json.dumps({'source':'release/installed-yt-settings','accepted_build_id':manifest['build_id'],'compiled':False,'inputs':{p:hashlib.sha256((ROOT/p).read_bytes()).hexdigest() for p in files}},indent=2)+'\n')
    print('PREPARED verified frontend context; dependencies/build/exact-image acceptance still required')
if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('destination',type=Path)
    prepare(parser.parse_args().destination)
