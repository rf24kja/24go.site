import contextlib,importlib.util,io,json,sys,unittest
from pathlib import Path
from unittest.mock import patch
from urllib.error import HTTPError,URLError

source=Path(sys.argv.pop(1)) if len(sys.argv)>1 and not sys.argv[1].startswith('-') else Path(__file__).resolve().parents[2]/'automation/scripts/refresh_blogger_token.py'
spec=importlib.util.spec_from_file_location('blogger_maintenance_fixture',source);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class Response:
    def __init__(self,value):self.value=value
    def __enter__(self):return self
    def __exit__(self,*args):pass
    def read(self):return json.dumps(self.value).encode()

class Maintenance(unittest.TestCase):
    def run_main(self,error):
        env={'BLOGGER_CLIENT_ID':'fixture-client','BLOGGER_CLIENT_SECRET':'fixture-sensitive-client','BLOGGER_REFRESH_TOKEN':'fixture-sensitive-refresh'}
        out=io.StringIO()
        with patch.object(m,'load_env',return_value=env),patch.object(m,'is_token_valid',return_value=False),patch.object(m.urllib.request,'urlopen',side_effect=error),patch.object(m,'save_env') as save,contextlib.redirect_stdout(out):
            code=m.main();save.assert_not_called()
        self.assertEqual(code,1);self.assertNotIn('fixture-sensitive',out.getvalue());return out.getvalue()
    def test_validation_never_places_access_token_in_a_url(self):
        seen=[]
        def get(request,**kwargs):seen.append(request);return Response({'kind':'blogger#blogList','items':[]})
        with patch.object(m.urllib.request,'urlopen',side_effect=get):result=m.is_token_valid('fixture-sensitive-access')
        self.assertNotIn('fixture-sensitive-access',seen[0].full_url)
        self.assertEqual(seen[0].get_header('Authorization'),'Bearer fixture-sensitive-access')
        self.assertEqual(seen[0].full_url,'https://www.googleapis.com/blogger/v3/users/self/blogs')
        self.assertTrue(result)
    def test_network_error_is_not_invented_oauth_rejection(self):
        out=self.run_main(URLError('fixture-sensitive-network'))
        self.assertNotIn('unauthorized_client',out);self.assertIn('network_error',out)
        self.assertNotIn('blogger_setup.py',out)
    def test_actual_oauth_error_is_classified_without_raw_description(self):
        error=HTTPError('https://oauth2.googleapis.com/token',400,'bad request',{},io.BytesIO(json.dumps({'error':'invalid_grant','error_description':'fixture-sensitive-provider-body'}).encode()))
        out=self.run_main(error)
        self.assertIn('invalid_grant',out);self.assertNotIn('unauthorized_client',out)
        self.assertIn('blogger_authorize_loopback.py',out)
    def test_http_503_is_not_invented_client_mismatch(self):
        body=io.BytesIO(b'{"error":"server_error"}')
        error=HTTPError('https://oauth2.googleapis.com/token',503,'unavailable',{},body)
        out=self.run_main(error)
        self.assertIn('503',out);self.assertIn('server_error',out)
        self.assertNotIn('unauthorized_client',out)
        self.assertTrue(body.closed)
    def test_successful_refresh_preserves_adapter_return_contract(self):
        with patch.object(m.urllib.request,'urlopen',return_value=Response({'access_token':'fixture-sensitive-result'})):
            self.assertEqual(m.try_refresh('fixture','fixture','fixture'),'fixture-sensitive-result')

if __name__=='__main__':unittest.main(verbosity=2)
