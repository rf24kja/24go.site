"""Run privately on server; dedicated Web export only, never credentials in argv/chat."""
import argparse, fcntl, json, os, stat, tempfile
from pathlib import Path
CALLBACK = 'https://www.24go.site/YT/callback'

def private(path):
 p=Path(path)
 if p.is_symlink() or not p.is_file() or p.stat().st_mode & 0o077 or p.parent.stat().st_mode & 0o077:
  raise ValueError('private directory and regular file required')
 return json.loads(p.read_text())

def install(config_path, google_path, enable=False):
 from yt_runtime import validate_config
 p=Path(config_path)
 private(p)
 web=private(google_path).get('web',{})
 if web.get('redirect_uris')!=[CALLBACK] or web.get('auth_uri')!='https://accounts.google.com/o/oauth2/auth' or web.get('token_uri')!='https://oauth2.googleapis.com/token':
  raise ValueError('Dedicated Web export with exact callback/endpoints required')
 secret=web.get('client_secret','')
 if not isinstance(secret,str) or len(secret)<16 or any(c.isspace() for c in secret):raise ValueError('secret')
 lock=os.open(p.parent/'.oauth-config.lock',os.O_CREAT|os.O_RDWR|os.O_NOFOLLOW,0o600)
 with os.fdopen(lock,'w') as guard:
  fcntl.flock(guard,fcntl.LOCK_EX)
  cfg=private(p);validate_config(cfg)
  if cfg.get('posting_enabled',False) or cfg.get('monitoring_enabled',cfg.get('external_enabled',False)):
   raise ValueError('Monitoring and posting must remain off')
  cfg.update(client_id=web.get('client_id'),client_secret_file='/run/yt/oauth-client-secret',redirect_uri=CALLBACK,
             external_enabled=False,oauth_enabled=bool(enable),monitoring_enabled=False,posting_enabled=False)
  validate_config(cfg)
  dest=p.parent/'oauth-client-secret'
  # Idempotent retry only when the protected secret is byte-identical.
  if dest.exists():
   if dest.is_symlink() or dest.stat().st_mode & 0o077 or dest.read_text()!=secret:raise ValueError('Existing secret differs')
  else:
   fd=os.open(dest,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
   with os.fdopen(fd,'w') as stream:stream.write(secret);stream.flush();os.fsync(stream.fileno())
  fd,tmp=tempfile.mkstemp(prefix='.config-',dir=p.parent)
  try:
   with os.fdopen(fd,'w') as stream:json.dump(cfg,stream);stream.write('\n');stream.flush();os.fsync(stream.fileno())
   os.replace(tmp,p)
   d=os.open(p.parent,os.O_DIRECTORY);os.fsync(d);os.close(d)
  finally:
   if os.path.exists(tmp):os.unlink(tmp)
 return {'updated':True,'oauth_enabled':bool(enable),'monitoring_enabled':False,'posting_enabled':False}

if __name__=='__main__':
 import sys
 if '--shared-runtime-maintenance' not in sys.argv:
  raise SystemExit('Tenant onboarding: https://www.24go.site/YT/settings (organization owner/admin). No SSH/shared configuration required. This legacy helper is maintenance-only; explicit --shared-runtime-maintenance is required and does not configure a tenant client.')
 sys.argv.remove('--shared-runtime-maintenance')
 a=argparse.ArgumentParser(description=__doc__);a.add_argument('--runtime-config',required=True);a.add_argument('--google-json',required=True);a.add_argument('--dedicated-24go-youtube-client',action='store_true',required=True);a.add_argument('--enable-oauth',action='store_true');x=a.parse_args()
 try: print(json.dumps(install(x.runtime_config,x.google_json,x.enable_oauth)))
 except (ValueError,OSError,TypeError,KeyError):a.exit(1,'Rejected private configuration/client; no secret values reported.\n')
