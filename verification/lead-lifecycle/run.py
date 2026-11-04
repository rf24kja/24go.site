from pathlib import Path
import json,subprocess,sys,time
R=Path(__file__).parent;phase=sys.argv[1];assert phase in ['baseline','candidate','exact']
image=(json.loads((R/'BASELINE.json').read_text())['image'] if phase=='baseline' else json.loads((R/'BASELINE.json').read_text())['image'])
if phase=='exact':image=json.loads((R/'IMAGE.json').read_text())['image']
def run(*args):return subprocess.check_output(args,text=True,stderr=subprocess.STDOUT).strip()
socket=R/'pgsocket';socket.mkdir(exist_ok=True);socket.chmod(0o1777);name='24go-lead-v57-isolated-postgres'
assert not run('docker','ps','-a','--filter','name=^/'+name+'$','--format','{{.Names}}')
try:
 run('docker','run','--pull','never','-d','--name',name,'--network','none','--memory','256m','--cpus','1','--pids-limit','100','--tmpfs','/var/lib/postgresql/data:rw,size=128m','-v',str(socket)+':/var/run/postgresql:rw','-e','POSTGRES_USER=fixture','-e','POSTGRES_DB=fixture','-e','POSTGRES_HOST_AUTH_METHOD=trust','postgres:16-alpine','postgres','-c','listen_addresses=')
 for attempt in range(150):
  ready=subprocess.run(['docker','exec',name,'pg_isready','-h','/var/run/postgresql','-U','fixture','-d','fixture'],capture_output=True)
  if ready.returncode==0 and 'PostgreSQL init process complete' in run('docker','logs',name):break
  time.sleep(.2)
 else:raise RuntimeError('Disposable PostgreSQL startup failed')
 cmd=['docker','run','--pull','never','--rm','--network','none','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges','--pids-limit','128','--memory','512m','--cpus','1','--tmpfs','/tmp:rw,noexec,nosuid,size=32m','--workdir','/tmp','-e','PYTHONDONTWRITEBYTECODE=1','-e','PYTHONPATH=/app:/harness','-e','JWT_SECRET=synthetic-shared-v45-offline-only','-e','DATABASE_URL=postgresql+asyncpg://fixture@/fixture?host=/fixture','-e','REDIS_URL=redis://127.0.0.1:1/15','-e','CELERY_BROKER_URL=memory://','-e','SENTRY_DSN=','-e','ENVIRONMENT=test','-e','APP_ENV=test','-v',str(socket)+':/fixture:rw','-v',str(R/'harness')+':/harness:ro']
 if phase=='candidate':cmd+=['-v',str(R/'candidate/leads.py')+':/app/app/routers/leads.py:ro']
 cmd += [image,'python','/harness/test_lead_lifecycle.py']+sys.argv[2:]
 result=subprocess.run(cmd,capture_output=True,text=True,timeout=120)
 (R/('receipts/'+phase+'.log')).write_text(result.stdout+result.stderr)
 (R/('receipts/'+phase+'.json')).write_text(json.dumps({'phase':phase,'image':image,'exit':result.returncode,'application_overlay':phase=='candidate','provider_requests':'synthetic mocks only','database':'disposable fixture Unix socket'},indent=2)+'\n')
 print((result.stdout+result.stderr)[-20000:]);print('INNER_EXIT',result.returncode)
finally:
 cleanup=subprocess.run(['docker','rm','-f',name],capture_output=True);assert cleanup.returncode==0
raise SystemExit(result.returncode)
