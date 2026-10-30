from pathlib import Path
import json,os,subprocess,sys,time
R=Path(__file__).parent
phase='exact'
image=sys.argv[1]
assert __import__('re').fullmatch(r'[A-Za-z0-9][A-Za-z0-9_./:@-]*',image)
(R/'receipts').mkdir(exist_ok=True)
def run(*args):return subprocess.check_output(args,text=True,stderr=subprocess.STDOUT).strip()
socket=R/'pgsocket';socket.mkdir(exist_ok=True);socket.chmod(0o1777)
name='24go-v37-isolated-postgres'
assert not run('docker','ps','-a','--filter','name=^/'+name+'$','--format','{{.Names}}')
try:
    run('docker','run','--pull','never','-d','--name',name,'--network','none','--memory','256m','--cpus','1','--pids-limit','100','--tmpfs','/var/lib/postgresql/data:rw,size=128m','-v',f'{socket}:/var/run/postgresql:rw','-e','POSTGRES_USER=fixture','-e','POSTGRES_DB=fixture','-e','POSTGRES_HOST_AUTH_METHOD=trust','postgres:16-alpine','postgres','-c','listen_addresses=')
    for i in range(150):
        ready=subprocess.run(['docker','exec',name,'pg_isready','-h','/var/run/postgresql','-U','fixture','-d','fixture'],capture_output=True)
        if ready.returncode==0 and 'PostgreSQL init process complete' in run('docker','logs',name):break
        time.sleep(0.2)
    else:
        logs=run('docker','logs',name)
        (R/'receipts/postgres-startup.log').write_text(logs)
        raise RuntimeError('Isolated Postgres did not become ready: '+logs[-5000:])
    cmd=['docker','run','--pull','never','--rm','--network','none','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges','--pids-limit','128','--memory','512m','--cpus','1','--tmpfs','/tmp:rw,noexec,nosuid,size=32m','--workdir','/tmp','-e','PYTHONDONTWRITEBYTECODE=1','-e','PYTHONPATH=/app:/harness','-e','JWT_SECRET=synthetic-v37-offline-only','-e','DATABASE_URL=postgresql+asyncpg://fixture@/fixture?host=/fixture','-e','REDIS_URL=redis://127.0.0.1:1/15','-e','CELERY_BROKER_URL=memory://','-e','SENTRY_DSN=','-v',f'{socket}:/fixture:rw','-v',f'{R}:/harness:ro']
    cmd +=['-e','ENVIRONMENT=test','-e','APP_ENV=test',image,'python','/harness/test_lead_ownership.py']+sys.argv[2:]
    p=subprocess.run(cmd,capture_output=True,text=True,timeout=110)
    (R/f'receipts/{phase}.log').write_text(p.stdout+p.stderr)
    (R/f'receipts/{phase}.json').write_text(json.dumps({'phase':phase,'exit':p.returncode,'command':cmd,'postgres':'disposable16, unix-socket only, tmpfs, network none'},indent=2))
    print((p.stdout+p.stderr)[-18000:]);print('INNER_EXIT',p.returncode)
finally:
    cleanup=subprocess.run(['docker','rm','-f',name],capture_output=True)
    assert cleanup.returncode==0
sys.exit(p.returncode)
